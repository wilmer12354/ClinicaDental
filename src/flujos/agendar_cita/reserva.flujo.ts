// src/flows/reserva.flow.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { analizarFechaHora, formatearFechaHora, combinarFechaHora, combinarHoraFecha, validarFechaCombinada, corregirTextoCompleto } from '../../utilidades/pln/dateTime';
import { comandoCancelar } from '../../utilidades/validadores';
import { comprobarDisponibilidad } from '../../servicios/googleCalendar';
import { flujoNombre } from './nombre.flujo';
import { transcribeAudio, limpiarAudio } from '../../servicios/groqServicio';
import fs from 'fs';
import path from 'path';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { sendReactionViaSocket } from '../../utilidades/baileysSocketMensajes';
import { iniciarTemporizador, reiniciarTemporizador, detenerTemporizador } from '../../utilidades/inactividad';
import { obtenerMensaje } from '~/utilidades/mensajesDiferentes';
import { corregirOrtografia } from '~/utilidades/pln/correctorOrtografia';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';

// ===========================
// CONSTANTES
// ===========================

const TIMEOUT_MS = 50000;
const DURACION_RESERVA_HORAS = 1;

// Horarios de atención por sucursal
const HORARIOS_SUCURSAL = {
  '1': {
    dias: [1, 2, 3, 4, 5], // Lunes a Viernes
    horaInicio: 10, // 10 AM
    horaFin: 13,    // 1 PM
    diasTexto: 'Lunes a Viernes',
    horarioTexto: '10:00 AM a 1:00 PM'
  },
  '2': {
    dias: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
    horaInicio: 15, // 3 PM
    horaFin: 20,    // 8 PM
    diasTexto: 'Lunes a Sábado',
    horarioTexto: '3:00 PM a 8:00 PM'
  }
};

// ===========================
// TIPOS DE ESTADO
// ===========================

interface EstadoReserva {
  fechaParcial?: string;
  horaParcial?: number;
  minutoParcial?: number;
  sugerenciaStart?: string;
  sugerenciaEnd?: string;
  sugerenciaSucursal?: string | null;
  sugerenciaDireccion?: string | null;
  startTime?: Date;
  endTime?: Date;
  fechaOriginal?: string;
  fechaFormateada?: string;
  step?: string;
  preservarEstadoParcial?: boolean;
}

// ===========================
// UTILIDADES DE AUDIO
// ===========================

async function procesarAudio(ctx: any, provider: any): Promise<string> {
  const directorio_tmp = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(directorio_tmp)) {
    fs.mkdirSync(directorio_tmp, { recursive: true });
  }

  const archivo = await provider.saveFile(ctx, { path: directorio_tmp });
  if (!fs.existsSync(archivo)) {
    throw new Error('Error al descargar el audio');
  }

  const transcripcion = await transcribeAudio(archivo);
  if (!transcripcion || transcripcion.trim().length === 0) {
    throw new Error('Transcripción vacía');
  }

  return transcripcion.trim();
}

async function manejarErrorAudio(
  audio: string | null,
  provider: any,
  ctx: any,
  gotoFlow: any,
  fallBack: any,
  mensaje: string
) {
  if (audio) limpiarAudio(audio);
  if (mensaje) await responderConAnimacion(provider, ctx, mensaje);
  reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
  return fallBack();
}

// ===========================
// PROCESADORES DE CASOS
// ===========================

/**
 * Procesa el caso cuando el usuario ya dio fecha y ahora da la hora
 */
