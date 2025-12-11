import { createFlow } from "@builderbot/bot";
import { flujoRegistro, bienvenidaFlujo } from "./FAQS/bienvenida.flujo";
import { detectarIntencion } from "./detectar.intencion";
import { flujoGemini } from "./FAQS/gemini.flow";
import { flujoNotasDeVoz } from "./nota.voz.flujo";
import { flujoNombre } from "./agendar_cita/nombre.flujo";
import { flujoEmail } from "./agendar_cita/email.flujo";
import { flujoDescripcion } from "./agendar_cita/descripcion.flujo";
import { flujoReserva } from "./agendar_cita/reserva.flujo";
import { flujoConfirmar } from "./agendar_cita/confirmar.flujo";
import { flujoCancelar } from "./cancelar_cita/cancel.flow";
import { flujoUbicacion } from "./FAQS/flujoUbicacion";
import { flujoHorario } from "./FAQS/horario.flujo";
import { flujoInactividad } from "../utilidades/inactividad";
import { flujoListaNegra } from "./medico/flujoListaNegra";
import { derivaMedicoFlujo } from "./medico/deriva.medico.flow";
import { principalFlujo } from "./principal.flujo";
import { flujoMedicoAgendar } from "./medico/medico_agendar";
import { flujoEspecialidades } from "./FAQS/especialidades";
import { flujoPrecios } from "./FAQS/especialidades";
import { flujoLlamada } from "./FAQS/llamada";


export default createFlow([
    bienvenidaFlujo,
    flujoGemini,
    detectarIntencion,
    flujoNotasDeVoz,
    principalFlujo,
    flujoNombre,
    flujoEmail,
    flujoDescripcion,
    flujoReserva,
    flujoConfirmar,
    flujoCancelar,
    flujoListaNegra,
    flujoUbicacion,
    flujoHorario,
    flujoInactividad,
    flujoRegistro,
    derivaMedicoFlujo,
    flujoMedicoAgendar,
    flujoEspecialidades,
    flujoPrecios,
    flujoLlamada,
]);
