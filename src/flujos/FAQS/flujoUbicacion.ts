import { addKeyword } from "@builderbot/bot";
import { EVENTS } from "@builderbot/bot";
import { enviarImagen, enviarImagenConReintentos } from "../../utilidades/baileysSocketMensajes";
import fs from 'fs';
import { responderConAnimacion } from "../../utilidades/chatUX";
import { instanciaAdaptadorMongo } from "../../bd/adaptadorMongo";
import { obtenerMensaje } from "~/utilidades/mensajesDiferentes";
import { config } from "../../configuracion";
import { flujoReserva } from "../agendar_cita/reserva.flujo";
import { detectarIntencion } from "../detectar.intencion";

// Función para detectar respuestas afirmativas
const esRespuestaAfirmativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesSi = ['si', 'sí', 'claro', 'ok', 'vale', 'dale', 'afirmativo', 'confirmo', 'quiero', 'me interesa', 'por favor', 'seguro'];
    return patronesSi.some(patron => mensajeLower.includes(patron));
};

// Función para detectar respuestas negativas
const esRespuestaNegativa = (mensaje: string): boolean => {
    const mensajeLower = mensaje.toLowerCase().trim();
    const patronesNo = ['no', 'nop', 'nope', 'nanai', 'negativo', 'no quiero', 'no gracias', 'ahora no', 'luego', 'después', 'tal vez'];
    return patronesNo.some(patron => mensajeLower.includes(patron));
};

