import { addKeyword, EVENTS } from '@builderbot/bot';
import { nombreValido, comandoCancelar } from '../../utilidades/validadores';
import { transcribeAudio, limpiarAudio } from '../../servicios/groqServicio';
import { flujoEmail } from './email.flujo';
import fs from 'fs';
import path from 'path';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { iniciarTemporizador, reiniciarTemporizador, detenerTemporizador } from '../../utilidades/inactividad';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { obtenerMensaje } from '~/utilidades/mensajesDiferentes';

const TIMEOUT_MS = 50000;

/**
 * Función auxiliar para procesar nota de voz y obtener el texto
 */
async function procesarNotaVoz(ctx: any, provider: any): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const audioPath = await provider.saveFile(ctx, { path: tmpDir });
  if (!fs.existsSync(audioPath)) throw new Error('No se pudo guardar el audio');

  const transcripcion = await transcribeAudio(audioPath);
  if (!transcripcion || transcripcion.trim().length === 0) throw new Error('Transcripción vacía');

  return transcripcion.trim();
}

/**
 * Interpretar confirmación del usuario
 */
function interpretarConfirmacion(respuesta: string): { confirmado: boolean; rechazado: boolean } {
  const confirmWords = ['si', 'sí', 'yes', 'ok', 'confirmar', 'correcto', 'exacto', 'afirmativo', 'positivo', 'claro', 'dale', 'sep'];
  const rejectWords = ['no', 'negativo', 'incorrecto', 'nop', 'nope'];

  const resp = respuesta.toLowerCase().trim();
  const confirmado = confirmWords.some(word => resp === word || resp.includes(word));
  const rechazado = rejectWords.some(word => resp === word || resp.includes(word));

  return { confirmado, rechazado };
}

/**
 * Flujo principal para capturar/verificar el nombre del usuario
 */
export const flujoNombre = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { provider, gotoFlow, state }) => {
    try {
      await detenerTemporizador(ctx);
      const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
      const nombreDB = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroCelular);
      
      // Guardar el nombre de la BD y marcar que estamos en fase de confirmación
      await state.update({ 
        nombreDBTemporal: nombreDB,
        esperandoNuevoNombre: false  // ✅ Flag para controlar el flujo
      });

      const mensaje = obtenerMensaje('cita', 'confirmar_nombre', { nombre: nombreDB });
      await responderConAnimacion(provider, ctx, mensaje);
      await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    } catch (error) {
      console.error('Error en nameFlow action:', error);
    }
  })

  // Captura única que maneja AMBOS casos
  .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, gotoFlow, fallBack }) => {
    let audioPath: string | null = null;
    let respuesta = '';

    try {
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);

      // Verificar si es nota de voz
      if (ctx.body?.includes('_event_voice_note_')) {
        await responderConAnimacion(provider, ctx, 'Escuchando tu nota de voz...');
        respuesta = await procesarNotaVoz(ctx, provider);
        audioPath = path.join(process.cwd(), 'tmp');
      } else {
        respuesta = ctx.body.trim();
      }

      // ✅ CLAVE: Verificar si estamos esperando un nuevo nombre
      const esperandoNuevoNombre = state.get('esperandoNuevoNombre');

      if (esperandoNuevoNombre) {
        // ========================================
        // CASO 2: Usuario ingresó un NUEVO NOMBRE
        // ========================================
        
        // Validar nombre
        if (!nombreValido(respuesta)) {
          await responderConAnimacion(provider, ctx, 'Por favor ingresa un nombre válido');
          await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
          return fallBack();
        }

        // Guardar el nuevo nombre y continuar
        await state.update({ 
          nombrePaciente: respuesta,
          nombreDBTemporal: null,
          esperandoNuevoNombre: false
        });
        await detenerTemporizador(ctx);
        return gotoFlow(flujoEmail);

      } else {
        // ========================================
        // CASO 1: Usuario está CONFIRMANDO (sí/no)
        // ========================================
        
        const { confirmado, rechazado } = interpretarConfirmacion(respuesta);

        // Si confirma, usar el nombre de la BD
        if (confirmado) {
          const nombreDB = state.get('nombreDBTemporal');
          await state.update({ 
            nombrePaciente: nombreDB,
            nombreDBTemporal: null,
            esperandoNuevoNombre: false
          });
          await detenerTemporizador(ctx);
          return gotoFlow(flujoEmail);
        }

        // Si rechaza, pedir el nombre correcto
        if (rechazado) {
          const mensaje = obtenerMensaje('cita', 'pedir_nombre');
          await responderConAnimacion(provider, ctx, mensaje);
          
          // ✅ CLAVE: Marcar que ahora esperamos un nuevo nombre
          await state.update({ esperandoNuevoNombre: true });
          await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
          return fallBack(); // Vuelve al MISMO .addAnswer pero con flag activado
        }

        // Si no entiende la respuesta
        await responderConAnimacion(provider, ctx, 'No entendí. Responde *sí* o *no*');
        await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
        return fallBack();
      }

    } catch (error) {
      console.error('❌ Error en flujoNombre:', error);
      await flowDynamic('⚠️ Ocurrió un error. Por favor intenta de nuevo.');
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    } finally {
      if (audioPath && fs.existsSync(audioPath)) limpiarAudio(audioPath);
    }
  });