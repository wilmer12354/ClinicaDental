// src/utilidades/validarNombre.ts

/**
 * Valida nombres usando patrones lingüísticos en lugar de listas
 */
export function esNombreValido(nombre: string): { valido: boolean; razon?: string } {
  const nombreLimpio = nombre.trim();

  // 1. Validaciones básicas
  if (!nombreLimpio) {
    return { valido: false, razon: 'El nombre no puede estar vacío' };
  }

  if (nombreLimpio.length < 2) {
    return { valido: false, razon: 'El nombre es demasiado corto' };
  }

  if (nombreLimpio.length > 60) {
    return { valido: false, razon: 'El nombre es demasiado largo' };
  }

  // 2. Solo letras, espacios, acentos y guiones
  const patronNombre = /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s'-]+$/;
  if (!patronNombre.test(nombreLimpio)) {
    return { valido: false, razon: 'El nombre solo puede contener letras' };
  }

  // 3. Palabras del nombre
  const palabras = nombreLimpio.split(/\s+/).filter(p => p.length > 0);
  
  if (palabras.length === 0) {
    return { valido: false, razon: 'Ingresa tu nombre' };
  }

  if (palabras.length > 5) {
    return { valido: false, razon: 'Por favor ingresa solo tu nombre (máximo 5 palabras)' };
  }

  // 4. Validar cada palabra individualmente
  for (const palabra of palabras) {
    const validacionPalabra = validarPalabraNombre(palabra);
    if (!validacionPalabra.valido) {
      return validacionPalabra;
    }
  }

  // 5. Lista negra PEQUEÑA solo de palabras obvias que NO son nombres
  const palabrasProhibidas = [
    'hola', 'buenas', 'noches', 'dias', 'tardes', 'hotel', 'test',
    'prueba', 'ejemplo', 'admin', 'user', 'si', 'no', 'ok', 'bien',
    'jkuil', 'asdf', 'qwerty', 'xyz', 'abc', 'klok'
  ];

  const nombreMin = nombreLimpio.toLowerCase();
  for (const prohibida of palabrasProhibidas) {
    if (nombreMin === prohibida || palabras.some(p => p.toLowerCase() === prohibida)) {
      return { valido: false, razon: 'Por favor ingresa tu nombre real' };
    }
  }

  // 6. Detectar patrones de teclado aleatorio
  const patronesAleatorios = [
    /^[qwerty]{4,}$/i,     // qwerty, qwe, etc
    /^[asdfgh]{4,}$/i,     // asdf, asd, etc
    /^[zxcvbn]{4,}$/i,     // zxcv, etc
    /^[jkl]{3,}$/i,        // jkl, jklm, etc
    /^(.)(?!\1)[a-z]\1/i,  // patrones como aba, cdc
  ];

  for (const patron of patronesAleatorios) {
    if (patron.test(nombreMin)) {
      return { valido: false, razon: 'Por favor ingresa tu nombre real' };
    }
  }

  return { valido: true };
}

/**
 * Valida patrones lingüísticos de una palabra individual
 */
function validarPalabraNombre(palabra: string): { valido: boolean; razon?: string } {
  const palabraMin = palabra.toLowerCase();

  // Mínimo 2 caracteres
  if (palabra.length < 2) {
    return { valido: false, razon: 'Cada parte del nombre debe tener al menos 2 letras' };
  }

  // Debe tener al menos una vocal
  const vocales = (palabraMin.match(/[aeiouáéíóúü]/g) || []).length;
  if (vocales === 0) {
    return { valido: false, razon: 'El nombre debe contener vocales' };
  }

  // No puede ser todo vocales o todo consonantes
  const consonantes = (palabraMin.match(/[bcdfghjklmnpqrstvwxyzñ]/g) || []).length;
  if (vocales === 0 || consonantes === 0) {
    return { valido: false, razon: 'El nombre no tiene una estructura válida' };
  }

  // Proporción razonable vocales/consonantes (entre 0.2 y 5.0)
  const proporcion = vocales / consonantes;
  if (proporcion < 0.2 || proporcion > 5.0) {
    return { valido: false, razon: 'El nombre no parece válido' };
  }

  // No más de 3 letras iguales consecutivas
  if (/(.)\1{3,}/.test(palabra)) {
    return { valido: false, razon: 'El nombre contiene caracteres repetidos inválidos' };
  }

  // No más de 4 consonantes consecutivas (en español es raro)
  if (/[bcdfghjklmnpqrstvwxyzñ]{5,}/i.test(palabra)) {
    return { valido: false, razon: 'El nombre tiene una estructura inusual' };
  }

  // No más de 3 vocales consecutivas (en español nombres comunes)
  if (/[aeiouáéíóúü]{4,}/i.test(palabraMin)) {
    return { valido: false, razon: 'El nombre tiene una estructura inusual' };
  }

  return { valido: true };
}