async function procesarHoraPendiente(
  mensaje: string,
  fechaParcial: string,
  state: any,
  provider: any,
  ctx: any,
  gotoFlow: any,
  fallBack: any
) {
  const fechaCombinada = combinarFechaHora(new Date(fechaParcial), mensaje);

  if (!fechaCombinada) {
    await responderConAnimacion(
      provider,
      ctx,
      "No entendí la hora. Intenta con:\n• \"3 PM\"\n• \"15:30\"\n• \"2 de la tarde\""
    );
    reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    return fallBack();
  }

  await state.update({ fechaParcial: null, preservarEstadoParcial: false });

  const validacion = validarFechaCombinada(fechaCombinada);

  if (!validacion.success) {
    await responderConAnimacion(provider, ctx, validacion.message || "Intenta con otra fecha y hora");
    reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    return fallBack();
  }

  const startTime = validacion.date!;
  const endTime = new Date(startTime.getTime() + DURACION_RESERVA_HORAS * 60 * 60 * 1000);

  await state.update({
    startTime,
    endTime,
    fechaOriginal: `${fechaParcial} ${mensaje}`,
    fechaFormateada: formatearFechaHora(startTime),
    step: 'verificando'
  });

  await verificarDisponibilidad(provider, ctx, state, gotoFlow, fallBack, startTime, endTime);
}

/**
 * Procesa el caso cuando el usuario ya dio hora y ahora da la fecha
 */
async function procesarFechaPendiente(
  mensaje: string,
  horaParcial: number,
  minutoParcial: number,
  state: any,
  provider: any,
  ctx: any,
  gotoFlow: any,
  fallBack: any
) {
 

  const fechaCombinada = combinarHoraFecha(horaParcial, minutoParcial, mensaje);

  if (!fechaCombinada) {
    await responderConAnimacion(
      provider,
      ctx,
      "No entendí la fecha. Intenta con:\n• \"mañana\"\n• \"el lunes\"\n• \"15 de noviembre\""
    );
    reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    return fallBack();
  }


  await state.update({
    horaParcial: null,
    minutoParcial: null,
    preservarEstadoParcial: false
  });

  const validacion = validarFechaCombinada(fechaCombinada);

  if (!validacion.success) {
    await responderConAnimacion(provider, ctx, validacion.message || "Intenta con otra fecha y hora");
    reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    return fallBack();
  }

  const startTime = validacion.date!;
  const endTime = new Date(startTime.getTime() + DURACION_RESERVA_HORAS * 60 * 60 * 1000);

  await state.update({
    startTime,
    endTime,
    fechaOriginal: `${mensaje} a las ${horaParcial}:${minutoParcial}`,
    fechaFormateada: formatearFechaHora(startTime),
    step: 'verificando'
  });

  await verificarDisponibilidad(provider, ctx, state, gotoFlow, fallBack, startTime, endTime);
}

/**
 * Verifica si el horario seleccionado está dentro del horario de atención de la sucursal
 */
async function validarHorarioSucursal(
  startTime: Date,
  sucursalId: string
): Promise<{ valido: boolean; mensaje?: string }> {
  const horario = HORARIOS_SUCURSAL[sucursalId as keyof typeof HORARIOS_SUCURSAL];
  const diaSemana = startTime.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado

  // Verificar día de la semana
  if (!horario.dias.includes(diaSemana)) {
    return {
      valido: false,
      mensaje: `La sucursal seleccionada solo atiende los días ${horario.diasTexto}.`
    };
  }

  // Verificar horario
  const hora = startTime.getHours();
  const minutos = startTime.getMinutes();
  const horaDecimal = hora + minutos / 60;

  if (horaDecimal < horario.horaInicio || horaDecimal >= horario.horaFin) {
    return {
      valido: false,
      mensaje: `La sucursal seleccionada atiende de ${horario.horarioTexto}.`
    };
  }

  return { valido: true };
}

/**
 * Verifica disponibilidad y maneja la respuesta
 */
