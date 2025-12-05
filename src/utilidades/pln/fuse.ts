import Fuse from 'fuse.js';

// 🔑 Palabras clave por intención (estructura para Fuse.js)
import { KEYWORDS_DATA } from '../palabras';

// Configurar Fuse.js para búsqueda difusa
const fuse = new Fuse(KEYWORDS_DATA, {
  keys: ['keyword'],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2, // ✨ Bajado de 3 a 2 para palabras cortas
});

/**
 * 🔍 Normalizar texto quitando tildes y caracteres especiales
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s]/g, ''); // Quitar caracteres especiales
}

/**
 * 🎯 Detectar intención usando Fuse.js
 * 
 * @param message - Mensaje del usuario
 * @returns Intención detectada o null
 */
function detectarIntencionPorFuse(message: string): string | null {
  const normalizedMessage = normalizeText(message);

  console.log(`🔎 Analizando: "${message}" → Normalizado: "${normalizedMessage}"`);

  // Buscar coincidencias fuzzy
  const results = fuse.search(normalizedMessage);

  if (results.length > 0) {
    const bestMatch = results[0];
    const score = bestMatch.score || 1;
    const confidence = ((1 - score) * 100).toFixed(0);

    console.log(`🎯 Mejor match: "${bestMatch.item.keyword}" → ${bestMatch.item.intention} (${confidence}% confianza, score: ${score.toFixed(3)})`);

    // Si la confianza es aceptable
    if (score < 0.5) {
      return bestMatch.item.intention;
    } else {
      console.log(`⚠️ Confianza muy baja (${confidence}%), no se acepta el match`);
    }
  } else {
    console.log('❌ No se encontraron matches');
  }

  // 🔥 ESTRATEGIA ALTERNATIVA: Buscar palabras clave individuales
  // Si Fuse no encuentra match, buscar keywords simples en el mensaje
  console.log('🔄 Intentando búsqueda por palabras clave individuales...');

  const wordMatches = KEYWORDS_DATA.filter(item => {
    const normalizedKeyword = normalizeText(item.keyword);
    return normalizedMessage.includes(normalizedKeyword);
  });

  if (wordMatches.length > 0) {
    // Agrupar por intención y contar coincidencias
    const intentionCounts = wordMatches.reduce((acc, item) => {
      acc[item.intention] = (acc[item.intention] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Obtener la intención con más coincidencias
    const bestIntention = Object.entries(intentionCounts)
      .sort(([, a], [, b]) => b - a)[0];

    console.log(`✅ Match por palabra clave: ${bestIntention[0]} (${bestIntention[1]} coincidencias)`);
    return bestIntention[0];
  }

  console.log('❌ No se pudo detectar ninguna intención');
  return null;
}

export { detectarIntencionPorFuse, fuse, KEYWORDS_DATA };