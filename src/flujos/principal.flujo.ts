// src/flows/welcome.flow.ts (o tu archivo principal)

import { addKeyword, EVENTS } from '@builderbot/bot';
import { detectarIntencion } from './detectar.intencion';
import { crearColaMensajes, ConfiguracionCola } from '../utilidades/entradasRapidas';
import { flujoListaNegra } from './medico/flujoListaNegra';
import { listaNegraTurso } from '~/bd/adaptadorTurso';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { flujoRegistro } from './FAQS/bienvenida.flujo';
import { responderConAnimacion } from '~/utilidades/chatUX';
import { obtenerNumeroTelefono } from '../utilidades/telefono.util'

const configTiempo: ConfiguracionCola = { milisegundosEspera: 3000 };
const mensajeEnCola = crearColaMensajes(configTiempo);

export const principalFlujo = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, { gotoFlow, state, provider }) => {

    const numeroCelular = obtenerNumeroTelefono(ctx);
    

    try {

      const dbPaciente = await instanciaAdaptadorMongo.buscarPacientePorNumero(numeroCelular)


      if (await listaNegraTurso.estaBloqueado(numeroCelular)) {
        
        return;
      }


      if (numeroCelular === process.env.ADMIN_NUMBER) {
        
        await state.update({ mensajeAcumulado: ctx.body })
        return gotoFlow(flujoListaNegra)
      }

      // Procesar mensaje normalmente
      mensajeEnCola(ctx, provider, async (body) => {
        await state.update({ mensajeAcumulado: body })
        if (!dbPaciente) {
          return gotoFlow(flujoRegistro)
        } else {
          if (dbPaciente.estado === 'ACTIVO') {
            
            return gotoFlow(detectarIntencion)
          } else if (dbPaciente.estado === 'DERIVA_MEDICO') {
            await responderConAnimacion(provider, ctx, 'Ya se le comunicó al médico, no spamee por favor...');
          }
        }
      })
    } catch (error) {
      console.error('❌ Error al procesar mainFlow:', error)
    }
  })

