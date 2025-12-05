import { addKeyword, EVENTS } from '@builderbot/bot';
import { instanciaAdaptadorMongo } from '../../bd/adaptadorMongo';
import { responderConAnimacion } from '~/utilidades/chatUX';
// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '';

// ============================================================================
// FLUJO DERIVACIÓN A MÉDICO
// ============================================================================

export const derivaMedicoFlujo = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {

        const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);

        try {
            // 1. Cambiar estado en MongoDB a "esperando_medico"
            const clienteActualizado = await instanciaAdaptadorMongo.cambiarEstado(
                numeroPaciente,
                'DERIVA_MEDICO'
            );


            if (!clienteActualizado) {
                console.error(`❌ No se pudo cambiar el estado del cliente ${numeroPaciente}`);
                await responderConAnimacion(provider, ctx, '⚠️ Hubo un problema al procesar tu solicitud.\n\n' +
                    'Por favor, intenta nuevamente.');
                return;
            }

            // 2. Notificar al cliente
            await responderConAnimacion(provider, ctx, '👨‍⚕️ *Conectando con el médico...*\n\n' +
                'Un momento por favor, estoy notificando al doctor.\n' +
                'Pronto te atenderá personalmente.');

            // 4. Notificar al médico
            const mensajeParaMedico =
                '🔔 *NUEVA CONSULTA MÉDICA*\n\n' +
                `👤 Paciente: ${nombrePaciente}\n` +
                `📞 Número: +${ctx.from}\n` +
                `⏰ Hora: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}\n\n` +
                '⚠️ *El paciente desea hablar con usted directamente*\n\n';
            // Crear un contexto simulado para el médico
            const ctxMedico = {
                from: ADMIN_NUMBER,
                key: { remoteJid: ADMIN_NUMBER + '@s.whatsapp.net' }
            };

            await responderConAnimacion(provider, ctxMedico, mensajeParaMedico);

            const mensajeAcumulado = state.get('mensajeAcumulado') || state.get('mensajePorNotaDeVoz');
            // 5. Mensaje final al cliente
            await responderConAnimacion(provider, ctx, '✅ *Notificación enviada*\n\n' +
                'El doctor ha sido notificado y te responderá a la brevedad posible.\n\n');
            await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                intencion: "DERIVA_MEDICO",
                pregunta: mensajeAcumulado,
                respuesta: `Derivado al medico`,
                fecha: new Date()
            });

        } catch (error) {
            console.error('❌ Error en derivación a médico:', error);

            await responderConAnimacion(provider, ctx, '❌ Hubo un error al intentar conectar con el médico.\n\n' +
                'Por favor, intenta nuevamente en unos momentos.');
        }
    });