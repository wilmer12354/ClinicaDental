/**
 * 📡 UTILIDADES DE SOCKET - BAILEYS WEBSOCKET
 * 
 * Este módulo encapsula las operaciones del socket de WhatsApp usando Baileys.
 * Baileys utiliza WebSockets para comunicarse con WhatsApp Web.
 * 
 * @whiskeysockets/baileys v7.0.0-rc.6
 */

import type { BaileysProvider as Provider } from '@builderbot/provider-baileys';

/**
 * 📨 Marcar mensajes como leídos usando el socket de Baileys
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @param messageKey - Clave del mensaje a marcar como leído
 * 
 * @example
 * ```typescript
 * await markAsRead(provider, ctx.key);
 * ```
 */
export const MarcarComoLeido = async (provider: Provider, messageKey: any) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        await sock.readMessages([messageKey]);
    } catch (error) {
        console.error('❌ [SOCKET] Error al marcar mensaje como leído:', error);
        throw error;
    }
};

/**
 * 👤 Actualizar el estado de presencia usando el socket de Baileys
 * 
 * Estados disponibles:
 * - 'composing': Usuario está escribiendo
 * - 'paused': Usuario dejó de escribir
 * - 'recording': Usuario está grabando audio
 * - 'available': Usuario está disponible
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @param status - Estado de presencia a establecer
 * @param jid - ID del chat (número de teléfono + @s.whatsapp.net)
 * 
 * @example
 * ```typescript
 * await updatePresence(provider, 'composing', jid);
 * await updatePresence(provider, 'paused', jid);
 * ```
 */
export const MostrarEscribiendo = async (
    provider: Provider,
    status: 'composing' | 'paused' | 'recording' | 'available',
    jid: string
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        await sock.sendPresenceUpdate(status, jid);
    } catch (error) {
        console.error('❌ [SOCKET] Error al actualizar presencia:', error);
        throw error;
    }
};

/**
 * 💬 Enviar un mensaje de texto usando directamente el socket de Baileys
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @param jid - ID del chat (número de teléfono + @s.whatsapp.net)
 * @param message - Mensaje de texto a enviar
 * 
 * @example
 * ```typescript
 * await sendMessageViaSocket(provider, jid, '¡Hola! Este mensaje se envió via socket');
 * ```
 */
export const EnviarMensaje = async (
    provider: Provider,
    jid: string,
    message: string
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        const result = await sock.sendMessage(jid, { text: message });
        return result;
    } catch (error) {
        console.error('❌ [SOCKET] Error al enviar mensaje:', error);
        throw error;
    }
};


import axios from 'axios';

/**
 * Envía una imagen con reintentos automáticos
 * @param provider - Proveedor de Baileys
 * @param jid - ID del destinatario
 * @param imagen - Buffer, ruta local o URL de la imagen
 * @param caption - Texto opcional para acompañar la imagen
 * @param intentos - Número de reintentos (default: 3)
 * @returns Promise<boolean> - true si se envió correctamente
 */
