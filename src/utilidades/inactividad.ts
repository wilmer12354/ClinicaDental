import { EVENTS, addKeyword } from '@builderbot/bot'
import { BotContext, TFlow } from '@builderbot/bot/dist/types';
import { EnviarMensaje } from './baileysSocketMensajes';

// Objetos para almacenar los tiempos por usuario
const temporizadores = {};
const intervalosCuentaRegresiva = {};

// Flow para manejar la inactividad
export const flujoInactividad = addKeyword(EVENTS.ACTION).addAction(
    async (ctx, { endFlow, provider }) => {
        const jid = ctx.key.remoteJid;
        EnviarMensaje(provider, jid, "Vuelve a enviar un mensaje para continuar 👋");
        return endFlow();
    }
);

// Función para iniciar el temporizador de inactividad
export const iniciarTemporizador = (
    ctx: BotContext,
    gotoFlow: (a: TFlow) => Promise<void>,
    ms: number
) => {
    if (intervalosCuentaRegresiva[ctx.from]) {
        clearInterval(intervalosCuentaRegresiva[ctx.from]);
    }

    let segundosRestantes = Math.floor(ms / 1000);
    intervalosCuentaRegresiva[ctx.from] = setInterval(() => {
        segundosRestantes--;
    }, 1000);

    temporizadores[ctx.from] = setTimeout(() => {

        if (intervalosCuentaRegresiva[ctx.from]) {
            clearInterval(intervalosCuentaRegresiva[ctx.from]);
            delete intervalosCuentaRegresiva[ctx.from];
        }

        return gotoFlow(flujoInactividad);
    }, ms);
}

// Función para reiniciar el temporizador
export const reiniciarTemporizador = (
    ctx: BotContext,
    gotoFlow: (a: TFlow) => Promise<void>,
    ms: number
) => {
    detenerTemporizador(ctx);
    iniciarTemporizador(ctx, gotoFlow, ms);
}

// Función para detener el temporizador
export const detenerTemporizador = (ctx: BotContext) => {
    if (temporizadores[ctx.from]) {
        clearTimeout(temporizadores[ctx.from]);
        delete temporizadores[ctx.from];
    }

    if (intervalosCuentaRegresiva[ctx.from]) {
        clearInterval(intervalosCuentaRegresiva[ctx.from]);
        delete intervalosCuentaRegresiva[ctx.from];
    }
}
