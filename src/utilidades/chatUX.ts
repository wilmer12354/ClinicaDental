
import { MarcarComoLeido, MostrarEscribiendo, EnviarMensaje, sendReactionViaSocket } from './baileysSocketMensajes';



const waitT = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(ms)
    }, ms)
  })
}
export { waitT }

export async function prepararInteraccion(provider: any, ctx: any, opciones: {
  leer?: boolean,
  reaccion?: string,
  escribiendo?: boolean,
  delayAntes?: number,
  delayDespues?: number
} = {}) {
  const {
    leer = true,
    reaccion = null,
    escribiendo = true,
    delayAntes = 1000,
    delayDespues = 2000
  } = opciones;

  const jid = ctx.key?.remoteJid || ctx.from;

  if (delayAntes) await waitT(delayAntes);

  if (leer) {
    await MarcarComoLeido(provider, ctx.key);
  }

  if (reaccion) {
    await sendReactionViaSocket(provider, ctx.key, reaccion);
  }

  if (escribiendo) {
    await MostrarEscribiendo(provider, 'composing', jid);
  }

  if (delayDespues) await waitT(delayDespues);

  return jid;
}

export async function responderConAnimacion(provider: any, ctx: any, mensaje: string, reaccion: string = null) {
  const jid = await prepararInteraccion(provider, ctx, { reaccion });
  await EnviarMensaje(provider, jid, mensaje);
}