export const enviarImagenConReintentos = async (
    provider: any,
    jid: string,
    imagen: Buffer | string,
    caption?: string,
    intentos: number = 3
): Promise<boolean> => {
    for (let i = 0; i < intentos; i++) {
        try {
            let buffer: Buffer;

            // Si es un Buffer, usarlo directamente
            if (Buffer.isBuffer(imagen)) {
                buffer = imagen;
            }
            // Si es una URL
            else if (typeof imagen === 'string' && imagen.startsWith('http')) {
                console.log(`📥 Descargando imagen desde URL (intento ${i + 1}/${intentos})...`);
                const response = await axios.get(imagen, {
                    responseType: 'arraybuffer',
                    timeout: 15000, // 15 segundos
                    maxContentLength: 10 * 1024 * 1024 // 10MB max
                });
                buffer = Buffer.from(response.data);
            }
            // Si es ruta local
            else if (typeof imagen === 'string') {
                const fs = await import('fs');
                buffer = fs.readFileSync(imagen);
            } else {
                throw new Error('Formato de imagen no válido');
            }

            // Validar que el buffer no esté vacío
            if (!buffer || buffer.length === 0) {
                throw new Error('Buffer de imagen vacío');
            }

            console.log(`📤 Enviando imagen (${(buffer.length / 1024).toFixed(2)} KB)...`);

            // Acceder al socket real de Baileys
            const sock = await provider.getInstance();
            
            if (!sock) {
                throw new Error('Socket de Baileys no disponible');
            }

            // Enviar imagen usando el socket de Baileys
            await sock.sendMessage(jid, {
                image: buffer,
                caption: caption || ''
            });

            console.log(`✅ Imagen enviada correctamente (intento ${i + 1}/${intentos})`);
            return true;

        } catch (error: any) {
            console.error(`❌ Intento ${i + 1}/${intentos} falló:`, error.message);

            // Si es el último intento, registrar el error completo
            if (i === intentos - 1) {
                console.error('❌ Error definitivo al enviar imagen:', error);
                return false;
            }

            // Esperar antes de reintentar (backoff exponencial)
            const delay = Math.min(1000 * Math.pow(2, i), 5000); // Max 5 segundos
            console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return false;
};

/**
 * Envía una imagen simple (sin reintentos) - mantener por compatibilidad
 */
export const enviarImagen = async (
    provider: any,
    jid: string,
    imagen: Buffer | string,
    caption?: string
): Promise<void> => {
    try {
        let buffer: Buffer;

        if (Buffer.isBuffer(imagen)) {
            buffer = imagen;
        } else if (typeof imagen === 'string' && imagen.startsWith('http')) {
            const response = await axios.get(imagen, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            buffer = Buffer.from(response.data);
        } else if (typeof imagen === 'string') {
            const fs = await import('fs');
            buffer = fs.readFileSync(imagen);
        } else {
            throw new Error('Formato de imagen no válido');
        }

        // Acceder al socket real de Baileys
        const sock = await provider.getInstance();
        
        if (!sock) {
            throw new Error('Socket de Baileys no disponible');
        }

        await sock.sendMessage(jid, {
            image: buffer,
            caption: caption || ''
        });

        console.log('✅ Imagen enviada correctamente');
    } catch (error) {
        console.error('❌ Error al enviar imagen:', error);
        throw error; // Re-lanzar para que el llamador lo maneje
    }
};

/**
 * Envía un documento/archivo
 */
export const enviarDocumento = async (
    provider: any,
    jid: string,
    rutaArchivo: string,
    nombreArchivo?: string
): Promise<boolean> => {
    try {
        const fs = await import('fs');
        const path = await import('path');
        
        const buffer = fs.readFileSync(rutaArchivo);
        const fileName = nombreArchivo || path.basename(rutaArchivo);

        // Acceder al socket real de Baileys
        const sock = await provider.getInstance();
        
        if (!sock) {
            throw new Error('Socket de Baileys no disponible');
        }

        await sock.sendMessage(jid, {
            document: buffer,
            fileName: fileName,
            mimetype: getMimeType(fileName)
        });

        console.log('✅ Documento enviado correctamente:', fileName);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar documento:', error);
        return false;
    }
};

/**
 * Obtiene el MIME type según la extensión del archivo
 */
const getMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
};
/**
 * 🖼️ Enviar una imagen usando el socket de Baileys
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @param jid - ID del chat
 * @param imageBuffer - Buffer de la imagen
 * @param caption - Texto opcional para la imagen
 * 
 * @example
 * ```typescript
 * const imageBuffer = fs.readFileSync('imagen.jpg');
 * await enviarImagen(provider, jid, imageBuffer, 'Mira esta imagen');
 * ```
 */
export const enviarImagen2 = async (
    provider: Provider,
    jid: string,
    imageBuffer: Buffer,
    caption?: string
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        const result = await sock.sendMessage(jid, {
            image: imageBuffer,
            caption: caption
        });
        return result;
    } catch (error) {
        console.error('❌ [SOCKET] Error al enviar imagen:', error);
        throw error;
    }
};

/**
 * 📥 Descargar un archivo multimedia usando el socket de Baileys
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @param message - Mensaje que contiene el archivo multimedia
 * 
 * @example
 * ```typescript
 * const buffer = await downloadMediaViaSocket(provider, ctx);
 * ```
 */
export const downloadMediaViaSocket = async (
    provider: Provider,
    message: any
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        
        // Usar el método correcto de Baileys para descargar media
        const buffer = await (sock as any).downloadMediaMessage?.(message) || 
                       await provider.saveFile(message);

        return buffer;
    } catch (error) {
        console.error('❌ [SOCKET] Error al descargar archivo:', error);
        throw error;
    }
};