async function verificarDisponibilidad(
  provider: any,
  ctx: any,
  state: any,
  gotoFlow: any,
  fallBackOrFlowDynamic: any,
  startTime: Date,
  endTime: Date
) {
  try {
    await responderConAnimacion(provider, ctx, "Verificando disponibilidad, dame un momento...");

    // Obtener sucursal seleccionada para pasarla como referencia
    const sucursalId = await state.get('sucursal');
    const disponibilidad = await comprobarDisponibilidad(startTime, endTime, sucursalId);

    if (disponibilidad.available) {
      await state.update({ step: 'disponible' });
      const mensaje = obtenerMensaje('cita', 'disponible');
      await responderConAnimacion(
        provider,
        ctx,
        mensaje
      );
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return gotoFlow(flujoNombre);
    }

    // Horario ocupado
    if (disponibilidad.nextAvailable) {
      const siguienteHorario = disponibilidad.nextAvailable;

      // Guardar información de la sugerencia incluyendo sucursal
      await state.update({
        sugerenciaStart: siguienteHorario.start,
        sugerenciaEnd: siguienteHorario.end,
        sugerenciaSucursal: siguienteHorario.sucursal || null,
        sugerenciaDireccion: siguienteHorario.direccion || null
      });

      // Construir mensaje con información de la sugerencia
      const mensajeOcupado = obtenerMensaje('cita', 'horario_ocupado');
      const fechaSugerida = formatearFechaHora(new Date(siguienteHorario.start));
      
      let mensajeSugerencia = `${mensajeOcupado}\n\n`;
      mensajeSugerencia += `📅 *Sugerencia de horario disponible:*\n`;
      mensajeSugerencia += `⏰ ${fechaSugerida}\n`;
      
      if (siguienteHorario.sucursal) {
        mensajeSugerencia += `🏢 ${siguienteHorario.sucursal}\n`;
        if (siguienteHorario.direccion) {
          mensajeSugerencia += `📍 ${siguienteHorario.direccion}\n`;
        }
      }
      
      mensajeSugerencia += `\n¿Te funciona este horario? (Responde "sí" o "no")`;

      await responderConAnimacion(provider, ctx, mensajeSugerencia);
      reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);

      // No hacer gotoFlow, simplemente retornar para que el flujo principal capture la respuesta
      
    }

    

    // Si fallBackOrFlowDynamic es fallBack, usarlo; si no, reiniciar flujo
    if (typeof fallBackOrFlowDynamic === 'function') {
      reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBackOrFlowDynamic();
    }

  } catch (error) {
    console.error('❌ Error verificando disponibilidad:', error);
    await responderConAnimacion(
      provider,
      ctx,
      "Hubo un error al verificar la disponibilidad, dime otra fecha"
    );

    if (typeof fallBackOrFlowDynamic === 'function') {
      reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBackOrFlowDynamic();
    }
  }
}

// FLUJO PRINCIPAL
// ===========================

