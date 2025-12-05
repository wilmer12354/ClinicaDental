// src/utils/validators.ts

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
    'prueba', 'ejemplo', 'admin', 'user', 'si', 'no', 'ok', 'bien'
  ];

  const nombreMin = nombreLimpio.toLowerCase();
  for (const prohibida of palabrasProhibidas) {
    if (nombreMin === prohibida || palabras.some(p => p.toLowerCase() === prohibida)) {
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

///

export const nombreValido = (name: string): boolean => {
  const trimmedName = name.trim();
  
  // Longitud mínima y máxima
  if (trimmedName.length < 2 || trimmedName.length > 50) return false;
  
  // Debe contener al menos una letra
  if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(trimmedName)) return false;
  
  // Solo puede contener letras, espacios, guiones y apóstrofes
  const validPattern = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s'-]+$/;
  if (!validPattern.test(trimmedName)) return false;
  
  // No debe tener más de un espacio consecutivo
  if (/\s{2,}/.test(trimmedName)) return false;
  
  // No debe comenzar o terminar con caracteres especiales
  if (/^[-'\s]|[-'\s]$/.test(trimmedName)) return false;
  
  // No debe ser solo un carácter repetido (ej: "aaaa", "bbbbb")
  if (/^(.)\1+$/.test(trimmedName.replace(/\s/g, ''))) return false;
  
  // Detectar patrones repetitivos cortos (ej: "asdasdasd", "ababab", "121212")
  const cleanName = trimmedName.toLowerCase().replace(/[\s'-]/g, '');
  
  // Detectar si hay demasiados caracteres iguales en proporción
  const charCount = new Map<string, number>();
  for (const char of cleanName) {
    charCount.set(char, (charCount.get(char) || 0) + 1);
  }
  
  // Si algún carácter aparece más del 40% del total, probablemente es spam
  const maxFrequency = Math.max(...charCount.values());
  if (maxFrequency / cleanName.length > 0.4) return false;
  
  // Detectar patrones de 2-4 caracteres que se repiten
  for (let patternLength = 2; patternLength <= 4; patternLength++) {
    if (cleanName.length >= patternLength * 3) {
      const pattern = cleanName.slice(0, patternLength);
      const repeated = pattern.repeat(Math.floor(cleanName.length / patternLength));
      
      // Si el patrón repetido cubre más del 80% del nombre, es sospechoso
      if (cleanName.startsWith(repeated.slice(0, Math.floor(cleanName.length * 0.5)))) {
        return false;
      }
    }
  }
  
  // Verificar que tenga una variedad mínima de caracteres únicos
  // Para nombres cortos (< 5 chars) al menos 2 caracteres diferentes
  // Para nombres más largos, al menos 3
  const uniqueChars = new Set(cleanName).size;
  if (cleanName.length < 5 && uniqueChars < 2) return false;
  if (cleanName.length >= 5 && uniqueChars < 3) return false;
  
  return true;
};
export const correoValido = (email: string): boolean => {
  // Lista de dominios permitidos
  const allowedDomains = [
    "gmail.com",
    "hotmail.com",
    "outlook.com"
  ];

  const trimmed = email.trim().toLowerCase();

  // Validación básica del email
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!regex.test(trimmed)) return false;

  const [localPart, domain] = trimmed.split('@');

  // Validaciones extra para mayor seguridad
  if (!localPart || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;
  if (!domain.includes(".")) return false;
  if (domain.includes("..")) return false;

  // ✅ Se valida si el dominio está permitido
  return allowedDomains.includes(domain);
};


export const descripcionValida = (description: string): boolean => {
  const trimmedDesc = description.trim();
  
  // Longitud mínima y máxima
  if (trimmedDesc.length < 5 || trimmedDesc.length > 500) return false;
  
  // Debe contener al menos una letra
  if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(trimmedDesc)) return false;
  
  // No debe ser solo caracteres repetidos
  const withoutSpaces = trimmedDesc.replace(/\s/g, '');
  if (withoutSpaces.length > 0 && /^(.)\1+$/.test(withoutSpaces)) return false;
  
  // No debe tener más de 3 caracteres iguales consecutivos
  if (/(.)\1{3,}/.test(trimmedDesc)) return false;
  
  return true;
};
export const comandoCancelar = (input: string): boolean => {
  const normalized = input.toLowerCase().trim();
  
  // Lista de comandos de cancelación
  const comandos_Cancelar = [
    'cancelar',
    'salir',
    'abortar',
    'exit',
    'quit',
    'cancel',
    'stop',
    'back',
    'volver',
    'atras',
    'atrás',
    'cerrar',
    'terminar',
    'parar',
    'nope',
    'nah',
    'nada',
    'ninguno',
    'ninguna'
  ];
  
  // Coincidencia exacta
  if (comandos_Cancelar.includes(normalized)) return true;
  
  // Variaciones con espacios o signos
  if (comandos_Cancelar.some(cmd => normalized === cmd.replace(/\s/g, ''))) return true;
  
  // Comandos cortos específicos (solo si son exactos para evitar falsos positivos)
  const shortCommands = ['n', 'q', 'x'];
  if (normalized.length === 1 && shortCommands.includes(normalized)) return true;
  
  // Detectar respuestas negativas enfáticas
  if (/^no+[!.]*$/i.test(normalized)) return true; // "nooo", "no!", "no!!"
  
  return false;
};