// utilidades/mensajesDiferentes.ts

/**
 * Sistema de mensajes variados optimizado con búsqueda O(1)
 * Estructura: Map<categoria, Map<subcategoria, mensajes[]>>
 */

type MensajeTemplate = {
    texto: string;
    variables?: string[]; // Variables que acepta: ['nombre', 'fecha', etc]
};

class GestorMensajes {
    private mensajes: Map<string, Map<string, MensajeTemplate[]>>;
    private cache: Map<string, string>; // Cache para mensajes ya procesados

    constructor() {
        this.mensajes = new Map();
        this.cache = new Map();
        this.inicializarMensajes();
    }

    private inicializarMensajes(): void {
        // === FLUJO: SALUDO ===

        this.agregar('saludo', 'repetido_hoy', [
            { texto: 'Hola de nuevo {nombre} 😊 ¿En qué te ayudo ahora?', variables: ['nombre'] },
            { texto: '¡Otra vez por aquí {nombre}! ¿Qué necesitas?', variables: ['nombre'] },
            { texto: 'Te escucho {nombre} 👂 ¿En qué más puedo ayudarte?', variables: ['nombre'] },
            { texto: 'Dime {nombre}, ¿qué más necesitas?', variables: ['nombre'] },
            { texto: 'Aquí estoy {nombre} 😄 ¿Cómo te ayudo?', variables: ['nombre'] }
        ]);

        this.agregar('saludo', 'nuevo_dia', [
            { texto: 'Hola {nombre} 👋 ¿En qué puedo ayudarte hoy?', variables: ['nombre'] },
            { texto: '¡Qué bueno verte {nombre}! ¿Qué necesitas?', variables: ['nombre'] },
            { texto: 'Hola de nuevo {nombre} 😊 ¿Cómo te ayudo hoy?', variables: ['nombre'] },
            { texto: '¡Hola {nombre}! ¿En qué te asisto hoy?', variables: ['nombre'] }
        ]);

        // === FLUJO: REGISTRO PRIMERA VEZ ===
        this.agregar('registrar', 'primera_vez', [
            { texto: '👋 ¡Bienvenido a la Clínica Virgen del Carmen! Antes de empezar, ¿podrías decirme tu nombre?' },
            { texto: '😊 Te damos la bienvenida a la Clínica Virgen del Carmen. Para ayudarte mejor, ¿cuál es tu nombre?' },
            { texto: '✨ Hola y bienvenida/o a la Clínica Virgen del Carmen! ¿Me dices tu nombre para comenzar?' },
            { texto: '🎉 Es un placer darte la bienvenida a la Clínica Virgen del Carmen. ¿Cómo te llamas?' },
            { texto: '🏥 ¡Qué gusto tenerte en la Clínica Virgen del Carmen! Para iniciar, ¿puedes decirme tu nombre?' },
        ]);

        this.agregar('registrar', 'agradecimiento', [
            { texto: '¡Gracias {nombre}! 😄', variables: ['nombre'] },
            { texto: 'Perfecto {nombre}, gracias 😊', variables: ['nombre'] },
            { texto: '¡Listo {nombre}! 🎉', variables: ['nombre'] },
            { texto: 'Excelente {nombre} 👍', variables: ['nombre'] },
            { texto: 'Que bonito nombre {nombre} 👍', variables: ['nombre'] },
        ]);

        // === FLUJO: REGISTRO ===
        this.agregar('registro', 'solicitar_nombre', [
            { texto: '👋 Hola! Antes de comenzar, ¿podrías decirme tu nombre?' },
            { texto: 'Hola 😊 Para ayudarte mejor, ¿cuál es tu nombre?' },
            { texto: '¡Bienvenido! ¿Me dices tu nombre para empezar?' },
            { texto: 'Hola 👋 ¿Cómo te llamas?' }
        ]);

        this.agregar('registro', 'agradecimiento', [
            { texto: '¡Gracias {nombre}! 😄', variables: ['nombre'] },
            { texto: 'Perfecto {nombre}, gracias 😊', variables: ['nombre'] },
            { texto: '¡Listo {nombre}! 🎉', variables: ['nombre'] },
            { texto: 'Excelente {nombre} 👍', variables: ['nombre'] }
        ]);

        // === FLUJO: UBICACIÓN ===
        this.agregar('ubicacion', 'mostrar', [
            { texto: '📍 Estamos ubicados en:' },
            { texto: 'Nuestra ubicación es en:' },
            { texto: 'Nos encontramos en:' },
            { texto: 'Te esperamos en:' },
            { texto: 'Nos puedes encontrar en:' },
            { texto: 'Nuestra dirección es:' },
            { texto: 'Estamos en la siguiente dirección:' },
            { texto: 'Aquí tienes nuestra ubicación:' },
            { texto: 'Te comparto dónde estamos ubicados:' },
            { texto: 'Nos localizas fácilmente en:' },
            { texto: 'Puedes acercarte a:' },
        ]);

        this.agregar('ubicacion', 'confirmar', [
            { texto: 'Perfecto, {ubicacion} 📍' },
            { texto: 'Listo, te agendamos en {ubicacion} ✅' },
            { texto: 'Excelente elección, {ubicacion} 👍' }
        ]);

        this.agregar('ubicacion', 'preguntar_agendar', [
            { texto: '{nombre}, ¿te gustaría agendar una cita? 📅', variables: ['nombre'] },
            { texto: '{nombre}, ¿quieres agendar una cita? ✅', variables: ['nombre'] },
            { texto: '{nombre}, ¿te interesa agendar una cita? 👍', variables: ['nombre'] },
            { texto: '{nombre}, ¿deseas programar una cita? 🗓️', variables: ['nombre'] },
            { texto: '{nombre}, ¿te gustaría que agendemos tu cita? 🤝', variables: ['nombre'] },
            { texto: '{nombre}, ¿quieres que te ayude a programar una cita?', variables: ['nombre'] },
            { texto: '{nombre}, ¿te gustaría reservar una cita? 📘', variables: ['nombre'] },
            { texto: '{nombre}, ¿quieres coordinar una cita? 👩‍⚕️', variables: ['nombre'] },
            { texto: '{nombre}, ¿deseas fijar una fecha para tu cita? 📍', variables: ['nombre'] },
            { texto: '{nombre}, ¿quieres que te programe una cita? 📲', variables: ['nombre'] },
            { texto: '{nombre}, ¿agendamos tu turno? 💡', variables: ['nombre'] },
            { texto: '{nombre}, ¿te gustaría reservar un turno? 🕐', variables: ['nombre'] },
            { texto: '{nombre}, ¿quieres asegurar tu cita hoy mismo? ✨', variables: ['nombre'] },
            { texto: '{nombre}, ¿deseas que te ayude a agendar tu próxima cita? 🩺', variables: ['nombre'] }
        ]);

        // === FLUJO: HORARIO ===
        this.agregar('horario', 'solicitar_fecha', [
            { texto: '📅 ¿Qué fecha prefieres? (formato: DD/MM/YYYY)' },
            { texto: '¿Para qué día quieres agendar?' },
            { texto: 'Dime la fecha que te gustaría (DD/MM/YYYY)' },
            { texto: '¿Cuándo te gustaría tu cita?' }
        ]);

        this.agregar('horario', 'solicitar_hora', [
            { texto: '⏰ ¿A qué hora prefieres? (formato: HH:MM)' },
            { texto: '¿Qué hora te viene bien?' },
            { texto: 'Dime la hora que prefieres (HH:MM)' },
            { texto: '¿A qué hora te gustaría?' }
        ]);

        this.agregar('horario', 'confirmar', [
            { texto: 'Perfecto, {fecha} a las {hora} ✅', variables: ['fecha', 'hora'] },
            { texto: 'Listo, te espero el {fecha} a las {hora} 📅', variables: ['fecha', 'hora'] },
            { texto: 'Agendado para {fecha} - {hora} 👍', variables: ['fecha', 'hora'] }
        ]);

        this.agregar('horario', 'no_disponible', [
            { texto: 'Ese horario no está disponible 😕' },
            { texto: 'Lo siento, esa hora ya está ocupada' },
            { texto: 'Ese horario no está libre. ¿Tienes otra opción?' }
        ]);

        this.agregar('horario', 'fecha_invalida', [
            { texto: 'Esa fecha no es válida. Usa formato DD/MM/YYYY' },
            { texto: 'No reconozco esa fecha. Intenta: DD/MM/YYYY' },
            { texto: 'Formato incorrecto. Ejemplo: 25/12/2024' }
        ]);

        // === FLUJO: CITA ===
        this.agregar('cita', 'solicitar_email', [
            { texto: '📧 ¿Cuál es tu email?' },
            { texto: 'Dime tu correo electrónico' },
            { texto: '¿A qué email te envío la confirmación?' },
            { texto: 'Por favor, comparte tu email' }
        ]);

        this.agregar('cita', 'solicitar_descripcion', [
            { texto: '📝 ¿Para qué es la cita? (motivo o descripción)' },
            { texto: 'Cuéntame, ¿qué necesitas?' },
            { texto: '¿Cuál es el motivo de tu consulta?' },
            { texto: 'Descríbeme brevemente tu necesidad' }
        ]);

        this.agregar('cita', 'pedir_fecha', [
            { texto: 'Cuándo te gustaría tu cita? 📅' },
            { texto: 'Listo, dime para cuándo la quieres 😊' },
            { texto: 'Qué día te gustaría agendar tu cita? 🗓️' },
            { texto: 'Para qué día deseas programarla? 📆' },
            { texto: 'Cuándo te vendría bien tu cita? ⏰' },
            { texto: 'Qué fecha te gustaría reservar? 📝' },
            { texto: 'Dime la fecha que prefieras y la agendamos 👍' },
            { texto: 'En qué fecha te gustaría agendar tu turno? 💬' },
            { texto: 'Perfecto, qué día te queda cómodo? ' },
            { texto: 'Qué día quieres que te anote para tu cita? ' },
            { texto: 'Para qué fecha deseas tu cita? ' },
            { texto: 'Cuándo quisieras venir? ' },
            { texto: 'Solo dime la fecha que prefieras y la agendamos 🤗' }

        ])
        this.agregar('cita', 'resumen', [
            {
                texto: '✅ Resumen de tu cita:\n👤 {nombre}\n📧 {email}\n📍 {ubicacion}\n📅 {fecha} - {hora}\n📝 {descripcion}',
                variables: ['nombre', 'email', 'ubicacion', 'fecha', 'hora', 'descripcion']
            },
            {
                texto: 'Perfecto {nombre}, aquí está tu cita:\n📍 {ubicacion}\n📅 {fecha} a las {hora}\n📝 {descripcion}\nConfirmación enviada a {email} ✉️',
                variables: ['nombre', 'email', 'ubicacion', 'fecha', 'hora', 'descripcion']
            }
        ]);

        this.agregar('cita', 'confirmacion', [
            { texto: '🎉 ¡Cita agendada exitosamente {nombre}!', variables: ['nombre'] },
            { texto: 'Todo listo {nombre}! Te esperamos 😊', variables: ['nombre'] },
            { texto: '✅ Confirmado {nombre}! Nos vemos pronto', variables: ['nombre'] }
        ]);

        this.agregar('cita', 'email_invalido', [
            { texto: 'Ese email no parece válido 🤔' },
            { texto: 'Por favor verifica tu email' },
            { texto: 'El formato del email no es correcto' }
        ]);

        this.agregar('cita', 'disponible', [
            { texto: 'Perfecto! El horario está disponible ⏰' },
            { texto: 'Ese horario está libre 👍' },
            { texto: 'Genial! El turno está disponible 😄' },
            { texto: 'Ese horario está libre ✅' },
            { texto: 'El horario que elegiste está disponible 🕒' },
            { texto: 'Buen horario, está libre para reservar 📅' },
            { texto: 'Ese turno está disponible' },
            { texto: 'Horario disponible!' },
            { texto: 'Ese horario está libre para agendar 💡' },
            { texto: 'Disponible! Ese turno no tiene nadie aún 🏥' }
        ]);
        this.agregar('cita', 'horario_ocupado', [
            { texto: 'El horario que eligiste ya está ocupado 🕒' },
            { texto: 'Lo siento, ese horario ya está reservado' },
            { texto: 'Ese horario no está disponible' }
        ])

        this.agregar('cita', 'pedir_otra_fecha', [
            { texto: 'No hay problema, {nombre} 😊', variables: ['nombre'] },
            { texto: 'Entiendo, {nombre}, dime otra fecha y hora que prefieras 🕒', variables: ['nombre'] },
            { texto: 'No te preocupes, {nombre}, dime un nuevo día y hora que te quede cómodo 📅', variables: ['nombre'] },
            { texto: 'Vale, {nombre}, entiendo, ¿qué otro horario te gustaría? 👍', variables: ['nombre'] },
            { texto: 'Tranquilo, {nombre}, dime otra fecha que te funcione ✨', variables: ['nombre'] }
        ]);

        this.agregar('cita', 'pedir_hora', [
            { texto: 'Súper, ahora dime a qué hora prefieres 😊' },
            { texto: 'Perfecto, ¿qué hora te gustaría? 🕒' },
            { texto: 'Genial, ¿a qué hora te viene bien? ⏰' },
            { texto: 'Entendido, dime la hora que prefieres 👍' },
            { texto: 'Vale, ¿qué horario te queda más cómodo? 💡' },
            { texto: 'Perfecto, dime la hora que te gustaría agendar 📅' },
            { texto: 'Súper, ¿qué hora te vendría mejor? 😄' },
            { texto: 'Excelente, dime la hora que te quede bien ✨' },
            { texto: 'De acuerdo, ¿a qué hora quieres tu cita? 🩺' },
            { texto: 'Listo, dime la hora que prefieras ⏰' }
        ]);

        this.agregar('cita', 'pedir_dia', [
            { texto: 'Perfecto, ¿para qué día? 📅' },
            { texto: 'Genial, ¿para qué día? 📅' },
            { texto: 'Entendido, dime el día que prefieres 👍' },
            { texto: 'Vale, ¿para qué día? 💡' },
            { texto: 'Perfecto, dime el día que te gustaría agendar 📅' },
            { texto: 'Súper, ¿para qué día? 😄' },
            { texto: 'Excelente, dime el día que te quede bien ✨' },
            { texto: 'De acuerdo, ¿para qué día quieres tu cita? 🩺' },
            { texto: 'Listo, dime el día que prefieras ⏰' }
        ])

        this.agregar('cita', 'confirmar_nombre', [
            { texto: 'A nombre de {nombre}, verdad? 😊', variables: ['nombre'] },
            { texto: 'Entonces sería a nombre de {nombre}, cierto? 👍', variables: ['nombre'] },
            { texto: 'Perfecto, confirmamos a nombre de {nombre}? 🕒', variables: ['nombre'] },
            { texto: 'Solo para confirmar, es a nombre de {nombre}? 💡', variables: ['nombre'] },
            { texto: 'Vale a nombre de {nombre}, correcto? 😄', variables: ['nombre'] },
            { texto: 'Déjame confirmar, es a nombre de {nombre}? 📋', variables: ['nombre'] }
        ]);

        this.agregar('cita', 'pedir_nombre', [
            { texto: 'Uy! entonces dime a qué nombre le pongo 😊' },
            { texto: 'Ah, entendido 😅 dime por favor el nombre correcto.' },
            { texto: 'No hay problema 😄 ¿a qué nombre agendamos la cita?' },
            { texto: 'Perfecto 👍 dime el nombre que debería poner.' },
            { texto: 'Entiendo, dime entonces el nombre correcto por favor 🙌' },
            { texto: 'Ah, vale 😊 ¿a nombre de quién registramos la cita?' },
            { texto: 'Ok, sin problema 😌 dime el nombre que corresponde.' }
        ]);







        // === MENSAJES: GENERALES ===
        this.agregar('general', 'error', [
            { texto: 'Hubo un problema. Intenta nuevamente 🙏' },
            { texto: 'Algo salió mal. ¿Intentamos de nuevo?' },
            { texto: 'Ocurrió un error. Por favor reintenta' }
        ]);

        this.agregar('general', 'cancelar', [
            { texto: 'Proceso cancelado. ¿En qué más puedo ayudarte?' },
            { texto: 'De acuerdo, cancelado. ¿Necesitas algo más?' },
            { texto: 'Entendido. ¿Qué más necesitas?' }
        ]);

        this.agregar('general', 'no_entendido', [
            { texto: 'No entendí bien. ¿Podrías repetir?' },
            { texto: 'Perdona, no comprendí. ¿Puedes explicarlo de otra forma?' },
            { texto: 'Disculpa, no capté eso. ¿Me lo dices de nuevo?' }
        ]);
    }

