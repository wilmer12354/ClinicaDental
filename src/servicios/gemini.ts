import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Lee hasta 3 llaves para hacer failover: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean) as string[];

async function generarConLlave(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150,
      topP: 0.95,
      topK: 40
    },
    systemInstruction: systemPrompt
  });

  const result = await model.generateContent(userMessage);
  const response = await result.response;
  const text = response.text();

  if (!text) {
    throw new Error("Respuesta vacía de Gemini");
  }

  return text;
}

export async function GeminiService(systemPrompt: string, userMessage: string): Promise<string> {
  if (!GEMINI_KEYS.length) {
    console.error("❌ No hay llaves configuradas para Gemini (GEMINI_API_KEY[_2][_3])");
    return "Lo siento, ocurrió un error al procesar tu solicitud.";
  }

  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const apiKey = GEMINI_KEYS[i];
    try {
      return await generarConLlave(apiKey, systemPrompt, userMessage);
    } catch (error) {
      console.error(`❌ Error con Gemini API key #${i + 1}:`, error);
      // intenta con la siguiente llave si existe
    }
  }

  // Si todas fallan
  return "Lo siento, ocurrió un error al procesar tu solicitud.";
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