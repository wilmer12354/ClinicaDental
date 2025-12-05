import { addKeyword } from "@builderbot/bot";
import { EVENTS } from "@builderbot/bot";
import { responderConAnimacion } from "../../utilidades/chatUX";
import { instanciaAdaptadorMongo } from "../../bd/adaptadorMongo";
import { obtenerMensaje } from "~/utilidades/mensajesDiferentes";
import { flujoReserva } from "../agendar_cita/reserva.flujo";
import { detectarIntencion } from "../detectar.intencion";

// ========================================
// FUNCIONES AUXILIARES
// ========================================

const esRespuestaAfirmativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesSi = ['si', 'sí', 'claro', 'ok', 'vale', 'dale', 'afirmativo', 'confirmo', 'quiero', 'me interesa', 'por favor', 'seguro', 'obvio'];
    return patronesSi.some(patron => mensajeLower.includes(patron));
};

const esRespuestaNegativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesNo = ['no', 'nop', 'nope', 'nanai', 'negativo', 'no quiero', 'no gracias', 'ahora no', 'luego', 'después', 'tal vez'];
    return patronesNo.some(patron => mensajeLower.includes(patron));
};

const detectarEspecialidad = (mensaje: string): { nombre: string; encontrada: boolean } | null => {
    const mensajeLower = mensaje.toLowerCase().trim();

    if (mensajeLower.includes('implant')) {
        return { nombre: 'implantologia', encontrada: true };
    }
    if (mensajeLower.includes('ortodon') || mensajeLower.includes('bracket') || mensajeLower.includes('frenillos')) {
        return { nombre: 'ortodoncia', encontrada: true };
    }
    if (mensajeLower.includes('rehabilit') || mensajeLower.includes('protesis') || mensajeLower.includes('corona')) {
        return { nombre: 'rehabilitacion', encontrada: true };
    }

    return null;
};

const detectarPreguntaPorRebaja = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesRebaja = ['rebaja', 'descuento', 'más barato', 'mas barato', 'oferta', 'promocion', 'promoción', 'reducir', 'menos precio', 'más económico', 'mas economico'];
    return patronesRebaja.some(patron => mensajeLower.includes(patron));
};

// ========================================
// FLUJO DE ESPECIALIDADES
// ========================================

