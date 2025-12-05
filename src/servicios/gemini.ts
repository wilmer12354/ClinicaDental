import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GeminiService(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }

    console.log("ENTRANDO A GEMINI.TS")
    
    // Usar modelo válido y systemInstruction
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40,
      },
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(userMessage);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Respuesta vacía de Gemini');
    }

    console.log("✅ Respuesta generada correctamente");
    return text;

  } catch (error) {
    console.error("❌ Error al generar respuesta con Gemini:", error);
    return "Lo siento, ocurrió un error al procesar tu solicitud.";

  }
}

/*
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GeminiService(
  systemPrompt: string, 
  userMessage: string, 
  type: string = 'default'
): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }

    // Configurar el modelo con parámetros de generación
    const modelo = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40,
      },
      systemInstruction: systemPrompt,  // ✅ Aquí va el system prompt sin gastar tokens extra
    });

    // Enviar directamente el mensaje del usuario
    const result = await modelo.generateContent(userMessage);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Respuesta vacía de Gemini');
    }

    return text;

  } catch (error) {
    console.error("Error al generar respuesta con Gemini:", error);
    return "Lo siento, ocurrió un error al procesar tu solicitud.";
  }
}

*/