// src/flows/medicoAgendar.flow.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { agendarCita } from '../../servicios/googleCalendar';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { extraerDatosCita } from '../../servicios/groqServicio';

/**
 * Interpretar confirmación del usuario
 */
function interpretarConfirmacion(respuesta: string): { confirmado: boolean; rechazado: boolean } {
    const confirmWords = ['si', 'sí', 'yes', 'ok', 'confirmar', 'correcto', 'exacto', 'afirmativo', 'positivo', 'claro', 'dale', 'sep'];
    const rejectWords = ['no', 'negativo', 'incorrecto', 'nop', 'nope', 'cancelar'];

    const resp = respuesta.toLowerCase().trim();
    const confirmado = confirmWords.some(word => resp === word || resp.includes(word));
    const rechazado = rejectWords.some(word => resp === word || resp.includes(word));

    return { confirmado, rechazado };
}

/**
 * Flujo inteligente para agendar citas - El médico escribe libremente
 */
export const flujoMedicoAgendar = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        try {
            // Inicializar estado
            await state.update({ 
                esperandoConfirmacion: false,
                datosExtraidos: null
            });

            await responderConAnimacion(
                provider, 
                ctx, 
                "Claro, dame los datos del paciente"
            );
        } catch (error) {
            console.error('❌ Error en flujoMedicoAgendar action:', error);
        }
    })
    
    .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, fallBack }) => {
        try {
            const mensaje = ctx.body.trim();
            
            // ✅ CLAVE: Verificar si estamos esperando confirmación
            const esperandoConfirmacion = state.get('esperandoConfirmacion');

            if (esperandoConfirmacion) {
                // ========================================
                // CASO 2: Usuario está CONFIRMANDO (sí/no)
                // ========================================
                
                const { confirmado, rechazado } = interpretarConfirmacion(mensaje);

                // Si confirma, crear la cita
                if (confirmado) {
                    await responderConAnimacion(provider, ctx, "⏳ Creando la cita en el calendario...");
                    
                    const datos = state.get('datosExtraidos');
                    
                    // Validar datos
                    if (!datos || !datos.nombrePaciente || !datos.startTime) {
                        await responderConAnimacion(provider, ctx, '❌ Error: Faltan datos. Intenta nuevamente.');
                        await state.clear();
                        return;
                    }
                    
                    const datosReserva = {
                        title: `Cita - ${datos.nombrePaciente}`,
                        startTime: datos.startTime.toISOString(),
                        endTime: datos.endTime.toISOString(),
                        description: `Motivo: ${datos.motivo}\nContacto: ${datos.email}\nTeléfono: ${datos.telefono}`,
                        email: datos.email || '',
                        nombre: datos.nombrePaciente,
                        telefono: datos.telefono,
                        motivo: datos.motivo
                    };
                    
                    console.log('📅 Creando cita:', datosReserva);
                    
                    const resultado = await agendarCita(datosReserva);
                    
                    if (resultado.success) {
                        await flowDynamic([
                            '✅ *¡Cita creada exitosamente!*\n\n' +
                            `👤 ${datos.nombrePaciente}\n` +
                            `📅 ${datos.startTime.toLocaleDateString('es-ES', { 
                                weekday: 'long', 
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}\n` +
                            `⏰ ${datos.startTime.toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })} - ${datos.endTime.toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}\n` +
                            `📝 ${datos.motivo}`
                        ]);
                        await state.clear();
                        return;
                    }
                    
                    throw new Error(resultado.message || 'Error al crear la cita');
                }

                // Si rechaza, cancelar
                if (rechazado) {
                    await responderConAnimacion(provider, ctx, '❌ Cita cancelada.');
                    await state.clear();
                    return;
                }

                // Si no entiende la respuesta
                await responderConAnimacion(provider, ctx, 'No entendí. Responde *Sí* para confirmar o *No* para cancelar.');
                return fallBack();

            } else {
                // ========================================
                // CASO 1: Usuario está ENVIANDO DATOS
                // ========================================
                
                await responderConAnimacion(provider, ctx, "🤖 Analizando los datos...");

                console.log('📝 Mensaje recibido:', mensaje);

                // Extraer datos usando Groq
                const datosExtraidos = await extraerDatosCita(mensaje);
                console.log('📊 Datos extraídos:', datosExtraidos);
                
                // Validar que tengamos los datos mínimos
                if (!datosExtraidos.nombre || !datosExtraidos.fecha || !datosExtraidos.hora) {
                    const faltantes = [];
                    if (!datosExtraidos.nombre) faltantes.push('nombre');
                    if (!datosExtraidos.fecha) faltantes.push('fecha');
                    if (!datosExtraidos.hora) faltantes.push('hora');
                    
                    await responderConAnimacion(
                        provider, 
                        ctx, 
                        `❌ Faltan datos: ${faltantes.join(', ')}.\n\nIntenta de nuevo incluyendo toda la información.`
                    );
                    return fallBack();
                }
                
                // Validar email si está presente
                if (datosExtraidos.email) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(datosExtraidos.email)) {
                        await responderConAnimacion(provider, ctx, '❌ El email no es válido. Verifica e intenta nuevamente.');
                        return fallBack();
                    }
                }
                
                // Construir fecha y hora en timezone local
                let startTime: Date;
                try {
                    // Crear fecha en timezone local (sin conversión a UTC)
                    const [year, month, day] = datosExtraidos.fecha.split('-').map(Number);
                    const [hour, minute] = datosExtraidos.hora.split(':').map(Number);
                    
                    // Usar el constructor de Date que crea en timezone local
                    startTime = new Date(year, month - 1, day, hour, minute, 0);
                    
                    if (isNaN(startTime.getTime())) {
                        throw new Error('Fecha inválida');
                    }
                    
                    // Validar que la fecha no sea en el pasado
                    const ahora = new Date();
                    if (startTime < ahora) {
                        await responderConAnimacion(provider, ctx, '❌ La fecha y hora no pueden ser en el pasado.');
                        return fallBack();
                    }
                } catch (error) {
                    await responderConAnimacion(
                        provider, 
                        ctx, 
                        '❌ No pude interpretar la fecha y hora.\n\nUsa formatos como:\n• "mañana 10am"\n• "15 de marzo 3pm"\n• "próximo lunes 9:30am"'
                    );
                    return fallBack();
                }
                
                // Calcular hora de fin (1 hora después)
                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
                
                // Guardar datos extraídos y marcar que esperamos confirmación
                await state.update({
                    datosExtraidos: {
                        nombrePaciente: datosExtraidos.nombre,
                        email: datosExtraidos.email || '',
                        telefono: datosExtraidos.telefono || 'No proporcionado',
                        startTime: startTime,
                        endTime: endTime,
                        motivo: datosExtraidos.motivo || 'Consulta general'
                    },
                    esperandoConfirmacion: true  // ✅ CLAVE: Activar flag de confirmación
                });
                
                // Mostrar resumen y pedir confirmación
                await responderConAnimacion(
                    provider, 
                    ctx, 
                    '¿Confirmar esta cita? *(Sí/No)*'
                );

                
                return fallBack(); // ✅ Vuelve al MISMO .addAnswer pero con flag activado
            }

        } catch (error) {
            console.error('❌ Error en flujoMedicoAgendar:', error);
            await responderConAnimacion(
                provider, 
                ctx, 
                '❌ Hubo un error al procesar los datos. Intenta nuevamente.'
            );
            await state.clear();
            return fallBack();
        }
    });