export const flujoEspecialidades = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);
        const mensajeAcumulado = state.get('mensajeAcumulado') || ctx.body;

        // Detectar si ya viene con especialidad en el mensaje
        const especialidadDetectada = detectarEspecialidad(mensajeAcumulado);

        if (especialidadDetectada) {
            // Ya viene con especialidad específica
            let mensajeRespuesta = '';

            switch (especialidadDetectada.nombre) {
                case 'implantologia':
                    mensajeRespuesta = `¡${nombrePaciente}! 😊\n\n✅ Sí, ofrecemos atención en *Implantología*.\n\nEl médico de la clínica cuenta con experiencia en colocación de implantes dentales. ¿Te gustaría agendar una consulta de evaluación?`;
                    break;

                case 'ortodoncia':
                    mensajeRespuesta = `¡${nombrePaciente}! 😊\n\n✅ Sí, brindamos atención en *Ortodoncia*.\n\nEl médico trabaja con brackets tradicionales y estéticos según las necesidades del paciente. ¿Deseas agendar una cita para evaluación?`;
                    break;

                case 'rehabilitacion':
                    mensajeRespuesta = `¡${nombrePaciente}! 😊\n\n✅ Sí, atendemos casos de *Rehabilitación Oral*.\n\nEl médico realiza prótesis, coronas y distintos tratamientos de rehabilitación dental. ¿Te gustaría agendar una consulta?`;
                    break;
            }

            await responderConAnimacion(provider, ctx, mensajeRespuesta);

            // Guardar en historial
            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "ESPECIALIDADES") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "ESPECIALIDADES",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajeRespuesta,
                    fecha: new Date()
                });
            }

            // Guardar especialidad consultada en el estado
            await state.update({ especialidadConsultada: especialidadDetectada.nombre });

        } else {
            // NO viene con especialidad, preguntar qué necesita
            const mensajePregunta = `${nombrePaciente}! 😊\n¿En qué especialidad estás interesado?\nTenemos:\n🔹 Implantología\n🔹 Ortodoncia\n🔹 Rehabilitación Oral`;

            await responderConAnimacion(provider, ctx, mensajePregunta);

            // Guardar en historial
            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "ESPECIALIDADES") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "ESPECIALIDADES",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajePregunta,
                    fecha: new Date()
                });
            }

            // Marcar que está esperando respuesta de especialidad
            await state.update({ esperandoEspecialidad: true });
        }

        await state.update({ flujoActivo: 'especialidades' });
    })
    .addAnswer('', { capture: true }, async (ctx, { provider, state, gotoFlow, fallBack }) => {
        try {
            const respuesta = ctx.body.trim();
            const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
            const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);

            // Verificar si es nota de voz
            const isVoiceNote = ctx.body?.includes('_event_voice_note_');
            if (isVoiceNote) {
                await responderConAnimacion(provider, ctx, "Por favor, responde con texto para poder ayudarte mejor");
                return fallBack();
            }

            const esperandoEspecialidad = state.get('esperandoEspecialidad');
            const especialidadConsultada = state.get('especialidadConsultada');

            // Si está esperando que diga la especialidad
            if (esperandoEspecialidad) {
                const preguntaPorPrecio = /\b(precio|cuanto|cuesta|vale|costo|coste|tarifa|cuánto|a cuanto)\b/i.test(respuesta);


                if (preguntaPorPrecio) {
                    console.log('💰 Usuario pregunta por precio después de consultar especialidad');
                    // Guardar la especialidad consultada antes de redirigir
                    await state.update({
                        mensajeAcumulado: respuesta,
                        especialidadDesdeOtroFlujo: especialidadConsultada // ← NUEVO
                    });
                    return gotoFlow(flujoPrecios);
                }
                const especialidadDetectada = detectarEspecialidad(respuesta);

                if (especialidadDetectada) {
                    let mensajeRespuesta = '';

                    switch (especialidadDetectada.nombre) {
                        case 'implantologia':
                            mensajeRespuesta = `✅ ¡Excelente! Sí, ofrecemos atención en *Implantología*.\n\nEl médico de la clínica cuenta con experiencia en colocación de implantes dentales. ¿Te gustaría agendar una consulta ?`;
                            break;

                        case 'ortodoncia':
                            mensajeRespuesta = `✅ ¡Perfecto! Sí, brindamos atención en *Ortodoncia*.\n\nEl médico trabaja con brackets convencionales y estéticos según el caso. ¿Deseas agendar una cita?`;
                            break;

                        case 'rehabilitacion':
                            mensajeRespuesta = `✅ ¡Claro! Sí, atendemos tratamientos de *Rehabilitación Oral*.\n\nEl médico realiza prótesis, coronas y distintos procedimientos de rehabilitación. ¿Te gustaría agendar una consulta?`;
                            break;
                    }

                    await responderConAnimacion(provider, ctx, mensajeRespuesta);
                    await state.update({ esperandoEspecialidad: false, especialidadConsultada: especialidadDetectada.nombre });
                    return fallBack();
                } else {
                    // No detectó especialidad válida
                    await responderConAnimacion(provider, ctx, "Lo siento, no tengo información sobre esa especialidad. Nuestras especialidades son:\n🔹 Implantología\n🔹 Ortodoncia\n🔹 Rehabilitación Oral\n\n¿Alguna de estas te interesa?");
                    return fallBack();
                }
            }

            // Si ya consultó especialidad y ahora responde si quiere agendar
            if (especialidadConsultada) {
                const preguntaPorPrecio = /\b(precio|cuanto|cuesta|vale|costo|coste|tarifa|cuánto|a cuanto)\b/i.test(respuesta);


                if (preguntaPorPrecio) {
                    console.log('💰 Usuario pregunta por precio después de consultar especialidad');
                    // Guardar la especialidad consultada antes de redirigir
                    await state.update({
                        mensajeAcumulado: respuesta,
                        especialidadDesdeOtroFlujo: especialidadConsultada // ← NUEVO
                    });
                    return gotoFlow(flujoPrecios);
                }
                if (esRespuestaAfirmativa(respuesta)) {
                    console.log('✅ Usuario quiere agendar después de consultar especialidad');
                    return gotoFlow(flujoReserva);
                }

                if (esRespuestaNegativa(respuesta)) {
                    console.log('❌ Usuario no quiere agendar');
                    await responderConAnimacion(provider, ctx, `Entiendo ${nombrePaciente}, ¿en qué más te puedo ayudar?`);
                    await state.clear();
                    return;
                }
            }

            // Respuesta no clara
            await responderConAnimacion(provider, ctx, "Puedes replantear tu pregunta porfavor 😅");
            return fallBack();

        } catch (error) {
            console.error('❌ Error en flujoEspecialidades captura:', error);
            await responderConAnimacion(provider, ctx, "Ocurrió un error, intenta más tarde por favor");
            return;
        }
    });

