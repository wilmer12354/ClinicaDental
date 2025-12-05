// src/flows/confirmar.flow.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { agendarCita } from '../../servicios/googleCalendar';
import { responderConAnimacion } from '../../utilidades/chatUX';

export const flujoConfirmar = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, flowDynamic, state }) => {
        try {

            await responderConAnimacion(provider, ctx, "⏳ Creando tu cita dam un momento...");

            const datos = await state.getMyState();

            // Validar que tenemos todos los datos
            if (!datos.nombrePaciente || !datos.startTime || !datos.motivo) {
                

                await flowDynamic([
                    'Error viendo state'
                ]);
                await state.clear();
                return;
            }

            try {
                const numeroCelular = ((ctx.key?.remoteJid || ctx.from).split('@')[0]).slice(3);


                // ✅ CAMBIAR startTime/endTime a horaInicio/horaFin
                const datosReserva = {
                    title: `Cita - ${datos.nombrePaciente}`,
                    startTime: datos.startTime.toISOString(),  
                    endTime: datos.endTime.toISOString(),         
                    description: `Motivo: ${datos.motivo}\nContacto: ${datos.email}\nTeléfono: ${numeroCelular}`,
                    email: datos.email,
                    nombre: datos.nombrePaciente,
                    telefono: numeroCelular,
                    motivo: datos.motivo
                };

                const respuesta = await agendarCita(datosReserva);

                if (respuesta.success) {
                    await responderConAnimacion(provider, ctx, "¡Cita creada exitosamente!");
                    await state.clear();
                    return;
                }

                throw new Error(respuesta.message || 'Error al crear la cita');

            } catch (error) {
                console.error('❌ Error al crear cita:', error);
                const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
                
                await responderConAnimacion(provider, ctx, "Error al crear la cita");
                await state.clear();
            }

        } catch (error) {
            console.error('❌ Error en confirmarFlow:', error);
        }
    });