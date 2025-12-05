// src/utils/dateTime.ts

import * as chrono from 'chrono-node';
import { config } from '../../configuracion/index';
import { obtenerMensaje } from '../mensajesDiferentes';

// ===========================
// UTILIDADES BÁSICAS
// ===========================

export const horaBolivia = (): Date => {
  return new Date();
};

export const formatearFechaHora = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return date.toLocaleDateString('es-ES', options);
};

// ===========================
// INTERFACES
// ===========================

export interface ParseResult {
  success: boolean;
  date?: Date;
  message?: string;
  needsTime?: boolean;
  needsDate?: boolean;
  partialDate?: Date;
  partialHour?: number;
  partialMinute?: number;
}

// ===========================
// CORRECCIÓN DE ERRORES TIPOGRÁFICOS
// ===========================

const PALABRAS_COMUNES = [
  // Días de la semana
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
  // Temporales
  'hoy', 'mañana', 'manana', 'pasado', 'próximo', 'proximo', 'siguiente',
  // Meses
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  // Horas
  'tarde', 'mañana', 'manana', 'noche', 'madrugada', 'mediodía', 'mediodia',
  // Preposiciones temporales
  'para', 'el', 'la', 'los', 'las', 'a', 'de'
];

/**
 * Mapeo de números escritos en español a dígitos
 */
const NUMEROS_ESCRITOS: { [key: string]: string } = {
  'cero': '0',
  'uno': '1',
  'dos': '2',
  'tres': '3',
  'cuatro': '4',
  'cinco': '5',
  'seis': '6',
  'siete': '7',
  'ocho': '8',
  'nueve': '9',
  'diez': '10',
  'once': '11',
  'doce': '12',
  'trece': '13',
  'catorce': '14',
  'quince': '15',
  'dieciséis': '16',
  'dieciseis': '16',
  'diecisiete': '17',
  'dieciocho': '18',
  'diecinueve': '19',
  'veinte': '20',
  'veintiuno': '21',
  'veintidós': '22',
  'veintidos': '22',
  'veintitrés': '23',
  'veintitres': '23',
  'veinticuatro': '24'
};

/**
 * Convierte números escritos en palabras a dígitos y expresiones especiales
 */
const convertirNumerosEscritos = (texto: string): string => {
  let resultado = texto;
  const textoLower = texto.toLowerCase();
  
  // Detectar y convertir "mediodía" o "medio día" a "12:00"
  const mediodiaRegex = /\b(medio\s*d[ií]a|mediod[ií]a)\b/gi;
  if (mediodiaRegex.test(textoLower)) {
    console.log(`🕐 Convirtiendo mediodía a 12:00`);
    resultado = resultado.replace(mediodiaRegex, '12:00');
  }
  
  // Reemplazar cada número escrito encontrado
  for (const [numeroEscrito, numero] of Object.entries(NUMEROS_ESCRITOS)) {
    // Usar regex con límites de palabra para reemplazar solo palabras completas
    const regex = new RegExp(`\\b${numeroEscrito}\\b`, 'gi');
    if (regex.test(textoLower)) {
      console.log(`🔢 Convirtiendo número escrito: "${numeroEscrito}" → "${numero}"`);
      resultado = resultado.replace(regex, numero);
    }
  }
  
  return resultado;
};

/**
 * 1. -Función pública para corregir texto completo (exportable)
 */
export const corregirTextoCompleto = (texto: string): string => {
  return corregirTexto(texto);
};

/**
 * 2. Corrige errores tipográficos comunes en el texto
 */
const corregirTexto = (texto: string): string => {
  const palabras = texto.toLowerCase().split(/\s+/);
  const palabrasCorregidas = palabras.map(palabra => {
    // Si la palabra es muy corta o es un número, no corregir
    if (palabra.length < 3 || /^\d+$/.test(palabra)) return palabra;

    // Buscar la palabra más similar
    let mejorMatch = palabra;
    let mejorSimilitud = 0;

    for (const palabraComun of PALABRAS_COMUNES) {
      const similitud = calcularSimilitud(palabra, palabraComun);

      // Umbral más bajo (0.6 = 60%) para ser más permisivo
      if (similitud > mejorSimilitud && similitud > 0.6) {
        mejorSimilitud = similitud;
        mejorMatch = palabraComun;
      }
    }

    if (mejorMatch !== palabra) {
      console.log(`✏️ Corrección: "${palabra}" → "${mejorMatch}" (${(mejorSimilitud * 100).toFixed(0)}% similitud)`);
    }

    return mejorMatch;
  });

  const resultado = palabrasCorregidas.join(' ');
  if (resultado !== texto.toLowerCase()) {
    console.log(`📝 Texto corregido completo: "${texto}" → "${resultado}"`);
  }
  return resultado;
};