/**
 * 📊 Obtener información del socket de conexión
 * 
 * @param provider - Proveedor de Baileys que contiene el socket
 * @returns Información sobre el estado del socket
 * 
 * @example
 * ```typescript
 * const info = getSocketInfo(provider);
 * console.log(info);
 * ```
 */
export const getSocketInfo = (provider: Provider) => {
    // 🔌 Acceso directo al socket de Baileys (WebSocket)
    const sock = provider.vendor;
    
    const info = {
        connected: sock.user ? true : false,
        user: sock.user,
        protocol: 'WebSocket',
        library: '@whiskeysockets/baileys',
        version: '7.0.0-rc.6',
        type: 'WhatsApp Web Protocol'
    };
    
    return info;
};

/**
 * 🔄 Obtener el socket directamente (para operaciones avanzadas)
 * 
 * @param provider - Proveedor de Baileys
 * @returns Socket de Baileys
 * 
 * @example
 * ```typescript
 * const sock = getSocket(provider);
 * // Ahora puedes usar sock.cualquierMetodoDeBaileys()
 * ```
 */
export const getSocket = (provider: Provider) => {
    console.log('📡 [SOCKET] Obteniendo referencia directa al socket de Baileys');
    return provider.vendor;
};

/**
 * 🔔 Enviar una reacción a un mensaje usando el socket
 * 
 * @param provider - Proveedor de Baileys
 * @param messageKey - Clave del mensaje a reaccionar
 * @param emoji - Emoji de reacción
 * 
 * @example
 * ```typescript
 * await sendReactionViaSocket(provider, ctx.key, '👍');
 * ```
 */
export const sendReactionViaSocket = async (
    provider: Provider,
    messageKey: any,
    emoji: string
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        
        const result = await sock.sendMessage(messageKey.remoteJid!, {
            react: {
                text: emoji,
                key: messageKey
            }
        });
        return result;
    } catch (error) {
        console.error('❌ [SOCKET] Error al enviar reacción:', error);
        throw error;
    }
};

/**
 * 📍 Enviar ubicación usando el socket
 * 
 * @param provider - Proveedor de Baileys
 * @param jid - ID del chat
 * @param latitude - Latitud
 * @param longitude - Longitud
 * 
 * @example
 * ```typescript
 * await sendLocationViaSocket(provider, jid, -12.0464, -77.0428);
 * ```
 */
export const sendLocationViaSocket = async (
    provider: Provider,
    jid: string,
    latitude: number,
    longitude: number
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        
        const result = await sock.sendMessage(jid, {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude
            }
        });
        return result;
    } catch (error) {
        console.error('❌ [SOCKET] Error al enviar ubicación:', error);
        throw error;
    }
};

/**
 * 🎯 Wrapper completo para operaciones comunes del socket
 * Agrupa múltiples operaciones del socket en una sola función
 * 
 * @param provider - Proveedor de Baileys
 * @param ctx - Contexto del mensaje
 * @param actions - Acciones a realizar
 * 
 * @example
 * ```typescript
 * await socketOperations(provider, ctx, {
 *   markAsRead: true,
 *   showTyping: true,
 *   jid: ctx.from
 * });
 * ```
 */
export const socketOperations = async (
    provider: Provider,
    ctx: any,
    actions: {
        markAsRead?: boolean;
        showTyping?: boolean;
        showPaused?: boolean;
        jid?: string;
    }
) => {
    try {
        // 🔌 Acceso directo al socket de Baileys (WebSocket)
        const sock = provider.vendor;
        const jid = actions.jid || ctx.key?.remoteJid || ctx.from;

        console.log('📡 [SOCKET] Ejecutando múltiples operaciones via WebSocket');

        if (actions.markAsRead && ctx.key) {
            console.log('  ↳ Marcando como leído...');
            await sock.readMessages([ctx.key]);
        }

        if (actions.showTyping) {
            console.log('  ↳ Mostrando estado "escribiendo"...');
            await sock.sendPresenceUpdate('composing', jid);
        }

        if (actions.showPaused) {
            console.log('  ↳ Mostrando estado "pausado"...');
            await sock.sendPresenceUpdate('paused', jid);
        }

        console.log('✅ [SOCKET] Operaciones completadas exitosamente');
    } catch (error) {
        console.error('❌ [SOCKET] Error en operaciones del socket:', error);
        throw error;
    }
};
