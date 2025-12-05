import { addKeyword } from "@builderbot/bot";
import { EVENTS } from "@builderbot/bot";
import { responderConAnimacion } from "~/utilidades/chatUX";
import { cargarArchivoPrompt } from "~/utilidades/read.prompt";
import { instanciaAdaptadorMongo } from "../../bd/adaptadorMongo";
import { flujoReserva } from "../agendar_cita/reserva.flujo"; // Asegúrate de importar tu flujo de reserva
import { detectarIntencion } from "../detectar.intencion";

// Función para detectar respuestas afirmativas
const esRespuestaAfirmativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesSi = ['si', 'sí', 'claro', 'ok', 'vale', 'dale', 'afirmativo', 'confirmo', 'quiero', 'me interesa', 'por favor', 'seguro'];
    return patronesSi.some(patron => mensajeLower.includes(patron));
};

// Función para detectar respuestas negativas
const esRespuestaNegativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesNo = ['no', 'nop', 'nope', 'nanai', 'negativo', 'no quiero', 'no gracias', 'ahora no', 'luego', 'después', 'tal vez'];
    return patronesNo.some(patron => mensajeLower.includes(patron));
};

export const flujoHorario = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {

        const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);

        const mensaje1 = "Nuestro horario de atencion es de:";
        await responderConAnimacion(provider, ctx, mensaje1);

        const horario = cargarArchivoPrompt('prompt_Horario.txt');
        const mensaje2 = horario;

        await responderConAnimacion(provider, ctx, mensaje2);

        const mensaje3 = `${nombrePaciente}, ¿deseas agendar una cita?`;
        await responderConAnimacion(provider, ctx, mensaje3);

        const mensajeAcumulado = state.get('mensajeAcumulado');

        const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
        if (ultimaIntencion !== "HORARIO") {
            await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                intencion: "HORARIO",
                pregunta: mensajeAcumulado,
                respuesta: `${mensaje1}\n${mensaje2}\n${mensaje3}`,
                fecha: new Date()
            });
        } 

        await state.clear();
    })
    .addAnswer('', { capture: true }, async (ctx, { provider, gotoFlow, fallBack, state }) => {
        try {
            const respuesta = ctx.body.trim();

            // Verificar si es nota de voz
            const isVoiceNote = ctx.body?.includes('_event_voice_note_');
            if (isVoiceNote) {
                await responderConAnimacion(provider, ctx, "Por favor, responde con texto si deseas agendar o no");
                return fallBack();
            }

            // Verificar si la respuesta es afirmativa
            if (esRespuestaAfirmativa(respuesta)) {
                
                return gotoFlow(flujoReserva);
            }

            // Verificar si la respuesta es negativa
            if (esRespuestaNegativa(respuesta)) {
                
                await responderConAnimacion(provider, ctx, "Entiendo, ¿en qué te puedo ayudar?");
                return;
            }

            // Si la respuesta no es clara, pedir confirmación
            await state.clear()
            await state.update({ mensajeAcumulado: respuesta })
            return gotoFlow(detectarIntencion);

        } catch (error) {
            console.error('❌ Error en flujoHorario captura:', error);
            await responderConAnimacion(provider, ctx, "Ocurrió un error, deseas agendar una cita?");
            return fallBack();
        }
    });