export const flujoUbicacion = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
        const nombrePaciente = await instanciaAdaptadorMongo.obtenerNombrePaciente(numeroPaciente);

        // Enviar primera ubicación
        const mensaje1 = "📍 *Sucursal 1 - Centro*";
        const linkMaps1 = config.direccionGoogleMapsSucursal1; // Agregar en config

        await enviarImagenConReintentos(
            provider,
            ctx.key.remoteJid,
            fs.readFileSync('assets/sucursal1.png'),
            mensaje1 + ": \n" + linkMaps1
        );

        // Pequeña pausa entre envíos
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Enviar segunda ubicación
        const mensaje2 = "📍 *Sucursal 2 - Norte*";
        const linkMaps2 = config.direccionGoogleMapsSucursal2; // Agregar en config

        await enviarImagenConReintentos(
            provider,
            ctx.key.remoteJid,
            fs.readFileSync('assets/sucursal2.jpg'),
            mensaje2 + ": \n" + linkMaps2
        );

        // Preguntar si quiere ayuda para decidir
        const mensajePregunta = `${nombrePaciente}, ¿quieres que te ayude a decidir cuál te queda más cerca? 🗺️`;
        await responderConAnimacion(provider, ctx, mensajePregunta);

        const mensajeAcumulado = state.get('mensajeAcumulado');
        const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);

        if (ultimaIntencion !== "UBICACION") {
            await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                intencion: "UBICACION",
                pregunta: mensajeAcumulado,
                respuesta: `${mensaje1}\n[Imagen y mapa enviados]\n${mensaje2}\n[Imagen y mapa enviados]\n${mensajePregunta}`,
                fecha: new Date()
            });
        } else {
            
        }

        await state.update({ esperandoDecisionUbicacion: true });
    })
    .addAnswer('', { capture: true }, async (ctx, { provider, gotoFlow, fallBack, state }) => {
        try {
            const respuesta = ctx.body.trim();
            const esperandoDecision = state.get('esperandoDecisionUbicacion');

            // Verificar si es nota de voz
            const isVoiceNote = ctx.body?.includes('_event_voice_note_');
            if (isVoiceNote) {
                await responderConAnimacion(provider, ctx, "Por favor, responde con texto si necesitas ayuda para decidir");
                return fallBack();
            }

            if (esperandoDecision) {
                // Usuario responde si quiere ayuda o no
                if (esRespuestaAfirmativa(respuesta)) {
                    
                    await responderConAnimacion(provider, ctx, "¡Perfecto! Por favor comparte tu ubicación actual y te diré cuál sucursal te queda más cerca 📍");
                    await state.update({ esperandoUbicacionUsuario: true, esperandoDecisionUbicacion: false });
                    return fallBack();
                }

                if (esRespuestaNegativa(respuesta)) {
                    
                    await state.update({ esperandoDecisionUbicacion: false });
                    const mensajeAgendar = "Entendido. ¿Te gustaría agendar una cita en alguna de nuestras sucursales?";
                    await responderConAnimacion(provider, ctx, mensajeAgendar);
                    await state.update({ esperandoConfirmacionAgenda: true });
                    return fallBack();
                }

                // Respuesta no clara
                await responderConAnimacion(provider, ctx, "No entendí tu respuesta. ¿Necesitas ayuda para decidir qué sucursal te queda más cerca? Por favor responde Sí o No");
                return fallBack();
            }

            const esperandoUbicacion = state.get('esperandoUbicacionUsuario');
            if (esperandoUbicacion) {
                // Verificar si envió ubicación - múltiples estructuras posibles
                

                let latitude, longitude;

                // Intentar diferentes estructuras
                if (ctx.message?.locationMessage) {
                    latitude = ctx.message.locationMessage.degreesLatitude || ctx.message.locationMessage.latitude;
                    longitude = ctx.message.locationMessage.degreesLongitude || ctx.message.locationMessage.longitude;
                } else if (ctx.locationMessage) {
                    latitude = ctx.locationMessage.degreesLatitude || ctx.locationMessage.latitude;
                    longitude = ctx.locationMessage.degreesLongitude || ctx.locationMessage.longitude;
                } else if (ctx.location) {
                    latitude = ctx.location.latitude || ctx.location.lat;
                    longitude = ctx.location.longitude || ctx.location.lon;
                }

               

                if (latitude && longitude) {

                    // Coordenadas de las sucursales (agregar en config)
                    const sucursal1 = {
                        lat: config.sucursal1Lat,
                        lon: config.sucursal1Lon,
                        nombre: "Sucursal Centro",
                        direccion: config.direccionSucursal1,
                        link: config.direccionGoogleMapsSucursal1
                    };

                    const sucursal2 = {
                        lat: config.sucursal2Lat,
                        lon: config.sucursal2Lon,
                        nombre: "Sucursal Norte",
                        direccion: config.direccionSucursal2,
                        link: config.direccionGoogleMapsSucursal2
                    };

                    // Calcular distancias (fórmula de Haversine)
                    const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                        const R = 6371; // Radio de la Tierra en km
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                            Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        return R * c;
                    };

                    const distancia1 = calcularDistancia(latitude, longitude, sucursal1.lat, sucursal1.lon);
                    const distancia2 = calcularDistancia(latitude, longitude, sucursal2.lat, sucursal2.lon);

                    const sucursalCercana = distancia1 < distancia2 ? sucursal1 : sucursal2;
                    const distanciaCercana = Math.min(distancia1, distancia2).toFixed(1);

                    const mensajeRecomendacion = `✅ *Te recomiendo la ${sucursalCercana.nombre}*\n\n` +
                        `📍 ${sucursalCercana.direccion}\n` +
                        `📏 Está a aproximadamente ${distanciaCercana} km de tu ubicación\n\n` +
                        `🗺️ ${sucursalCercana.link}\n\n` +
                        `¿Te gustaría agendar una cita en esta sucursal?`;

                    await responderConAnimacion(provider, ctx, mensajeRecomendacion);
                    await state.update({
                        esperandoUbicacionUsuario: false,
                        esperandoConfirmacionAgenda: true,
                        sucursalRecomendada: sucursalCercana.nombre
                    });
                    return fallBack();
                } else {
                    if (esRespuestaNegativa(respuesta)) {
                        await responderConAnimacion(provider, ctx, "Entendido. ¿En que más te puedo ayudar?");
                        await state.clear()
                        return;
                    } else {
                        await responderConAnimacion(provider, ctx, "Por favor, comparte tu ubicación usando el botón de adjuntar 📎 > Ubicación 📍");
                        return fallBack();
                    }
                }
            }

            const esperandoAgenda = state.get('esperandoConfirmacionAgenda');
            if (esperandoAgenda) {
                if (esRespuestaAfirmativa(respuesta)) {
                    
                    await state.clear();
                    return gotoFlow(flujoReserva);
                }

                if (esRespuestaNegativa(respuesta)) {
                    
                    await responderConAnimacion(provider, ctx, "Entiendo, ¿en qué más te puedo ayudar?");
                    await state.clear();
                    return;
                }

                // Si no es clara la respuesta
                await state.clear();
                await state.update({ mensajeAcumulado: respuesta });
                return gotoFlow(detectarIntencion);
            }

        } catch (error) {
            console.error('❌ Error en flujoUbicacion captura:', error);
            await responderConAnimacion(provider, ctx, "Ocurrió un error, intenta más tarde por favor");
            await state.clear();
            return;
        }
    });