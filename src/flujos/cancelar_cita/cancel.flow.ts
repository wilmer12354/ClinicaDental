// src/flows/cancel.flow.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { obtenerCitasPaciente, cancelarCita } from '../../servicios/googleCalendar';
import { formatearFechaHora } from '../../utilidades/pln/dateTime';
import { responderConAnimacion } from '../../utilidades/chatUX';

// Función para formatear número boliviano
function formatBolivianPhone(phone: string): string {
    phone = phone.split('@')[0];
    if (phone.startsWith('591') && phone.length === 11) {
        return `${phone.substring(3)}`;
    }
    if (phone.length === 8) {
        return `${phone}`;
    }
    return `${phone}`;
}

export const flujoCancelar = addKeyword(EVENTS.ACTION)
    // 🟢 PASO 1: Buscar citas del usuario
    .addAction(async (ctx, { provider, endFlow, state }) => {
    try {
        const jid = ctx.key?.remoteJid || ctx.from;
        const numeroCelular = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const formattedPhone = formatBolivianPhone(numeroCelular);

       

        await responderConAnimacion(provider, ctx, "🔍 Buscando tus citas agendadas...");

        // Obtener citas del usuario
        const listarCitas = await obtenerCitasPaciente(formattedPhone);
        //    ^^^^^^^^^^^ Ya es el array directamente
        
   

        // ✅ Verificar directamente el array
        if (!listarCitas || !Array.isArray(listarCitas) || listarCitas.length === 0) {
            await responderConAnimacion(provider, ctx, "No tienes citas");
            await state.clear();
            return endFlow();
        }

        // Guardar citas en el estado
        await state.update({
            appointments: listarCitas,
            userPhone: formattedPhone,
            step: 'selecting'
        });

        let mensaje = 'Tus citas agendadas:\n';
        listarCitas.forEach((apt, index) => {
            mensaje += `*${index + 1}.* ${formatearFechaHora(new Date(apt.start))}\n`;
            mensaje += `   📌 ${apt.title}\n`;
        });
        mensaje += 'Cual quieres cancelar';

        await responderConAnimacion(provider, ctx, mensaje);

    } catch (error) {
        console.error('❌ Error en cancelFlow:', error);
        await responderConAnimacion(provider, ctx, "Hubo un error al buscar tus citas.");
        await state.clear();
    }
})

    // 🟡 PASO 2: Capturar selección de cita
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { provider, flowDynamic, state, fallBack }) => {
            try {
                const jid = ctx.key?.remoteJid || ctx.from;
                const input = ctx.body.trim().toLowerCase();

                // Si cancela el proceso
                if (input === 'cancelar' || input === 'salir') {
                    await responderConAnimacion(provider, ctx, "Operación cancelada.");
                    await state.clear();
                    return;
                }

                const datos = await state.getMyState();
                const appointments = datos.appointments;

                if (!appointments || appointments.length === 0) {
                    await responderConAnimacion(provider, ctx, "No hay citas disponibles. Escribe algo para empezar de nuevo.");
                    await state.clear();
                    return;
                }

                // Validar que sea un número válido
                const selectedIndex = parseInt(input) - 1;

                if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= appointments.length) {
                    await provider.vendor.sendPresenceUpdate('composing', jid);

                    await flowDynamic([
                        '❌ Opción inválida.',
                        `Por favor responde con un número entre 1 y ${appointments.length}`
                    ]);
                    await provider.vendor.sendPresenceUpdate('paused', jid);
                    return fallBack();
                }

                const selectedAppointment = appointments[selectedIndex];

                // Guardar selección en estado
                await state.update({
                    selectedAppointment,
                    step: 'confirming'
                });

                // Pedir confirmación
                await responderConAnimacion(provider, ctx, "seguro de cancelar esta cita?");

            } catch (error) {
                console.error('❌ Error al seleccionar cita:', error);
                await responderConAnimacion(provider, ctx, "Hubo un error. Por favor intenta de nuevo.");
                await state.clear();
            }
        }
    )

    // 🔴 PASO 3: Confirmar cancelación
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { provider, state, fallBack }) => {
            try {
                const jid = ctx.key?.remoteJid || ctx.from;
                const input = ctx.body.trim().toLowerCase();

                const datos = await state.getMyState();
                const selectedAppointment = datos.selectedAppointment;

                if (!selectedAppointment) {
                    await responderConAnimacion(provider, ctx, "No hay cita seleccionada. Escribe algo para empezar de nuevo.");
                    await state.clear();
                    return;
                }

                // Validar respuesta
                if (input !== 'si' && input !== 'sí' && input !== 'no') {
                    await responderConAnimacion(provider, ctx, "Respuesta no válida. Por favor responde *SÍ* o *NO*");
                    return fallBack();
                }

                if (input === 'no') {
                    await responderConAnimacion(provider, ctx, "Cita no cancelada. Tu reserva sigue activa.");
                    await state.clear();
                    return;
                }

                await responderConAnimacion(provider, ctx, "⏳ Cancelando tu cita...");

             

                const result = await cancelarCita(selectedAppointment.eventId);

                

                if (result.success) {
                    await responderConAnimacion(provider, ctx, `✅ *Cita cancelada exitosamente*

                        📅 ${formatearFechaHora(new Date(selectedAppointment.start))}
                        📌 ${selectedAppointment.title}

                        La cita ha sido eliminada de tu calendario.
                        Recibirás una notificación de cancelación en tu correo.`);

                } else {
                    console.error('❌ DEBUG - Error del servidor:', result.message);
                    await responderConAnimacion(provider, ctx, `❌ No se pudo cancelar la cita. Error: ${result.message || 'Desconocido'}`);
                }

                await state.clear();

            } catch (error) {
                console.error('❌ Error al confirmar cancelación:', error);
                console.error('❌ Stack trace:', error.stack);
                await responderConAnimacion(provider, ctx, "❌ Hubo un error al cancelar tu cita.");
                await state.clear();
            }
        }
    );