/**
 * 3. -Calcula la similitud entre dos strings (0 a 1)
 */
const calcularSimilitud = (str1: string, str2: string): number => {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
};
/**
 * 4.- Calcula la distancia de Levenshtein entre dos strings
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
};





// ===========================
// FUNCIONES DE PARSEO
// ===========================

/**
 * Analiza un string y extrae fecha y/o hora usando Chrono
 */
export const analizarFechaHora = (input: string): ParseResult => {
  try {
    const boliviaTime = horaBolivia();

    // Convertir números escritos a dígitos antes de procesar
    const inputConNumeros = convertirNumerosEscritos(input);
    console.log(`🔢 Input después de convertir números: "${input}" → "${inputConNumeros}"`);

    // Primer intento: parseo directo
    let results = chrono.es.parse(inputConNumeros, boliviaTime);

    // Si falla, intentar con corrección de texto
    if (results.length === 0) {
      const textoCorregido = corregirTexto(inputConNumeros);

      // Si hubo correcciones, intentar parsear de nuevo
      if (textoCorregido !== inputConNumeros.toLowerCase()) {
        console.log(`🔄 Reintentando con texto corregido: "${textoCorregido}"`);
        results = chrono.es.parse(textoCorregido, boliviaTime);
      }

      // Si aún no hay resultados, retornar error
      if (results.length === 0) {
        return {
          success: false,
          message: 'No pude entender la fecha y hora.\n\n📝 Ejemplos válidos:\n• "hoy a las 6 PM"\n• "mañana a las 2:30 de la tarde"\n• "el lunes a las 10 AM"\n• "tres de la tarde"'
        };
      }
    }

    const result = results[0];
const parsedDate = result.start.date();

    let tieneHora = result.start.isCertain('hour');
    const tieneFecha = result.start.isCertain('day') ||
      result.start.isCertain('weekday') ||
      result.start.isCertain('month');

    // Detectar mediodía explícitamente
    const inputLower = input.toLowerCase();
    const esMediodia = /\b(medio\s*d[ií]a|mediod[ií]a)\b/.test(inputLower);
    
    if (esMediodia) {
      console.log(`🕐 Detectado mediodía, estableciendo hora a 12:00`);
      parsedDate.setHours(12);
      parsedDate.setMinutes(0);
      parsedDate.setSeconds(0);
      parsedDate.setMilliseconds(0);
      tieneHora = true; // Marcar que tiene hora cuando se detecta mediodía
    }

    // Corrección de AM/PM para español
    if (tieneHora && !esMediodia) {
      const hour = result.start.get('hour');
      
      // Detectar indicadores de tarde/noche en español
      const esTarde = /\b(tarde|pm|p\.m\.)\b/.test(inputLower);
      const esNoche = /\b(noche)\b/.test(inputLower);
      const esMañana = /\b(mañana|madrugada|am|a\.m\.)\b/.test(inputLower);
      
      // Si la hora es menor a 12 y hay indicador de tarde/noche, convertir a formato 24h
      if (hour > 0 && hour < 12) {
        if (esTarde || esNoche) {
          console.log(`🔄 Corrigiendo hora: ${hour}:00 → ${hour + 12}:00 (detectado: ${esTarde ? 'tarde' : 'noche'})`);
          parsedDate.setHours(hour + 12);
        }
      }
      // Si es hora 12 y dice "mañana", convertir a 0 (medianoche) o mantener como mediodía
      else if (hour === 12 && esMañana) {
        // "12 de la mañana" = mediodía (12:00 PM), no cambiar
        // Esto es correcto en español
      }
    }

    console.log('🔍 Chrono Parse:', {
      input,
      tieneHora,
      tieneFecha,
      hour: result.start.get('hour'),
      minute: result.start.get('minute'),
      parsedDate
    });

    // Caso 1: Tiene fecha Y hora completa
    if (tieneFecha && tieneHora) {
      return validarFechaHoraCompleta(parsedDate, boliviaTime);
    }

    
    const mensajePedirHora = obtenerMensaje('cita', 'pedir_hora');
    const mensajePedirDia = obtenerMensaje('cita', 'pedir_dia');


    // Caso 2: Solo fecha
    if (tieneFecha && !tieneHora) {
      return {
        success: false,
        needsTime: true,
        partialDate: parsedDate,
        message: mensajePedirHora
      };
    }


    // Caso 3: Solo hora
    if (tieneHora && !tieneFecha) {
      return {
        success: false,
        needsDate: true,
        partialHour: result.start.get('hour'),
        partialMinute: result.start.get('minute') || 0,
        message: mensajePedirDia
      };
    }

    return {
      success: false,
      message: 'Por favor especifica la fecha y hora.\n\n💡 Ejemplo: "mañana a las 3 pm"'
    };

  } catch (error) {
    console.error('❌ Error parsing date:', error);
    return {
      success: false,
      message: 'Error al procesar la fecha. Intenta ser más específico.'
    };
  }
};

