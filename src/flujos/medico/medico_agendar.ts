// src/flows/medicoAgendar.flow.ts
import { addKeyword, EVENTS } from '@builderbot/bot';
import { agendarCita } from '../../servicios/googleCalendar';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { extraerDatosCita } from '../../servicios/groqServicio';

/**
 * Interpretar confirmación del usuario
 */
function interpretarConfirmacion(respuesta: string): { confirmado: boolean; rechazado: boolean } {
    const confirmWords = ['si', 'sí', 'yes', 'ok', 'confirmar', 'correcto', 'exacto', 'afirmativo', 'positivo', 'claro', 'dale', 'sep'];
    const rejectWords = ['no', 'negativo', 'incorrecto', 'nop', 'nope', 'cancelar'];

    const resp = respuesta.toLowerCase().trim();
    const confirmado = confirmWords.some(word => resp === word || resp.includes(word));
    const rechazado = rejectWords.some(word => resp === word || resp.includes(word));

    return { confirmado, rechazado };
}

/**
 * Convierte una fecha local a ISO string manteniendo el timezone local
 * Ejemplo: 2025-03-15 10:00 en Bolivia (UTC-4) → "2025-03-15T10:00:00-04:00"
 */
function toLocalISOString(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(offsetHours)}:${pad(offsetMinutes)}`;
}

/**
 * Flujo inteligente para agendar citas - El médico escribe libremente
 */
export const flujoMedicoAgendar = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        try {
            await state.update({
                esperandoConfirmacion: false,
                datosExtraidos: null
            });

            await responderConAnimacion(
                provider,
                ctx,
                "Claro, dame los datos del paciente"
            );
        } catch (error) {
            console.error('❌ Error en flujoMedicoAgendar action:', error);
        }
    })
    .addAnswer('', { capture: true }, async (ctx, { provider, flowDynamic, state, fallBack }) => {
        try {
            const mensaje = ctx.body.trim();
            const esperandoConfirmacion = state.get('esperandoConfirmacion');

            if (esperandoConfirmacion) {
                // ========================================
                // CASO 2: Usuario está CONFIRMANDO (sí/no)
                // ========================================
                const { confirmado, rechazado } = interpretarConfirmacion(mensaje);

                if (confirmado) {
                    await responderConAnimacion(provider, ctx, "⏳ Creando la cita en el calendario...");

                    const datos = state.get('datosExtraidos');

                    if (!datos || !datos.nombrePaciente || !datos.startTime) {
                        await responderConAnimacion(provider, ctx, '❌ Error: Faltan datos. Intenta nuevamente.');
                        await state.clear();
                        return;
                    }

                    // 🔧 FIX: Usar formato ISO con timezone local
                    const datosReserva = {
                        title: `Cita - ${datos.nombrePaciente}`,
                        startTime: toLocalISOString(datos.startTime),
                        endTime: toLocalISOString(datos.endTime),
                        description: `Motivo: ${datos.motivo}\nContacto: ${datos.email}\nTeléfono: ${datos.telefono}`,
                        email: datos.email || '',
                        nombre: datos.nombrePaciente,
                        telefono: datos.telefono,
                        motivo: datos.motivo
                    };

                    const resultado = await agendarCita(datosReserva);

                    if (resultado.success) {
                        // ⭐ Restar 1 día a la fecha
                        const fechaAjustada = new Date(datos.startTime);
                        fechaAjustada.setDate(fechaAjustada.getDate() - 1);

                        await flowDynamic([
                            '✅ *¡Cita creada exitosamente!*\n\n' +
                            `👤 ${datos.nombrePaciente}\n` +
                            `📅 ${fechaAjustada.toLocaleDateString('es-ES', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}\n` +
                            `⏰ ${datos.startTime.toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })} - ${datos.endTime.toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}\n` +
                            `📝 ${datos.motivo}`
                        ]);

                        await state.clear();
                        return;
                    }

                    throw new Error(resultado.message || 'Error al crear la cita');
                }

                if (rechazado) {
                    await responderConAnimacion(provider, ctx, '❌ Cita cancelada.');
                    await state.clear();
                    return;
                }

                await responderConAnimacion(provider, ctx, 'No entendí. Responde *Sí* para confirmar o *No* para cancelar.');
                return fallBack();

            } else {
                // ========================================
                // CASO 1: Usuario está ENVIANDO DATOS
                // ========================================
                await responderConAnimacion(provider, ctx, "🤖 Analizando los datos...");

                const datosExtraidos = await extraerDatosCita(mensaje);

                if (!datosExtraidos.nombre || !datosExtraidos.fecha || !datosExtraidos.hora) {
                    const faltantes = [];
                    if (!datosExtraidos.nombre) faltantes.push('nombre');
                    if (!datosExtraidos.fecha) faltantes.push('fecha');
                    if (!datosExtraidos.hora) faltantes.push('hora');

                    await responderConAnimacion(
                        provider,
                        ctx,
                        `❌ Faltan datos: ${faltantes.join(', ')}.\n\nIntenta de nuevo incluyendo toda la información.`
                    );
                    return fallBack();
                }

                if (datosExtraidos.email) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(datosExtraidos.email)) {
                        await responderConAnimacion(provider, ctx, '❌ El email no es válido. Verifica e intenta nuevamente.');
                        return fallBack();
                    }
                }

                let startTime: Date;
                try {
                    const [year, month, day] = datosExtraidos.fecha.split('-').map(Number);
                    const [hour, minute] = datosExtraidos.hora.split(':').map(Number);

                    // Crear fecha en timezone local
                    startTime = new Date(year, month - 1, day, hour, minute, 0);

                    if (isNaN(startTime.getTime())) {
                        throw new Error('Fecha inválida');
                    }

                    const ahora = new Date();
                    if (startTime < ahora) {
                        await responderConAnimacion(provider, ctx, '❌ La fecha y hora no pueden ser en el pasado.');
                        return fallBack();
                    }
                } catch (error) {
                    await responderConAnimacion(
                        provider,
                        ctx,
                        '❌ No pude interpretar la fecha y hora.\n\nUsa formatos como:\n• "mañana 10am"\n• "15 de marzo 3pm"\n• "próximo lunes 9:30am"'
                    );
                    return fallBack();
                }

                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

                await state.update({
                    datosExtraidos: {
                        nombrePaciente: datosExtraidos.nombre,
                        email: datosExtraidos.email || '',
                        telefono: datosExtraidos.telefono || 'No proporcionado',
                        startTime: startTime,
                        endTime: endTime,
                        motivo: datosExtraidos.motivo || 'Consulta general'
                    },
                    esperandoConfirmacion: true
                });

                await responderConAnimacion(
                    provider,
                    ctx,
                    '¿Confirmar esta cita? *(Sí/No)*'
                );
                return fallBack();
            }

        } catch (error) {
            console.error('❌ Error en flujoMedicoAgendar:', error);
            await responderConAnimacion(
                provider,
                ctx,
                '❌ Hubo un error al procesar los datos. Intenta nuevamente.'
            );
            await state.clear();
            return fallBack();
        }
    });