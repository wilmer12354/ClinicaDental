import Groq from 'groq-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';

// Cargar variables de entorno
dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Convierte un archivo de audio a formato MP3 compatible con Groq
 * @param inputPath - Ruta del archivo de entrada
 * @returns Ruta del archivo convertido
 */
const convertirAudio_MP3 = async (inputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const rutaSalida = inputPath.replace(/\.[^.]+$/, '.mp3');
        ffmpeg(inputPath)
            .toFormat('mp3')
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .audioChannels(1)
            .audioFrequency(16000)
            
            .on('end', () => {
                
                resolve(rutaSalida);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('❌ Error en conversión:', err.message);
                console.error('📋 stdout:', stdout);
                console.error('📋 stderr:', stderr);
                reject(new Error(`Error al convertir audio: ${err.message}`));
            })
            .save(rutaSalida);
    });
};

/**
 * Transcribe un archivo de audio usando Groq Whisper
 * @param audioPath - Ruta del archivo de audio
 * @returns Texto transcrito
 */
export const transcribeAudio = async (audioPath: string): Promise<string> => {
    let rutaConvertida: string | null = null;
    
    try {
        
        
        // Verificar que el archivo existe
        if (!fs.existsSync(audioPath)) {
            throw new Error(`El archivo no existe: ${audioPath}`);
        }
        // Convertir el audio a MP3
        rutaConvertida = await convertirAudio_MP3(audioPath);
        
        // Verificar que el archivo convertido existe
        if (!fs.existsSync(rutaConvertida)) {
            throw new Error('El archivo convertido no se generó correctamente');
        }

        // Leer el archivo de audio convertido
        const audioFile = fs.createReadStream(rutaConvertida);
        
        // Realizar la transcripción
        
        const transcripcion = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3',
            language: 'es', // Español
            response_format: 'json',
            temperature: 0.0
        });

       
        
        // Limpiar archivo convertido
        if (rutaConvertida && fs.existsSync(rutaConvertida)) {
            fs.unlinkSync(rutaConvertida);
            
        }
        
        return transcripcion.text;

    } catch (error) {
        console.error('❌ Error en transcripción:', error);
        
        // Limpiar archivo convertido en caso de error
        if (rutaConvertida && fs.existsSync(rutaConvertida)) {
            try {
                fs.unlinkSync(rutaConvertida);
            } catch (cleanError) {
                console.error('⚠️ Error al limpiar archivo convertido:', cleanError);
            }
        }
        
        throw new Error(`Error al transcribir audio: ${error.message}`);
    }
};

/**
 * Limpia archivos temporales de audio
 * @param audioPath - Ruta del archivo a eliminar
 */
export const limpiarAudio = (audioPath: string): void => {
    try {
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
            
        }
    } catch (error) {
        console.error('⚠️  Error al eliminar archivo temporal:', error);
    }
};

/**
 * Genera una respuesta usando Groq
 * @param text - Texto transcrito
 * @returns Respuesta generada
 */
export const generarRespuesta = async (text: string): Promise<string> => {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente útil y amigable. Responde de manera clara y concisa en español.'
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            model: 'llama-3.3-70b-versatile',
            /*model: 'llama-3.1-8b-instant'*/
            temperature: 0.7,
            max_tokens: 1024
        });

        return completion.choices[0]?.message?.content || 'No pude generar una respuesta.';
    } catch (error) {
        console.error('❌ Error al generar respuesta:', error);
        throw new Error(`Error al generar respuesta: ${error.message}`);
    }
};


export const extraerDatosCita = async (texto: string): Promise<any> => {
    try {
        // Obtener fecha y hora actual
        const ahora = new Date();
        const fechaHoy = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
        const horaActual = ahora.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        const diaSemana = ahora.toLocaleDateString('es-ES', { weekday: 'long' });
        
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente que extrae información de citas médicas. 
                    Debes extraer: nombre del paciente, email, teléfono, fecha, hora y motivo.
                    
                    CONTEXTO TEMPORAL:
                    - HOY es: ${fechaHoy} (${diaSemana})
                    - Hora actual: ${horaActual}
                    
                    IMPORTANTE:
                    - La fecha debe estar en formato ISO: YYYY-MM-DD
                    - La hora en formato 24h: HH:MM
                    - Si no encuentras algún dato, devuelve null para ese campo
                    - El teléfono debe ser solo números
                    
                    INTERPRETACIÓN DE FECHAS RELATIVAS:
                    - "hoy" = ${fechaHoy}
                    - "mañana" = calcula sumando 1 día a ${fechaHoy}
                    - "pasado mañana" = calcula sumando 2 días a ${fechaHoy}
                    - "próximo lunes/martes/etc" = calcula el siguiente día de la semana desde ${fechaHoy}
                    - "en 3 días" = calcula sumando los días correspondientes
                    
                    Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown:
                    {
                        "nombre": "string",
                        "email": "string",
                        "telefono": "string",
                        "fecha": "YYYY-MM-DD",
                        "hora": "HH:MM",
                        "motivo": "string"
                    }`
                },
                {
                    role: 'user',
                    content: texto
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 500
        });

        const respuesta = completion.choices[0]?.message?.content || '{}';
        
        // Limpiar la respuesta por si tiene texto extra o markdown
        const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : respuesta;
        
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('❌ Error al extraer datos con Groq:', error);
        throw new Error('No pude extraer los datos de la cita');
    }
};
