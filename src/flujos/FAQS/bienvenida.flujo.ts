import { addKeyword, EVENTS } from '@builderbot/bot'
import { responderConAnimacion } from '../../utilidades/chatUX'
import { detectarIntencion } from '../detectar.intencion';
import { instanciaAdaptadorMongo } from '../../bd/adaptadorMongo';
import { obtenerMensaje } from '~/utilidades/mensajesDiferentes';
import { obtenerNumeroTelefono } from '~/utilidades/telefono.util';
import { validarNombreConIA, formatearNombre } from '~/utilidades/validarNombreRegistro';
export const bienvenidaFlujo = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { provider, state }) => {
        try {
            const numeroPaciente = (ctx.key?.remoteJid || ctx.from).split('@')[0];
            const paciente = await instanciaAdaptadorMongo.buscarPacientePorNumero(numeroPaciente);
            const nombrePaciente = paciente.nombre;

            // Obtener la fecha de la última conversación
            const ultimaConversacion = await instanciaAdaptadorMongo.obtenerUltimaConversacion(numeroPaciente);

            let mensajeSaludo: string;

            if (ultimaConversacion) {
                // Verificar si la última conversación fue hoy
                const hoy = new Date();
                const fechaUltima = new Date(ultimaConversacion);


                const esHoy = hoy.getDate() === fechaUltima.getDate() &&
                    hoy.getMonth() === fechaUltima.getMonth() &&
                    hoy.getFullYear() === fechaUltima.getFullYear();

                if (esHoy) {
                    mensajeSaludo = obtenerMensaje('saludo', 'repetido_hoy', { nombre: nombrePaciente });
                } else {
                    mensajeSaludo = obtenerMensaje('saludo', 'nuevo_dia', { nombre: nombrePaciente });
                }
            } else {
                // Primera conversación del paciente
                mensajeSaludo = obtenerMensaje('saludo', 'nuevo_dia', { nombre: nombrePaciente });
            }
            const mensajeAcumulado = state.get('mensajeAcumulado') || state.get('mensajePorNotaDeVoz');
            // Agregar al historial
            const ultimaIntencion = await instanciaAdaptadorMongo.obtenerUltimaIntencion(numeroPaciente);

            if (ultimaIntencion !== "SALUDO") {
                await instanciaAdaptadorMongo.agregarHistorial(numeroPaciente, {
                intencion: "SALUDO",
                pregunta: mensajeAcumulado,
                respuesta: `${mensajeSaludo}`,
                fecha: new Date()
            });
            } 
            await responderConAnimacion(provider, ctx, mensajeSaludo);
        } catch (error) {
            console.error('❌ Error al buscar paciente:', error);
            await responderConAnimacion(null, ctx, 'Hubo un problema al buscar tu información. Intenta nuevamente 🙏');
        }
    })


// Flujo para capturar el nombre
export const flujoRegistro = addKeyword(EVENTS.ACTION)
    // Primer mensaje de bienvenida
    .addAction(async (ctx, { provider }) => {
        const mensaje = obtenerMensaje('registrar', 'primera_vez');
        await responderConAnimacion(provider, ctx, mensaje);
    })

    // Captura de respuesta
    .addAnswer('', { capture: true }, async (ctx, { state, gotoFlow, provider, fallBack }) => {
    const nombreIngresado = ((ctx.body || '').trim())
    const numeroCelular = obtenerNumeroTelefono(ctx);  
    
    // Validación directa con IA (con fallback automático a reglas)
    const validacion = await validarNombreConIA(nombreIngresado);
    
    
    if (!validacion.valido) {
        const intentos = (state.get('intentosNombre') || 0) + 1;
        await state.update({ intentosNombre: intentos });

        const mensajeError = validacion.razon || 'Por favor ingresa un nombre válido';
        await responderConAnimacion(provider, ctx, mensajeError);
        
        if (intentos >= 3) {
            await responderConAnimacion(
                provider, 
                ctx, 
                '⚠️ Has superado los intentos. En que te puedo ayudar?'
            );
            await state.clear();
            return;
        }
        
        return fallBack();
    }

    try {
        // Formatear el nombre correctamente (Primera letra mayúscula)
        const nombreFormateado = formatearNombre(nombreIngresado);
        
        
        // Guardar en la base de datos con nombre formateado
        await instanciaAdaptadorMongo.agregarOActualizarPaciente({
            nombre: nombreFormateado,
            numero: numeroCelular,
            estado: "ACTIVO",
            email: '',
            historial: []
        })

        // Usar nombre formateado en el mensaje
        const mensaje = obtenerMensaje('registrar', 'agradecimiento', { nombre: nombreFormateado });
        await responderConAnimacion(provider, ctx, mensaje)
        
        await state.update({ 
            pacienteRegistrado: true,
            nombrePaciente: nombreFormateado, // Guardar para uso posterior
            intentosNombre: 0 
        })

        return gotoFlow(detectarIntencion)
        
    } catch (error) {
        console.error('❌ Error al registrar paciente:', error)
        const mensajeError = 'Hubo un problema al registrarte. Intenta nuevamente 🙏'
        await responderConAnimacion(provider, ctx, mensajeError)
    }
})