    /**
     * Agrega mensajes a una categoría - O(1)
     */
    private agregar(flujo: string, subcategoria: string, mensajes: MensajeTemplate[]): void {
        if (!this.mensajes.has(flujo)) {
            this.mensajes.set(flujo, new Map());
        }
        this.mensajes.get(flujo)!.set(subcategoria, mensajes);
    }

    /**
     * Obtiene mensaje aleatorio - O(1) promedio
     */
    obtener(flujo: string, subcategoria: string, variables?: Record<string, string>): string {
        const cacheKey = `${flujo}:${subcategoria}:${JSON.stringify(variables)}`;

        // Verificar cache (opcional, puedes desactivar si quieres más aleatoriedad)
        if (this.cache.size > 500) {
            const keys = Array.from(this.cache.keys()).slice(0, 250);
            for (const key of keys) this.cache.delete(key);
        }
        const subcategorias = this.mensajes.get(flujo);
        if (!subcategorias) {
            console.warn(`⚠️ Flujo '${flujo}' no encontrado`);
            return 'Disculpa, hubo un problema';
        }

        const templates = subcategorias.get(subcategoria);
        if (!templates || templates.length === 0) {
            console.warn(`⚠️ Subcategoría '${subcategoria}' no encontrada en '${flujo}'`);
            return 'Disculpa, hubo un problema';
        }

        // Selección aleatoria
        const template = templates[Math.floor(Math.random() * templates.length)];
        let mensaje = template.texto;

        // Reemplazar variables si existen
        if (variables && template.variables) {
            for (const key of template.variables) {
                if (variables[key]) {
                    mensaje = mensaje.replace(`{${key}}`, variables[key]);
                }
            }
        }

        // Guardar en cache
        this.cache.set(cacheKey, mensaje);

        return mensaje;
    }

