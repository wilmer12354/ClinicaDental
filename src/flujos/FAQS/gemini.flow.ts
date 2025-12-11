import { addKeyword, EVENTS } from "@builderbot/bot";
import { GeminiService } from "../../servicios/gemini";
import { instanciaAdaptadorMongo } from "../../bd/adaptadorMongo";
import { cargarArchivoPrompt } from "../../utilidades/read.prompt";
import { responderConAnimacion } from "~/utilidades/chatUX";

interface mensajesGemini {
    role: "user" | "assistant";
    content: string;
}

export const flujoGemini = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        // Verificar o agregar usuario a la base de datos
        const nombre = ctx.pushName ?? 'Usuario';
        const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];

        await instanciaAdaptadorMongo.agregarOActualizarPaciente({
            nombre,
            numero: numeroCelular,
            estado: "ACTIVO"
        });

        // Obtener el historial de conversación del usuario
        const dbClient = await instanciaAdaptadorMongo.buscarPacientePorNumero(numeroCelular);
        const historial = dbClient?.historial || [];

        // Filtrar mensajes de error del historial
        const historialLimpio = historial.filter(item => 
            !item.respuesta.includes("Lo siento, ocurrió un error")
        );

        // Limitar el historial a las últimas 2 interacciones válidas
        const limitedHistory: mensajesGemini[] = historialLimpio.slice(-2).flatMap(item => [
            { role: "user" as const, content: item.pregunta },
            { role: "assistant" as const, content: item.respuesta }
        ]);



        // Construir contexto para Gemini
        const prompt = cargarArchivoPrompt('prompt_Gemini.txt')
        let mensajeCompleto = '';
        const mensajeAcumulado = state.get('mensajeAcumulado');
        if (limitedHistory.length > 2) {
            const contexto = limitedHistory.map(msg => 
                `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
            ).join('\n');
            mensajeCompleto = `${contexto}\nUsuario: ${ctx.body}`;
        } else {
            
            mensajeCompleto = mensajeAcumulado;
        }

        const respuesta = await GeminiService(prompt, mensajeCompleto);

        // Solo guardar si NO es un mensaje de error
        if (!respuesta.includes("Lo siento, ocurrió un error")) {
            await instanciaAdaptadorMongo.agregarHistorial(numeroCelular, {
                intencion: "GEMINI",
                pregunta: mensajeAcumulado,
                respuesta: respuesta,
                fecha: new Date()
            });
        }

        await state.clear()
        await responderConAnimacion(provider, ctx, respuesta)

        return;
    });