// ========================================
// FLUJO DE PRECIOS
// ========================================

export const flujoPrecios = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);
        const mensajeAcumulado = state.get('mensajeAcumulado') || ctx.body;
        const especialidadDesdeOtroFlujo = state.get('especialidadDesdeOtroFlujo');

        if (especialidadDesdeOtroFlujo) {
            console.log('📋 Mostrando precio de especialidad consultada previamente:', especialidadDesdeOtroFlujo);

            let mensajeRespuesta = '';

            switch (especialidadDesdeOtroFlujo) {
                case 'implantologia':
                    mensajeRespuesta = `💉 *Implantología*\nPrecio: 3,000 Bs.\n\n¿Te gustaría agendar una cita?`;
                    break;
                case 'ortodoncia':
                    mensajeRespuesta = `🦷 *Ortodoncia*\nPrecio: 5,000 Bs.\n\n¿Te gustaría agendar una cita?`;
                    break;
                case 'rehabilitacion':
                    mensajeRespuesta = `✨ *Rehabilitación Oral*\nPrecio: 15,000 - 20,000 Bs.\n(El precio varía según el tratamiento específico)\n\n¿Te gustaría agendar una evaluación?`;
                    break;
            }

            await responderConAnimacion(provider, ctx, mensajeRespuesta);

            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "PRECIOS") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "PRECIOS",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajeRespuesta,
                    fecha: new Date()
                });
            }

            await state.update({
                especialidadPrecio: especialidadDesdeOtroFlujo,
                flujoActivo: 'precios',
                especialidadDesdeOtroFlujo: null // Limpiar después de usar
            });

            return; // ← IMPORTANTE: Salir aquí para no continuar con el resto del código
        }

        // Detectar si pregunta por rebaja/descuento
        if (detectarPreguntaPorRebaja(mensajeAcumulado)) {
            const mensajeRebaja = `Hola ${nombrePaciente}! 😊\n\nPara conversar sobre opciones de pago, facilidades o planes especiales, te invito a que te apersones a la clínica.\n\nAllí podremos revisar tu caso específico y brindarte la mejor opción. ¿Te gustaría agendar una cita?`;

            await responderConAnimacion(provider, ctx, mensajeRebaja);

            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "PRECIOS") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "PRECIOS",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajeRebaja,
                    fecha: new Date()
                });
            }

            await state.update({ flujoActivo: 'precios', preguntoPorRebaja: true });
            return;
        }

        // Detectar si ya viene con especialidad/tratamiento en el mensaje
        const especialidadDetectada = detectarEspecialidad(mensajeAcumulado);

        if (especialidadDetectada) {
            // Ya viene con especialidad específica
            let mensajeRespuesta = '';

            switch (especialidadDetectada.nombre) {
                case 'implantologia':
                    mensajeRespuesta = `Hola ${nombrePaciente}! 😊\n\n💉 *Implantología*\nPrecio: 3,000 Bs.\n\n¿Te gustaría agendar una cita?`;
                    break;
                case 'ortodoncia':
                    mensajeRespuesta = `Hola ${nombrePaciente}! 😊\n\n🦷 *Ortodoncia*\nPrecio: 5,000 Bs.\n\n¿Te gustaría agendar una cita?`;
                    break;
                case 'rehabilitacion':
                    mensajeRespuesta = `Hola ${nombrePaciente}! 😊\n\n✨ *Rehabilitación Oral*\nPrecio: 15,000 - 20,000 Bs.\n(El precio varía según el tratamiento específico)\n\n¿Te gustaría agendar una evaluación?`;
                    break;
            }

            await responderConAnimacion(provider, ctx, mensajeRespuesta);

            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "PRECIOS") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "PRECIOS",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajeRespuesta,
                    fecha: new Date()
                });
            }

            await state.update({ especialidadPrecio: especialidadDetectada.nombre });

        } else {
            // NO viene con especialidad, mostrar todos los precios
            const mensajePrecios = `${nombrePaciente}! 😊\nEstos son nuestros precios:\n\n` +
                `💉 *Implantología*\n   3,000 Bs.\n\n` +
                `🦷 *Ortodoncia*\n   5,000 Bs.\n\n` +
                `✨ *Rehabilitación Oral*\n   15,000 - 20,000 Bs.\n\n` +
                `¿Te gustaría agendar una cita para algún tratamiento?`;

            await responderConAnimacion(provider, ctx, mensajePrecios);

            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);
            if (ultimaIntencion !== "PRECIOS") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                    intencion: "PRECIOS",
                    pregunta: mensajeAcumulado,
                    respuesta: mensajePrecios,
                    fecha: new Date()
                });
            }

            await state.update({ mostroTodosPrecios: true });
        }

        await state.update({ flujoActivo: 'precios' });
    })
    .addAnswer('', { capture: true }, async (ctx, { provider, state, gotoFlow, fallBack }) => {
        try {
            const respuesta = ctx.body.trim();
            const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
            const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);
            

            // Verificar si es nota de voz
            const isVoiceNote = ctx.body?.includes('_event_voice_note_');
            if (isVoiceNote) {
                await responderConAnimacion(provider, ctx, "Por favor, responde con texto para poder ayudarte mejor");
                return fallBack();
            }

            // Detectar si pregunta por rebaja ahora
            if (detectarPreguntaPorRebaja(respuesta)) {
                const mensajeRebaja = `${nombrePaciente} Para conversar sobre opciones de pago 💳, facilidades o planes especiales, te invito a que te apersones a la clínica.\n\nAllí podremos revisar tu caso y brindarte la mejor opción. ¿Te gustaría agendar una cita?`;
                await responderConAnimacion(provider, ctx, mensajeRebaja);
                await state.update({ preguntoPorRebaja: true });
                return fallBack();
            }

            const preguntoPorRebaja = state.get('preguntoPorRebaja');

            // Si preguntó por rebaja y ahora responde
            if (preguntoPorRebaja) {
                if (esRespuestaAfirmativa(respuesta)) {
                    console.log('✅ Usuario quiere agendar después de preguntar por rebaja');
                    return gotoFlow(flujoReserva);
                }

                if (esRespuestaNegativa(respuesta)) {
                    console.log('❌ Usuario no quiere agendar');
                    await responderConAnimacion(provider, ctx, "Entiendo, cuando desees puedes visitarnos o escribirnos. ¿En qué más te puedo ayudar?");
                    await state.clear();
                    return;
                }
                return gotoFlow(detectarIntencion)
            }

            // Si ya vio precios y responde si quiere agendar
            const especialidadPrecio = state.get('especialidadPrecio');
            const mostroTodosPrecios = state.get('mostroTodosPrecios');

            if (especialidadPrecio || mostroTodosPrecios) {
                if (esRespuestaAfirmativa(respuesta)) {
                    console.log('✅ Usuario quiere agendar después de ver precios');
                    await state.clear();
                    return gotoFlow(flujoReserva);
                }

                if (esRespuestaNegativa(respuesta)) {
                    console.log('❌ Usuario no quiere agendar');
                    await responderConAnimacion(provider, ctx, `Entiendo, ${nombrePaciente}, ¿en qué más te puedo ayudar?`);
                    await state.clear();
                    return;
                }
            }

            // Respuesta no clara
            await state.update({ mensajeAcumulado: respuesta })
            /*await responderConAnimacion(provider, ctx, "¿Deseas agendar una cita o tienes alguna otra consulta?");*/
            return gotoFlow(detectarIntencion);

        } catch (error) {
            console.error('❌ Error en flujoPrecios captura:', error);
            await responderConAnimacion(provider, ctx, "Ocurrió un error, intenta más tarde por favor");
            return;
        }
    });