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
    console.log(`⏱️ Temporizador iniciado para ${ctx.from}: ${segundosRestantes}s`);

    intervalosCuentaRegresiva[ctx.from] = setInterval(() => {
        segundosRestantes--;
        if (segundosRestantes > 0) {
            console.log(`⏳ ${ctx.from}: ${segundosRestantes}s restantes`);
        }
    }, 1000);

    temporizadores[ctx.from] = setTimeout(() => {
        console.log(`⏰ Timeout alcanzado para: ${ctx.from}`);

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
    console.log(`🔄 Temporizador reiniciado para: ${ctx.from}`);
    iniciarTemporizador(ctx, gotoFlow, ms);
}

// Función para detener el temporizador
export const detenerTemporizador = (ctx: BotContext) => {
    console.log(`🛑 Intentando detener temporizador para: ${ctx.from}`);

    if (temporizadores[ctx.from]) {
        clearTimeout(temporizadores[ctx.from]);
        delete temporizadores[ctx.from];
        console.log(`✅ Temporizador eliminado para: ${ctx.from}`);
    }

    if (intervalosCuentaRegresiva[ctx.from]) {
        clearInterval(intervalosCuentaRegresiva[ctx.from]);
        delete intervalosCuentaRegresiva[ctx.from];
        console.log(`✅ Cuenta regresiva eliminada para: ${ctx.from}`);
    }
}