/**
 * Combina una fecha con un string de hora
 */
export const combinarFechaHora = (fecha: Date, horaStr: string): Date | null => {
  try {
    const horaStrLower = horaStr.toLowerCase();
    
    // Detectar mediodía explícitamente antes de procesar
    const esMediodia = /\b(medio\s*d[ií]a|mediod[ií]a)\b/.test(horaStrLower);
    
    if (esMediodia) {
      console.log(`🕐 Detectado mediodía en combinarFechaHora, estableciendo hora a 12:00`);
      const nuevaFecha = new Date(fecha);
      nuevaFecha.setHours(12);
      nuevaFecha.setMinutes(0);
      nuevaFecha.setSeconds(0);
      nuevaFecha.setMilliseconds(0);
      return nuevaFecha;
    }
    
    // Convertir números escritos a dígitos antes de procesar
    const horaStrConNumeros = convertirNumerosEscritos(horaStr);
    console.log(`🔢 Hora después de convertir números: "${horaStr}" → "${horaStrConNumeros}"`);
    
    let horaResult = chrono.es.parse(horaStrConNumeros, fecha);

    // Intentar corrección si falla
    if (horaResult.length === 0) {
      const textoCorregido = corregirTexto(horaStrConNumeros);
      if (textoCorregido !== horaStrConNumeros.toLowerCase()) {
        console.log(`🔄 Corrigiendo hora: "${horaStrConNumeros}" → "${textoCorregido}"`);
        horaResult = chrono.es.parse(textoCorregido, fecha);
      }
    }

    if (horaResult.length === 0 || !horaResult[0].start.isCertain('hour')) {
      return null;
    }

    const nuevaFecha = new Date(fecha);
    let hour = horaResult[0].start.get('hour');
    const minute = horaResult[0].start.get('minute') || 0;
    
    // Corrección de AM/PM para español
    const esTarde = /\b(tarde|pm|p\.m\.)\b/.test(horaStrLower);
    const esNoche = /\b(noche)\b/.test(horaStrLower);
    
    if (hour > 0 && hour < 12 && (esTarde || esNoche)) {
      console.log(`🔄 Corrigiendo hora en combinarFechaHora: ${hour}:00 → ${hour + 12}:00`);
      hour = hour + 12;
    }
    
    nuevaFecha.setHours(hour);
    nuevaFecha.setMinutes(minute);
    nuevaFecha.setSeconds(0);
    nuevaFecha.setMilliseconds(0);

    return nuevaFecha;
  } catch (error) {
    console.error('❌ Error combinando fecha y hora:', error);
    return null;
  }
};

/**
 * Combina una hora con un string de fecha
 */
