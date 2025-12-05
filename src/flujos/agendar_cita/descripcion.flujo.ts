import { addKeyword, EVENTS } from '@builderbot/bot';
import { descripcionValida, comandoCancelar } from '../../utilidades/validadores';
import { transcribeAudio, limpiarAudio } from '../../servicios/groqServicio';
import fs from 'fs';
import path from 'path';
import { flujoConfirmar } from './confirmar.flujo';
import { responderConAnimacion } from '~/utilidades/chatUX';
import { iniciarTemporizador, reiniciarTemporizador, detenerTemporizador } from '../../utilidades/inactividad';

const TIMEOUT_MS = 50000;

/**
 * Procesar nota de voz y devolver el texto
 */
async function procesarNotaVoz(ctx: any, provider: any): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = await provider.saveFile(ctx, { path: tmpDir });
  if (!fs.existsSync(filePath)) throw new Error('No se pudo guardar el audio');

  const texto = await transcribeAudio(filePath);
  if (!texto || texto.trim().length === 0) throw new Error('Transcripción vacía');

  return texto.trim();
}

/**
 * Lógica de confirmación del usuario
 */
function interpretarConfirmacion(respuesta: string) {
  const confirmWords = ['si', 'sí', 'yes', 'ok', 'confirmar', 'correcto', 'perfecto', 'dale', 'adelante'];
  const rejectWords = ['no', 'cancelar', 'mal', 'incorrecto', 'error', 'negativo'];

  const resp = respuesta.toLowerCase();
  const confirmado = confirmWords.some(word => resp.includes(word));
  const rechazado = rejectWords.some(word => resp.includes(word));

  return { confirmado, rechazado };
}

//FUNCION PRINCIPAL
export const flujoDescripcion = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { provider, gotoFlow }) => {
    try {
      await responderConAnimacion(provider, ctx, "Cuál es el motivo de tu cita?");
      await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
    } catch (error) {
      console.error('❌ Error en reasonFlow action:', error);
    }
  })

  // Captura del motivo
  .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, gotoFlow, fallBack }) => {
    await detenerTemporizador(ctx);

    let audioPath: string | null = null;
    let motivo = '';

    try {
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      // Nota de voz
      if (ctx.body?.includes('_event_voice_note_')) {
        await responderConAnimacion(provider, ctx, "Escuchando tu nota de voz...");
        motivo = await procesarNotaVoz(ctx, provider);
        audioPath = path.join(process.cwd(), 'tmp'); // para cleanup
      } else {
        motivo = ctx.body.trim();
      }

      if (comandoCancelar(motivo)) {
        await flowDynamic('❌ Proceso cancelado.');
        await state.clear();
        return;
      }

      if (!descripcionValida(motivo)) {
        await flowDynamic('Por favor proporciona más detalles (mínimo 5 caracteres).');
        await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
        return fallBack();
      }

      await state.update({ motivo });
      const datos = await state.getMyState();
      if (datos.email === undefined) {
        await responderConAnimacion(provider, ctx,
        `*Resumen de tu cita*:
        • Nombre: *${datos.nombrePaciente}*
        • Fecha y hora: *${datos.fechaFormateada}*
        • Motivo: *${motivo}*
        Quieres confirmar?`
      )

      } else {
        await responderConAnimacion(provider, ctx,
          `*Resumen de tu cita*:
        • Nombre: *${datos.nombrePaciente}*
        • Email: *${datos.email}*
        • Fecha y hora: *${datos.fechaFormateada}*
        • Motivo: *${motivo}*
        Quieres confirmar?`
        )
      }


    } catch (error) {
      console.error('❌ Error en reasonFlow motivo:', error);
      await responderConAnimacion(provider, ctx, "⚠️ Ocurrió un error. Por favor intenta de nuevo.");
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    } finally {
      if (audioPath && fs.existsSync(audioPath)) limpiarAudio(audioPath);
    }
  })

  // Confirmación del usuario
  .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, gotoFlow, fallBack }) => {
    await detenerTemporizador(ctx);
    let audioPath: string | null = null;

    try {
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      let respuesta = '';

      if (ctx.body?.includes('_event_voice_note_')) {
        await responderConAnimacion(provider, ctx, "Escuchando tu nota de voz...");
        respuesta = await procesarNotaVoz(ctx, provider);
        audioPath = path.join(process.cwd(), 'tmp'); // cleanup
      } else {
        respuesta = ctx.body.trim();
      }

      const { confirmado, rechazado } = interpretarConfirmacion(respuesta);

      if (confirmado) {
        await detenerTemporizador(ctx);
        return gotoFlow(flujoConfirmar);
      }
      if (rechazado) {
        await responderConAnimacion(provider, ctx, "Proceso cancelado.");
        await state.clear();
        return;
      }

      await flowDynamic('🤔 No entendí tu respuesta.');
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();

    } catch (error) {
      console.error('❌ Error en confirmación:', error);
      await responderConAnimacion(provider, ctx, "⚠️ Ocurrió un error. Por favor intenta de nuevo.");
      await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      return fallBack();
    } finally {
      if (audioPath && fs.existsSync(audioPath)) limpiarAudio(audioPath);
    }
  });
