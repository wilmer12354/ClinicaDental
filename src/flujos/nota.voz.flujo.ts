import { addKeyword, EVENTS } from '@builderbot/bot';
import { transcribeAudio, limpiarAudio, generarRespuesta } from '../servicios/groqServicio';
import fs from 'fs';
import path from 'path';
import { responderConAnimacion } from '~/utilidades/chatUX';
import { detectarIntencion } from './detectar.intencion';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { flujoRegistro } from './FAQS/bienvenida.flujo';
/**
 * Flow para manejar notas de voz
 * Transcribe el audio y genera una respuesta
 */
export const flujoNotasDeVoz = addKeyword(EVENTS.VOICE_NOTE)
    .addAction(async (ctx, { flowDynamic, provider, state, gotoFlow }) => {
        await responderConAnimacion(provider, ctx, '🎧 Escuchando tu nota de voz...');
        let audio: string | null = null;

        try {
            // Crear directorio tmp si no existe
            const directorioTmp = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(directorioTmp)) {
                fs.mkdirSync(directorioTmp, { recursive: true });
                
            }

            audio = path.join(directorioTmp, `audio_${Date.now()}.ogg`);

            // Obtener el buffer del audio
            let buffer: Buffer | null = null;

            // Método 1: Usar saveFile del provider (preferido para Baileys)
            try {
                const archivoGuardado = await provider.saveFile(ctx, { path: directorioTmp });

                if (fs.existsSync(archivoGuardado)) {
                    buffer = fs.readFileSync(archivoGuardado);
                    audio = archivoGuardado;
                }
            } catch (error1) {
                // mensaje error
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Buffer de audio vacío o inválido');
            }

            // Verificar que el archivo existe y tiene contenido
            if (!fs.existsSync(audio)) {
                throw new Error('El archivo de audio no se guardó correctamente');
            }

            // Transcribir el audio
            
            const transcripcion = await transcribeAudio(audio);
           

            if (!transcripcion || transcripcion.trim().length === 0) {
                throw new Error('La transcripción está vacía');
            }
            await state.update({ mensajePorNotaDeVoz: transcripcion });
            // Limpiar archivo temporal
            if (audio) {
                limpiarAudio(audio);
            }

            const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
            const dbPaciente = await instanciaAdaptadorMongo.buscarPacientePorNumero(numeroCelular)
            if (!dbPaciente) {
                return gotoFlow(flujoRegistro)
            } else {
                return gotoFlow(detectarIntencion)
            }

            // Generar respuesta
            /*const respuestaGroq = await generarRespuesta(transcripcion);
            console.log('💬 Respuesta generada:', respuestaGroq);

            // Enviar la respuesta mediante flowDynamic
            await flowDynamic([`${respuestaGroq}`]);*/



        } catch (error) {
            console.error('❌ Error al procesar nota de voz:', error);
            await flowDynamic([
                '❌ Lo siento, hubo un error al procesar tu nota de voz.',
                'Por favor, intenta de nuevo o escribe tu mensaje en texto.'
            ]);

            // Intentar limpiar el archivo si existe
            if (audio && fs.existsSync(audio)) {
                try {
                    limpiarAudio(audio);
                } catch (cleanError) {
                    console.error('⚠️ Error al limpiar archivo:', cleanError);
                }
            }
        }
    });