export const flujoReserva = addKeyword(EVENTS.ACTION)
  // Mostrar información de sucursales
  .addAction(async (ctx, { state, provider }) => {
    const mensaje = `
      *Sucursal 1*
      📍 Cañada Estrongest N° 1842
      (Al lado del Colegio Humboldt)
      🏢 Edificio TORRE CENTRUM - Piso 2 Of. 208
      ⏰ Horario: ${HORARIOS_SUCURSAL['1'].diasTexto} de ${HORARIOS_SUCURSAL['1'].horarioTexto}
      📝 *Atención con cita previa*

      *Sucursal 2*
      📍 Av. Buenos Aires N° 1164
      (Al lado del Mercado Hinojosa)
      ⏰ Horario: ${HORARIOS_SUCURSAL['2'].diasTexto} de ${HORARIOS_SUCURSAL['2'].horarioTexto}

      ¿Cuál te queda más cerca? (Responde con el número de sucursal)
      `;


    await responderConAnimacion(provider, ctx, mensaje);
    await state.update({ step: 'seleccionar_sucursal' });
  })

  // Capturar selección de sucursal
  .addAction({ capture: true }, async (ctx, { state, provider, fallBack }) => {
    const respuesta = ctx.body?.trim().toLowerCase();
    if (respuesta === '1' || respuesta === '2') {
      const sucursalInfo = respuesta === '1'
        ? {
          nombre: 'Sucursal 1 - Cañada Estrongest N° 1842',
          horario: HORARIOS_SUCURSAL['1']
        }
        : {
          nombre: 'Sucursal 2 - Av. Buenos Aires N° 1164',
          horario: HORARIOS_SUCURSAL['2']
        };

      await state.update({ sucursal: respuesta });


      // Mostrar recordatorio del horario de atención
      await responderConAnimacion(
        provider,
        ctx,
        `⏰ *Horario de atención*: ${sucursalInfo.horario.diasTexto} de ${sucursalInfo.horario.horarioTexto}`
      );

      return;
    } else {
      await responderConAnimacion(provider, ctx, '❌ Opción inválida. Por favor, responde solo con el número de la sucursal (1 o 2):');
      return fallBack();
    }
  })

  // Paso 1: Detectar si ya viene con fecha/hora en el mensaje inicial
  .addAction(async (ctx, { provider, gotoFlow, state, flowDynamic, fallBack }) => {
    // Si ya seleccionó sucursal, continuar con el flujo normal
    if (await state.get('sucursal')) {
      try {

        let mensajeInicial = '';
        let audio: string | null = null;

        await sendReactionViaSocket(provider, ctx.key, '👍');
        const esNotaVoz = ctx.body?.includes('_event_voice_note_');
        if (esNotaVoz) {
          await responderConAnimacion(provider, ctx, 'Dame un momento para escucharte...');
          mensajeInicial = await procesarAudio(ctx, provider);
          audio = path.join(process.cwd(), 'tmp');
        } else {
          mensajeInicial = ctx.body?.trim();
        }

       

        // 🔧 PRE-PROCESAMIENTO: Aplicar corrección de errores tipográficos
        const mensajeCorregido = await corregirOrtografia(mensajeInicial);
        

        if (mensajeCorregido !== mensajeInicial.toLowerCase()) {
          
          mensajeInicial = mensajeCorregido;
        }

        // Intentar parsear fecha/hora del mensaje inicial
        const interpretacion = analizarFechaHora(mensajeInicial);

        

        // CASO 1: Ya viene con fecha Y hora completa
        if (interpretacion.success && interpretacion.date) {
          const startTime = interpretacion.date;
          const endTime = new Date(startTime.getTime() + DURACION_RESERVA_HORAS * 60 * 60 * 1000);
          const sucursalId = await state.get('sucursal');

          // Validar horario de la sucursal
          const validacionHorario = await validarHorarioSucursal(startTime, sucursalId);

          if (!validacionHorario.valido) {
            await responderConAnimacion(provider, ctx, `❌ ${validacionHorario.mensaje} Por favor, selecciona otro horario.`);
            await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
            return fallBack()
          }

          await state.update({
            startTime,
            endTime,
            fechaOriginal: mensajeInicial,
            fechaFormateada: formatearFechaHora(startTime),
            step: 'verificando'
          });

          await verificarDisponibilidad(provider, ctx, state, gotoFlow, flowDynamic, startTime, endTime);
          return; // Salir del flujo, ya no necesita preguntar nada
        }

        // CASO 2: Solo viene con fecha, falta hora
        if (interpretacion.needsTime && interpretacion.partialDate) {
          await state.update({
            fechaParcial: interpretacion.partialDate.toISOString(),
            preservarEstadoParcial: true
          });
         
          await responderConAnimacion(provider, ctx, interpretacion.message!);
          await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
          return; // Continuar al siguiente addAnswer para capturar la hora
        }

        // CASO 3: Solo viene con hora, falta fecha
        if (interpretacion.needsDate && interpretacion.partialHour !== undefined) {
          await state.update({
            horaParcial: interpretacion.partialHour,
            minutoParcial: interpretacion.partialMinute || 0,
            preservarEstadoParcial: true
          });
          
          await responderConAnimacion(provider, ctx, interpretacion.message!);
          await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
          return; // Continuar al siguiente addAnswer para capturar la fecha
        }

        
        await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);

      } catch (error) {
        console.error('❌ Error en acción inicial:', error);
        await responderConAnimacion(provider, ctx, 'mensaje');
        await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      }
    }
  })

  // Paso 2: Captura y procesamiento del mensaje
  .addAnswer('Por favor, indica ( mañana, tarde, noche ó am,pm a su hora)', { capture: true }, async (ctx, { provider, state, gotoFlow, fallBack }) => {
    await detenerTemporizador(ctx);

    let mensaje = '';
    let audio: string | null = null;

    // Procesar audio o texto
    try {
      const esNotaVoz = ctx.body?.includes('_event_voice_note_');

      if (esNotaVoz) {
        await responderConAnimacion(provider, ctx, 'Dame un momento para escucharte...');
        mensaje = await procesarAudio(ctx, provider);
        audio = path.join(process.cwd(), 'tmp');
      } else {
        mensaje = ctx.body.trim();
      }
    } catch (error) {
      console.error('❌ Error procesando entrada:', error);
      return manejarErrorAudio(
        audio,
        provider,
        ctx,
        gotoFlow,
        fallBack,
        "No pude entender, mandame en texto..."
      );

    }
    // ✅ AGREGAR CORRECCIÓN AQUÍ (justo después de procesar audio/texto)


    const mensajeCorregido = await corregirOrtografia(mensaje);


    if (mensajeCorregido !== mensaje.toLowerCase()) {
     
      mensaje = mensajeCorregido; // ⬅️ Reemplazar el mensaje con el corregido

    }


    // Verificar comando de cancelación
    /*if (comandoCancelar(mensaje)) {
      await responderConAnimacion(provider, ctx, "Proceso cancelado, ¿en qué te puedo ayudar?");
      await state.clear();
      return;
    }*/

    // Verificar estados pendientes
    const estadoActual: EstadoReserva = {
      fechaParcial: await state.get('fechaParcial'),
      horaParcial: await state.get('horaParcial'),
      minutoParcial: await state.get('minutoParcial'),
      sugerenciaStart: await state.get('sugerenciaStart'),
      sugerenciaEnd: await state.get('sugerenciaEnd'),
      sugerenciaSucursal: await state.get('sugerenciaSucursal'),
      sugerenciaDireccion: await state.get('sugerenciaDireccion')
    };

    // Caso 1: Confirmar sugerencia de horario
    if (estadoActual.sugerenciaStart) {
      
      const respuesta = mensaje.toLowerCase().trim();
    

      // Usuario acepta la sugerencia
      if (['si', 'sip', 'sí', 'ok', 'dale', 'aceptar', 'confirmar', 'esta bien', 'normal', 'si claro'].includes(respuesta)) {
        // Si la sugerencia incluye una sucursal diferente, actualizarla
        const updateData: any = {
          startTime: new Date(estadoActual.sugerenciaStart),
          endTime: new Date(estadoActual.sugerenciaEnd!),
          fechaOriginal: mensaje,
          fechaFormateada: formatearFechaHora(new Date(estadoActual.sugerenciaStart)),
          step: 'disponible',
          sugerenciaStart: null,
          sugerenciaEnd: null,
          sugerenciaSucursal: null,
          sugerenciaDireccion: null
        };

        // Si la sugerencia tiene una sucursal asociada, actualizarla en el estado
        if (estadoActual.sugerenciaSucursal) {
          // Determinar el ID de sucursal basado en el nombre
          if (estadoActual.sugerenciaSucursal.includes('CENTRUM') || estadoActual.sugerenciaSucursal.includes('TORRE')) {
            updateData.sucursal = '1';
          } else if (estadoActual.sugerenciaSucursal.includes('BUENOS AIRES') || estadoActual.sugerenciaSucursal.includes('Buenos Aires')) {
            updateData.sucursal = '2';
          }
        }

        await state.update(updateData);

        let mensajeConfirmacion = `Perfecto! \n📅 ${formatearFechaHora(new Date(estadoActual.sugerenciaStart))}`;
        if (estadoActual.sugerenciaSucursal) {
          mensajeConfirmacion += `\n🏢 ${estadoActual.sugerenciaSucursal}`;
        }
        mensajeConfirmacion += `\n\nSigamos...`;

        await responderConAnimacion(provider, ctx, mensajeConfirmacion);

        await detenerTemporizador(ctx);
        return gotoFlow(flujoNombre);
      }

      // Usuario rechaza la sugerencia
      if (['no', 'nop', 'nope', 'negativo', 'otra'].includes(respuesta)) {
        await state.update({
          sugerenciaStart: null,
          sugerenciaEnd: null,
          sugerenciaSucursal: null,
          sugerenciaDireccion: null
        });
        const NUMERO_CELULAR = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const NOMBRE_PACIENTE = await instanciaAdaptadorMongo.obtenerNombrePaciente(NUMERO_CELULAR);

        const mensaje = obtenerMensaje('cita', 'pedir_otra_fecha', { nombre: NOMBRE_PACIENTE });

        await responderConAnimacion(provider, ctx, mensaje);

        reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
        return fallBack();
      }

      // Si no es ni sí ni no, limpiar sugerencia y continuar con parseo normal
      await state.update({
        sugerenciaStart: null,
        sugerenciaEnd: null,
        sugerenciaSucursal: null,
        sugerenciaDireccion: null
      });
      
    }

    // Caso 2: Usuario ya dio fecha, ahora da hora
    if (estadoActual.fechaParcial) {
      return procesarHoraPendiente(
        mensaje,
        estadoActual.fechaParcial,
        state,
        provider,
        ctx,
        gotoFlow,
        fallBack
      );
    }

    // Caso 3: Usuario ya dio hora, ahora da fecha
    if (estadoActual.horaParcial !== null && estadoActual.horaParcial !== undefined) {
      return procesarFechaPendiente(
        mensaje,
        estadoActual.horaParcial,
        estadoActual.minutoParcial || 0,
        state,
        provider,
        ctx,
        gotoFlow,
        fallBack
      );
    }

    // Caso 4: Parseo inicial de fecha/hora
    const interpretacion = analizarFechaHora(mensaje);
   

    // Usuario solo dio fecha
    if (interpretacion.needsTime && interpretacion.partialDate) {
      await state.update({
        fechaParcial: interpretacion.partialDate.toISOString(),
        preservarEstadoParcial: true
      });
      
      await responderConAnimacion(provider, ctx, interpretacion.message!);
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    }

    // Usuario solo dio hora
    if (interpretacion.needsDate && interpretacion.partialHour !== undefined) {
      

      await state.update({
        horaParcial: interpretacion.partialHour,
        minutoParcial: interpretacion.partialMinute || 0,
        preservarEstadoParcial: true
      });

      await responderConAnimacion(provider, ctx, interpretacion.message!);
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    }

    // Error en el parseo
    if (!interpretacion.success) {
      return manejarErrorAudio(
        audio,
        provider,
        ctx,
        gotoFlow,
        fallBack,
        interpretacion.message || "Intenta con otra fecha y hora"
      );
    }

    // Fecha y hora completa
    const startTime = interpretacion.date!;
    const endTime = new Date(startTime.getTime() + DURACION_RESERVA_HORAS * 60 * 60 * 1000);
    const sucursalId = await state.get('sucursal');

    // Validar horario de la sucursal
    const validacionHorario = await validarHorarioSucursal(startTime, sucursalId);

    if (!validacionHorario.valido) {
      await responderConAnimacion(provider, ctx, `❌ ${validacionHorario.mensaje} Por favor, selecciona otro horario.`);
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    }

    await state.update({
      startTime,
      endTime,
      fechaOriginal: mensaje,
      fechaFormateada: formatearFechaHora(startTime),
      step: 'verificando'
    });

    await verificarDisponibilidad(provider, ctx, state, gotoFlow, fallBack, startTime, endTime);
  });