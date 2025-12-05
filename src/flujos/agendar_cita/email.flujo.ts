// src/flows/email.flow.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { correoValido, comandoCancelar } from '../../utilidades/validadores';
import { flujoDescripcion } from './descripcion.flujo';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { iniciarTemporizador, reiniciarTemporizador, detenerTemporizador } from '../../utilidades/inactividad';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { corregirOrtografia } from '~/utilidades/pln/correctorOrtografia';

const TIMEOUT_MS = 50000;

// Función para detectar si el usuario dice que no tiene email
const noTieneEmail = (mensaje: string): boolean => {
  const mensajeLower = mensaje.toLowerCase().trim();
  const patronesNoEmail = [
    'no tengo',
    'no tengo correo',
    'no tengo email',
    'sin correo',
    'sin email',
    'no cuento con',
    'no poseo',
    'no dispongo'
  ];
  
  return patronesNoEmail.some(patron => mensajeLower.includes(patron));
};

export const flujoEmail = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { provider, gotoFlow, state }) => {
    try {
      // Obtener número del usuario
      const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
      
      // Verificar si ya tiene email en la BD
      const emailBD = await instanciaAdaptadorMongo.obtenerEmailPaciente(numeroCelular);
      
      if (emailBD) {
       
        
        // Guardar en el state
        await state.update({ email: emailBD });
        
        // NO iniciar timer si ya tiene email
        // Pasar directamente al siguiente flujo
        return gotoFlow(flujoDescripcion);
      }
      
      // Si no tiene email, pedirlo e INICIAR el timer
    
      await responderConAnimacion(provider, ctx, "Dime tu email");
      await iniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
      
    } catch (error) {
      console.error('❌ Error en emailFlow action:', error);
      // Si hay error, detener el timer
      await detenerTemporizador(ctx);
    }
  })

  .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, gotoFlow, fallBack }) => {
    try {
      const email = await corregirOrtografia(ctx.body.trim());

      // Verificar si es nota de voz (no permitir)
      const isVoiceNote = ctx.body?.includes('_event_voice_note_');
      if (isVoiceNote) {
        await responderConAnimacion(provider, ctx, "Los correos en notas de voz no están permitidas...escríbelo por favor");
        await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
        return fallBack();
      }
/*
      // 🚫 Verificar si quiere cancelar
      if (comandoCancelar(email)) {
        await flowDynamic('❌ Proceso cancelado.');
        await detenerTemporizador(ctx); // Detener timer al cancelar
        await state.clear();
        return;
      }*/

      // 📧 Verificar si dice que no tiene email
      if (noTieneEmail(email)) {
        await responderConAnimacion(provider, ctx, "Tranquilo, no te preocupes, sigamos");
        await detenerTemporizador(ctx); // Detener timer
        // No guardar email en el state ni en la BD
        return gotoFlow(flujoDescripcion);
      }

      // ✅ Validar email
      if (!correoValido(email)) {
        await responderConAnimacion(provider, ctx, "Este correo no es válido, revisa y dame de nuevo");
        await reiniciarTemporizador(ctx, gotoFlow, TIMEOUT_MS);
        return fallBack();
      }
      
      // Si llegamos aquí, el email es válido
      // Detener el timer ANTES de continuar
      await detenerTemporizador(ctx);
      
      // Obtener número del usuario
      const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
      
      // Actualizar el email en la base de datos
      await instanciaAdaptadorMongo.agregarOActualizarPaciente({
        numero: numeroCelular,
        estado: "ACTIVO",
        email: email
      });
      

      
      // Guardar en estado
      await state.update({ email });
      
      // Ir al siguiente flujo
      return gotoFlow(flujoDescripcion);

    } catch (error) {
      console.error('❌ Error en emailFlow:', error);
      await flowDynamic('⚠️ Ocurrió un error. Por favor intenta de nuevo.');
      await detenerTemporizador(ctx); // Detener timer en caso de error
      return fallBack();
    }
  });