/**
 * Formatea nombre: Primera letra mayúscula
 */
export function formatearNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

// Importar el SDK de Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * OPCIÓN AVANZADA: Validación con IA (Gemini) - Versión optimizada con SDK
 * Retorna un objeto con flag de si usó IA o reglas
 */
export async function validarNombreConIA(nombre: string): Promise<{ valido: boolean; razon?: string; usoIA?: boolean }> {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY no configurada, usando validación por reglas');
      return { ...esNombreValido(nombre), usoIA: false };
    }

    console.log(`🤖 Validando nombre con Gemini: "${nombre}"`);

    // Configurar modelo con instrucciones del sistema
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2, // Un poco más de flexibilidad
        maxOutputTokens: 10,
        topP: 0.8,
        topK: 40
      },
      systemInstruction: `Eres un validador de nombres de personas. 
INSTRUCCIONES:
1. ACEPTA: Cualquier nombre real de persona, incluso si es poco común
2. RECHAZA: Palabras sin sentido, combinaciones de teclado aleatorias (asdf, jkuil, qwerty), números, o palabras comunes que no son nombres.

RESPONDE EXACTAMENTE UNA DE ESTAS OPCIONES:
- SI: Si es un nombre válido
- NO: Si no es un nombre válido`
    });

    // Prompt simplificado
    const prompt = `¿"${nombre}" es un nombre de persona? Responde solo: SI o NO`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Mejor manejo de la respuesta
    let textoRespuesta = '';
    try {
        textoRespuesta = (await response.text() || '').trim().toUpperCase();
    } catch (error) {
        console.error('Error al obtener texto de la respuesta:', error);
        // Si hay error al obtener el texto, forzar validación por reglas
        return { ...esNombreValido(nombre), usoIA: false };
    }

    console.log(`📝 Respuesta de Gemini: "${textoRespuesta}"`);

    // Si la respuesta está vacía, usar validación por reglas
    if (!textoRespuesta) {
        console.warn('⚠️ Respuesta vacía de Gemini, usando validación por reglas');
        return { ...esNombreValido(nombre), usoIA: false };
    }

    // Parsear respuesta simple - más flexible
    const esValido = /\b(SI|S[ÍI]|YES|VERDADERO|TRUE|OK)\b/i.test(textoRespuesta);

    console.log(`✅ Validación con IA: "${nombre}" → ${esValido ? 'VÁLIDO ✓' : 'RECHAZADO ✗'}`);

    return {
      valido: esValido,
      razon: esValido ? undefined : 'Por favor ingresa tu nombre real',
      usoIA: true
    };

  } catch (error) {
    console.warn('⚠️ Error con Gemini, usando validación básica:', error);
    // FALLBACK automático a reglas
    return { ...esNombreValido(nombre), usoIA: false };
  }
}

/**
 * Validación híbrida: Reglas + IA (recomendado)
 */
export async function validarNombreCompleto(
  nombre: string,
  opciones: { usarIA?: boolean } = { usarIA: true }
): Promise<{ valido: boolean; razon?: string; nombreFormateado?: string }> {
  
  // Primero validación rápida por reglas
  const validacionBasica = esNombreValido(nombre);
  
  if (!validacionBasica.valido) {
    return validacionBasica;
  }

  // Si pasó las reglas básicas y se habilitó IA, validar con IA
  if (opciones.usarIA) {
    const validacionIA = await validarNombreConIA(nombre);
    
    if (!validacionIA.valido) {
      return validacionIA;
    }
  }

  return {
    valido: true,
    nombreFormateado: formatearNombre(nombre)
  };
}