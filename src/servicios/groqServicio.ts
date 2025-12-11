import Groq from 'groq-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';


dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


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


export const transcribeAudio = async (audioPath: string): Promise<string> => {
    let rutaConvertida: string | null = null;
    
    try {
        
        if (!fs.existsSync(audioPath)) {
            throw new Error(`El archivo no existe: ${audioPath}`);
        }
        rutaConvertida = await convertirAudio_MP3(audioPath);
        
        if (!fs.existsSync(rutaConvertida)) {
            throw new Error('El archivo convertido no se generó correctamente');
        }


        const audioFile = fs.createReadStream(rutaConvertida);
        
        const transcripcion = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3',
            language: 'es', 
            response_format: 'json',
            temperature: 0.0
        });

       
        
        
        if (rutaConvertida && fs.existsSync(rutaConvertida)) {
            fs.unlinkSync(rutaConvertida);
            
        }
        
        return transcripcion.text;

    } catch (error) {
        console.error('❌ Error en transcripción:', error);
        
        
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
        
        // ⭐ RESTAR 1 DÍA para compensar el bug
        const ahoraAjustado = new Date(ahora);
        ahoraAjustado.setDate(ahoraAjustado.getDate() - 1);
        
        const fechaHoy = ahoraAjustado.toISOString().split('T')[0];
        const diaSemana = ahoraAjustado.toLocaleDateString('es-ES', { weekday: 'long' });
        
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Extrae datos de citas médicas en JSON.

HOY: ${fechaHoy} (${diaSemana})

Formato de salida:
{
  "nombre": "string o null",
  "email": "string o null",
  "telefono": "solo números o null",
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM en formato 24h",
  "motivo": "string o null"
}

Fechas relativas:
- hoy = ${fechaHoy}
- mañana = +1 día
- próximo [día] = calcular desde ${fechaHoy}

Solo JSON, sin markdown.`
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
        const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : respuesta;
        
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('❌ Error al extraer datos con Groq:', error);
        throw new Error('No pude extraer los datos de la cita');
    }
};
