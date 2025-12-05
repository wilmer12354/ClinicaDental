import Groq from "groq-sdk";
import {config} from "../configuracion";
import fs from "fs";

const groqApi = config.groq_apikey;

export const voice2text = async (path: string): Promise<string> => {
    if (!groqApi) {
        throw new Error("GROQ_API_KEY no está configurada");
    }
    if(!fs.existsSync(path)){
        throw new Error("No se encuentra el archivo");
    }
    try {
        const groq = new Groq({
            apiKey: groqApi,
        });
        
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(path),
            model: "whisper-large-v3", // Modelo de Groq para transcripción
        });
        
        return transcription.text;

    } catch(error) {
        console.log("Error en transcripción:", error);
        return "Error";
    }
}