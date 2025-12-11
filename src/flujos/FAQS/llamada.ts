import { addKeyword, EVENTS } from "@builderbot/bot";
import { responderConAnimacion } from "~/utilidades/chatUX";

/**
 * Flujo que se activa cuando el bot recibe una llamada
 * Responde automáticamente con un mensaje indicando que no puede contestar
 */
export const flujoLlamada = addKeyword(EVENTS.CALL)
    .addAction(async (ctx, { provider }) => {
        
        const status = ctx.call?.status;
        
        // Responder inmediatamente cuando detecta la llamada entrante
        if (status === 'offer') {
   
            
            try {
                // ⭐ Extraer el número correctamente desde ctx.from
                const numeroCompleto = ctx.from; // Ya viene con el formato correcto
                
                
                // Rechazar la llamada automáticamente
                await provider.vendor.rejectCall(ctx.call.id, ctx.call.from);
                
                
                // Esperar un momento antes de enviar mensajes
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                console.log('📤 Enviando mensajes a:', numeroCompleto);
                
                // ⭐ Usar ctx.from directamente
                const mensaje1 = "📞 Hola, gracias por llamar. En este momento no puedo contestar.";
                await provider.vendor.sendMessage(numeroCompleto, { text: mensaje1 });
                
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const mensaje2 = "¿En qué te puedo ayudar? Por favor, escríbeme tu consulta y te responderé lo antes posible. 😊";
                await provider.vendor.sendMessage(numeroCompleto, { text: mensaje2 });
               
                
                console.log('✅ Todos los mensajes enviados correctamente');
                
            } catch (error) {
                console.error('❌ Error en flujo de llamada:', error);
                console.error('Stack:', error.stack);
            }
        } 
    });