export const combinarHoraFecha = (hora: number, minuto: number, fechaStr: string): Date | null => {
  try {
    const boliviaTime = horaBolivia();
    
    // Convertir números escritos a dígitos antes de procesar
    const fechaStrConNumeros = convertirNumerosEscritos(fechaStr);
    console.log(`🔢 Fecha después de convertir números: "${fechaStr}" → "${fechaStrConNumeros}"`);
    
    let resultados = chrono.es.parse(fechaStrConNumeros, boliviaTime);

    // Intentar corrección si falla
    if (resultados.length === 0) {
      const textoCorregido = corregirTexto(fechaStrConNumeros);
      if (textoCorregido !== fechaStrConNumeros.toLowerCase()) {
        console.log(`🔄 Corrigiendo fecha: "${fechaStrConNumeros}" → "${textoCorregido}"`);
        resultados = chrono.es.parse(textoCorregido, boliviaTime);
      }
    }

    if (resultados.length === 0) {
      return null;
    }

    const fechaParseada = resultados[0].start.date();
    fechaParseada.setHours(hora);
    fechaParseada.setMinutes(minuto);
    fechaParseada.setSeconds(0);
    fechaParseada.setMilliseconds(0);

    return fechaParseada;
  } catch (error) {
    console.error('❌ Error combinando hora y fecha:', error);
    return null;
  }
};

// ===========================
// VALIDACIONES
// ===========================

/**
 * Valida que una fecha/hora completa cumpla con las reglas de negocio
 */
const validarFechaHoraCompleta = (fecha: Date, referencia: Date): ParseResult => {
  // Validar que no sea pasado
  const advanceTime = new Date(referencia.getTime() + (config.timeAdvance * 60 * 1000));
  if (fecha <= advanceTime) {
    const currentTime = referencia.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      success: false,
      message: `No puedes agendar una cita en el pasado o muy próxima.\n\n⏰ Hora actual: ${currentTime}\n💡 Intenta con al menos ${config.timeAdvance} minutos de anticipación.`
    };
  }

  const hour = fecha.getHours();
  const dayOfWeek = fecha.getDay();

  // Horarios disponibles:
  // Lunes a Viernes: 10:00-13:00 y 15:00-20:00
  // Sábado: 15:00-20:00
  // Domingo: Cerrado

  // Validar domingo
  if (dayOfWeek === 0) {
    return {
      success: false,
      message: '📅 No hay atención los domingos.\n🗓️ Horarios disponibles:\n• Lunes a Viernes: 10:00-13:00 y 15:00-20:00\n• Sábado: 15:00-20:00'
    };
  }

  // Validar horarios según el día
  const esHorarioMatutino = hour >= 10 && hour < 13;
  const esHorarioVespertino = hour >= 15 && hour < 20;

  if (dayOfWeek === 6) { // Sábado
    if (!esHorarioVespertino) {
      return {
        success: false,
        message: '🕰️ Los sábados solo hay atención de 15:00 a 20:00 hrs.'
      };
    }
  } else { // Lunes a Viernes
    if (!esHorarioMatutino && !esHorarioVespertino) {
      return {
        success: false,
        message: '🕰️ Horarios de atención:\n📅 Lunes a Viernes:\n  • Mañana: 10:00 - 13:00\n  • Tarde: 15:00 - 20:00\n📅 Sábado:\n  • Tarde: 15:00 - 20:00'
      };
    }
  }

  return { success: true, date: fecha };
};
/*const validarFechaHoraCompleta = (fecha: Date, referencia: Date): ParseResult => {
  // Validar que no sea pasado
  const advanceTime = new Date(referencia.getTime() + (config.timeAdvance * 60 * 1000));
  if (fecha <= advanceTime) {
    const currentTime = referencia.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      success: false,
      message: `No puedes agendar una cita en el pasado o muy próxima.\n\n⏰ Hora actual: ${currentTime}\n💡 Intenta con al menos ${config.timeAdvance} minutos de anticipación.`
    };
  }

  // Validar horario laboral
  const hour = fecha.getHours();
  if (hour < config.workingHours.start || hour >= config.workingHours.end) {
    return {
      success: false,
      message: `🕰️ Solo puedes agendar citas en horario laboral:\n📅 Lunes a Viernes: ${config.workingHours.start}:00 AM - ${config.workingHours.end}:00 PM`
    };
  }

  // Validar día de semana
  const dayOfWeek = fecha.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      success: false,
      message: '📅 No se pueden agendar citas los fines de semana.\n🗓️ Elige un día de lunes a viernes.'
    };
  }

  return { success: true, date: fecha };
};*/

/**
 * Valida una fecha combinada (usa la validación completa)
 */
export const validarFechaCombinada = (fecha: Date): ParseResult => {
  const boliviaTime = horaBolivia();
  return validarFechaHoraCompleta(fecha, boliviaTime);
};