    /**
     * Obtiene todos los mensajes de una subcategoría (útil para testing)
     */
    obtenerTodos(flujo: string, subcategoria: string): string[] {
        return this.mensajes.get(flujo)?.get(subcategoria)?.map(t => t.texto) || [];
    }

    /**
     * Agrega nuevo mensaje dinámicamente - O(1)
     */
    agregarMensaje(flujo: string, subcategoria: string, mensaje: MensajeTemplate): void {
        if (!this.mensajes.has(flujo)) {
            this.mensajes.set(flujo, new Map());
        }

        const subcategorias = this.mensajes.get(flujo)!;
        if (!subcategorias.has(subcategoria)) {
            subcategorias.set(subcategoria, []);
        }

        subcategorias.get(subcategoria)!.push(mensaje);
    }

    /**
     * Limpia cache (útil si quieres resetear)
     */
    limpiarCache(): void {
        this.cache.clear();
    }

    /**
     * Lista todas las categorías disponibles
     */
    listarCategorias(): string[] {
        return Array.from(this.mensajes.keys());
    }

    /**
     * Lista subcategorías de un flujo
     */
    listarSubcategorias(flujo: string): string[] {
        return Array.from(this.mensajes.get(flujo)?.keys() || []);
    }
}

// Instancia singleton
export const gestorMensajes = new GestorMensajes();

// Funciones helper para mantener compatibilidad con código existente
export function obtenerMensaje(flujo: string, subcategoria: string, variables?: Record<string, string>): string {
    return gestorMensajes.obtener(flujo, subcategoria, variables);
}

// Función específica para saludos (mantiene compatibilidad)
export function obtenerMensajeSaludo(nombre: string, esHoy: boolean = false, esPrimeraVez: boolean = false): string {
    let subcategoria = 'nuevo_dia';
    if (esPrimeraVez) subcategoria = 'primera_vez';
    else if (esHoy) subcategoria = 'repetido_hoy';

    return gestorMensajes.obtener('saludo', subcategoria, { nombre });
}