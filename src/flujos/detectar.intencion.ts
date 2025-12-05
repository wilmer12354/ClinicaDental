// templates/detectIntention.ts
import { addKeyword, EVENTS } from '@builderbot/bot'
import { GeminiService } from '../servicios/gemini'
import { bienvenidaFlujo } from './FAQS/bienvenida.flujo'
import { flujoGemini } from './FAQS/gemini.flow'
import { cargarArchivoPrompt } from '../utilidades/read.prompt'
import { flujoReserva } from './agendar_cita/reserva.flujo'
import { flujoCancelar } from './cancelar_cita/cancel.flow'
import { flujoUbicacion } from './FAQS/flujoUbicacion'
import { detectarIntencionPorFuse } from '../utilidades/pln/fuse'
import { flujoHorario } from './FAQS/horario.flujo'
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { flujoRegistro } from './FAQS/bienvenida.flujo';
import { flujoEspecialidades, flujoPrecios } from './FAQS/especialidades';

import { derivaMedicoFlujo } from './medico/deriva.medico.flow'
import { corregirOrtografia } from '../utilidades/pln/correctorOrtografia'

const detectarIntencion = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx ,{ gotoFlow, endFlow, state, fallBack }) => {

    const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
    const paciente = await instanciaAdaptadorMongo.buscarPacientePorNumero(numeroCelular);

    // Si el paciente no tiene nombre, redirigir al flujo de registro
    if (paciente && !paciente.nombre) {
      return gotoFlow(flujoRegistro);
    } 
    try {
      // MENSAJE POR TEXTO
      const mensajeAcumulado = await (state.get('mensajeAcumulado'))
      const mensajeFinal= corregirOrtografia(mensajeAcumulado)

      console.log("MENSAJE ACUMULADO CORREGIDO:" , mensajeAcumulado)



      //MENSAJE POR VOZ
      const mensajePorNotaDeVoz = state.get('mensajePorNotaDeVoz');
      console.log('Mensaje por nota de voz acumulado:', mensajePorNotaDeVoz)

      const mensajePaciente = mensajePorNotaDeVoz || mensajeAcumulado;


      if (!mensajePaciente || typeof mensajePaciente !== 'string') {
        return endFlow('No pude entender tu mensaje. Por favor, envía un texto.')
      }

      console.log('Detectando intención para el mensaje:', mensajePaciente)


      const intencion = await detectarIntencionPorFuse(mensajePaciente)

      //Buscar por keywords fuse.js
      if (intencion) {
        console.log('Intención detectada por palabras clave|:', intencion)
        return enviarAlFlujo(intencion, gotoFlow)
      } else {
        console.log(intencion)
      }

      // Si no coincide con keywords, usar IA
      const intencionIA = await detectarIntencionIA(mensajePaciente)
      console.log('Intención detectada por IA:', intencionIA)

      
      return enviarAlFlujo(intencionIA, gotoFlow)
      

    } catch (error) {
      console.error('Error en DetectIntention:', error)
      return endFlow('Ocurrió un error al procesar tu mensaje. Intenta nuevamente.')
    }
  })

export { detectarIntencion }

  

// 🚦 Función para redirigir al flujo correcto
function enviarAlFlujo(intention: string, gotoFlow: any) {
  switch (intention) {
    case 'SALUDO':
      return gotoFlow(bienvenidaFlujo)
    case 'RESERVA':
      return gotoFlow(flujoReserva)
    case 'CANCELAR':
      return gotoFlow(flujoCancelar)
    case 'UBICACION':
      return gotoFlow(flujoUbicacion)
    case 'HORARIO':
      return gotoFlow(flujoHorario)
    case 'GEMINI':
      return gotoFlow(flujoGemini)
    case 'DERIVA_MEDICO':
      return gotoFlow(derivaMedicoFlujo)
    case 'ESPECIALIDADES':
      return gotoFlow(flujoEspecialidades)
    case 'PRECIOS':
      return gotoFlow(flujoPrecios)
    default:
      return;
  }
}

// Cargar prompt al inicio
const promptDetectarIntencion = cargarArchivoPrompt('prompt_Detection.txt')

// 🤖 Servicio para detectar intenciones usando Gemini (solo como fallback)
export async function detectarIntencionIA(userMessage: string): Promise<string> {
  try {
    const response = await GeminiService(promptDetectarIntencion, userMessage)

    console.log('🤖 Respuesta DE PROMPT_DETECTION:', `"${response}"`)

    if (!response || response.trim().length === 0) {
      console.log('⚠️ Respuesta vacía de Gemini, usando fallback')
      return 'GEMINI'
    }

    const intention = response.toString().trim().toUpperCase()
    const validIntentions = ['SALUDO', 'OTRO', 'RESERVA', 'GEMINI', 'CANCELAR', 'UBICACION', 'HORARIO', 'DERIVA_MEDICO', 'ESPECIALIDADES', 'PRECIOS']

    if (validIntentions.includes(intention)) {
      console.log('✅ Intención válida detectada:', intention)
      return intention
    } else {
      console.log('⚠️ Intención no válida:', intention, '- usando GEMINI como fallback')
      return 'GEMINI'
    }
  } catch (error) {
    console.error('❌ Error en detectar Intención:', error)
    return 'GEMINI'
  }
}
