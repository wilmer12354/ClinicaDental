// src/utilidades/correctorOrtografia.ts

export async function corregirOrtografia(texto: string): Promise<string> {
  try {
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: texto,
        language: 'es-ES',

      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    let textoCorregido = texto;

    // Aplicar correcciones de atrás hacia adelante
    const matches = data.matches.sort((a: any, b: any) => b.offset - a.offset);

    for (const match of matches) {
      if (match.replacements && match.replacements.length > 0) {
        const inicio = match.offset;
        const fin = match.offset + match.length;
        const reemplazo = match.replacements[0].value;

        textoCorregido =
          textoCorregido.substring(0, inicio) +
          reemplazo +
          textoCorregido.substring(fin);
      }
    }

    return textoCorregido;
  } catch (error) {
    console.error('❌ Error al corregir ortografía:', error);
    return texto; // Devolver original si falla
  }
}