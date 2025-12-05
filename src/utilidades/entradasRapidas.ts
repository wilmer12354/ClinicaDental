/**
 * @file colaMensajesMultiUsuario.ts
 * @description Implementación funcional de un sistema de colas de mensajes para múltiples usuarios con debounce,
 * asegurando que cada conversación se maneje de forma independiente.
 */

import { BotContext } from "@builderbot/bot/dist/types";
import { WASocket } from "@whiskeysockets/baileys";

interface Mensaje {
    texto: string;
    timestamp: number;
}

interface ConfiguracionCola {
    milisegundosEspera: number;
}

interface ColaUsuario {
    mensajes: Mensaje[];
    temporizador: NodeJS.Timeout | null;
    callback: ((cuerpo: string, de: string) => void) | null;
}

interface EstadoColas {
    colas: Map<string, ColaUsuario>;
}

function crearEstadoInicial(): EstadoColas {
    return {
        colas: new Map()
    };
}

function reiniciarTemporizador(colaUsuario: ColaUsuario): ColaUsuario {
    if (colaUsuario.temporizador) {
        clearTimeout(colaUsuario.temporizador);
    }
    return { ...colaUsuario, temporizador: null };
}

function procesarCola(mensajes: Mensaje[]): string {
    const resultado = mensajes.map(mensaje => mensaje.texto).join(" ");
    console.log('Mensajes acumulados:', resultado);
    return resultado;
}

function crearColaMensajes(config: ConfiguracionCola) {
    const estado: EstadoColas = crearEstadoInicial();

    return async function encolarMensaje(
        ctx: BotContext,
        proveedor: { vendor: WASocket, messageKey: any },
        callback: (cuerpo: string, de: string) => void
    ) {
        const de = ctx.from;
        const cuerpoMensaje = ctx.body;
        const claveMensaje = ctx.key;

        // 🔹 Marcar mensaje como leído
        try {
            const socket = proveedor.vendor;
            await socket.readMessages([claveMensaje]);
        } catch (err) {
            console.error('❌ Error al marcar mensaje como leído:', err);
        }

        if (!de || !cuerpoMensaje) {
            console.error('Contexto de mensaje inválido:', ctx);
            return;
        }

        console.log('Encolando:', cuerpoMensaje, 'de:', de);

        let colaUsuario = estado.colas.get(de);
        if (!colaUsuario) {
            colaUsuario = { mensajes: [], temporizador: null, callback: null };
            estado.colas.set(de, colaUsuario);
        }

        colaUsuario = reiniciarTemporizador(colaUsuario);
        colaUsuario.mensajes.push({ texto: cuerpoMensaje, timestamp: Date.now() });
        colaUsuario.callback = callback;

        console.log('Mensajes de', de, ':', colaUsuario.mensajes);

        if (!colaUsuario.temporizador) {
            colaUsuario.temporizador = setTimeout(() => {
                const colaActual = estado.colas.get(de);
                if (colaActual) {
                    const resultado = procesarCola(colaActual.mensajes);
                    if (colaActual.callback) {
                        colaActual.callback(resultado, de);
                    }
                    estado.colas.set(de, { ...colaActual, mensajes: [], temporizador: null });
                }
            }, config.milisegundosEspera);
        }

        estado.colas.set(de, colaUsuario);
    };
}

export { crearColaMensajes, ConfiguracionCola };
