/**
 * Obtiene el número de teléfono del contexto, priorizando el que empieza con '591'
 * @param ctx - Contexto del mensaje
 * @returns Número de teléfono formateado
 */
export function obtenerNumeroTelefono(ctx: any): string {
    // Obtener ambos posibles números
    const numero1 = (ctx.key?.remoteJid || '').split('@')[0];
    const numero2 = ctx.from?.split('@')[0] || '';
    
    // Priorizar el número que empieza con 591, si no hay ninguno, usar el primero disponible
    return numero1.startsWith('591') ? numero1 : 
           (numero2.startsWith('591') ? numero2 : (numero1 || numero2));
}

