import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../configuracion/';
import fs from 'fs';
import path from 'path';

// Interfaces para TypeScript
interface IEntradaHistorial {
    intencion: string;
    pregunta: string;
    respuesta: string;
    fecha: Date;
}

interface ICliente extends Document {
    nombre: string;
    numero: string;
    estado: string;
    email?: string;                    // ← AGREGAR
    fecha_creacion: Date;
    historial: IEntradaHistorial[];
}

interface IDatosCliente {
    nombre?: string;
    numero: string;
    estado: string;
    email?: string;
    historial?: IEntradaHistorial[];
}

// Esquema para el historial
const EsquemaHistorial = new Schema<IEntradaHistorial>({
    intencion: { type: String, required: true },
    pregunta: { type: String, required: true },
    respuesta: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
});

// Esquema para el cliente con solo nombre, numero e historial
const EsquemaCliente = new Schema<ICliente>({
    nombre: { type: String, required: true },
    numero: { type: String, required: true, unique: true },
    estado: { type: String },
    email: { type: String, required: false },
    fecha_creacion: { type: Date, default: Date.now },
    historial: [EsquemaHistorial]
});

// Modelo de Mongoose para el cliente
export const Cliente: Model<ICliente> = mongoose.model<ICliente>('typeScriptBD', EsquemaCliente);

// Clase MongoAdapter para manejar la base de datos
class AdaptadorMongo {
    private uriBaseDatos: string;
    private estaConectado: boolean = false;

    constructor(uriBaseDatos: string) {
        this.uriBaseDatos = uriBaseDatos;
        this.conectar();
    }

    // Conexión a MongoDB con mejor manejo de errores
    private async conectar(): Promise<void> {
        try {
            // Verificar que la URI existe
            if (!this.uriBaseDatos) {
                throw new Error('URI de MongoDB no está definida');
            }

            await mongoose.connect(this.uriBaseDatos, {
                serverSelectionTimeoutMS: 10000, // Timeout después de 10s
                socketTimeoutMS: 45000, // Cerrar sockets después de 45s de inactividad
            });
            this.estaConectado = true;
            
        } catch (error: any) {
            this.estaConectado = false;
            console.error('❌ Error al conectar a MongoDB:');
            return;
        }
    }

    // Verificar conexión antes de operaciones
    private async asegurarConexion(): Promise<boolean> {
        if (!this.estaConectado) {
            
            await this.conectar();
        }
        return this.estaConectado;
    }

    // Método mejorado para agregar o actualizar cliente
    async agregarOActualizarPaciente(datosCliente: IDatosCliente): Promise<ICliente | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }
            // Validar datos requeridos
            if (!datosCliente.numero) {
                throw new Error('Número de cliente es requerido');
            }
            const clienteExistente = await Cliente.findOne({ numero: datosCliente.numero });

            if (clienteExistente) {
                // Actualizar solo el nombre si se proporciona, pero nunca sobrescribir el historial
                if (datosCliente.nombre) clienteExistente.nombre = datosCliente.nombre;
                // El historial se maneja exclusivamente a través del método agregarHistorial
                if (datosCliente.email) clienteExistente.email = datosCliente.email;

                await clienteExistente.save();
                
                return clienteExistente;
            } else {
                // Asegurar que el historial esté inicializado
                const datosCompletos: IDatosCliente = {
                    nombre: datosCliente.nombre || "Usuario",
                    numero: datosCliente.numero,
                    estado: "ACTIVO",
                    email: datosCliente.email,                    // ← AGREGAR
                    historial: datosCliente.historial || []
                };

                const nuevoCliente = new Cliente(datosCompletos);
                await nuevoCliente.save();
                
                return nuevoCliente;
            }
        } catch (error: any) {
            console.error("❌ Error al agregar o actualizar cliente:", error);

            // Si es error de duplicado, intentar buscar el cliente existente
            if (error.code === 11000) {
                return await this.buscarPacientePorNumero(datosCliente.numero);
            }

            return null;
        }
    }

    // Buscar cliente por numero
    async buscarPacientePorNumero(numero: string): Promise<ICliente | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero }).exec();
            return cliente;
        } catch (error: any) {
            console.error("❌ Error al buscar cliente:", error);
            return null;
        }
    }

    // Agregar historial a un cliente
    async agregarHistorial(numeroCliente: string, datosHistorial: IEntradaHistorial): Promise<ICliente | null> {
        try {
            if (!(await this.asegurarConexion())) {
                
                throw new Error('No hay conexión a MongoDB');
            }
            // Validar datos de historial
            if (!datosHistorial.pregunta || !datosHistorial.respuesta) {
                console.error("❌ Datos de historial incompletos:", {
                    pregunta: !!datosHistorial.pregunta,
                    respuesta: !!datosHistorial.respuesta
                });
                return null;
            }
            const cliente = await Cliente.findOne({ numero: numeroCliente }).exec();

            if (!cliente) {
                console.error(`❌ Cliente con numero ${numeroCliente} no encontrado en la base de datos`);
                // Intentar mostrar todos los clientes para debugging
                const todosLosClientes = await Cliente.find({}, 'numero nombre').exec();
                
                return null;
            }
            

            const entradaCompleta: IEntradaHistorial = {
                intencion: datosHistorial.intencion,
                pregunta: String(datosHistorial.pregunta).trim(),
                respuesta: String(datosHistorial.respuesta).trim(),
                fecha: datosHistorial.fecha || new Date()
            };

            cliente.historial.push(entradaCompleta);

            cliente.markModified('historial');

            const clienteGuardado = await cliente.save();

            const clienteVerificacion = await Cliente.findOne({ numero: numeroCliente }).exec();
            

            return clienteGuardado;
        } catch (error: any) {
            console.error("❌ Error al agregar historial:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            if (error.errors) {
                console.error("Validation errors:", error.errors);
            }
            return null;
        }
    }

    // Obtener nombre del paciente
    async obtenerNombrePaciente(numero: string): Promise<string | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero }).select('nombre').exec();
            return cliente?.nombre || null;
        } catch (error: any) {
            console.error("❌ Error al obtener nombre del cliente:", error);
            return null;
        }
    }
    async obtenerEmailPaciente(numero: string): Promise<string | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero }).select('email').exec();
            return cliente?.email || null;
        } catch (error: any) {
            console.error("❌ Error al obtener nombre del cliente:", error);
            return null;
        }
    }
    async obtenerUltimaIntencion(numero: string): Promise<string | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero }).select('historial').exec();

            if (!cliente || !cliente.historial || cliente.historial.length === 0) {
               
                return null;
            }

            // Obtener la última entrada del historial
            const ultimaEntrada = cliente.historial[cliente.historial.length - 1];

            

            return ultimaEntrada.intencion;
        } catch (error: any) {
            console.error("❌ Error al obtener última intención:", error);
            return null;
        }
    }
    async obtenerUltimasConversacionesGemini(numero: string, limite: number = 2): Promise<Array<{ pregunta: string, respuesta: string }> | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero }).select('historial').exec();

            if (!cliente || !cliente.historial || cliente.historial.length === 0) {
                
                return null;
            }

            // Tomar las últimas 10 entradas del historial (búsqueda limitada)
            const historialReciente = cliente.historial.slice(-10);

            // Filtrar solo las que tienen intención "GEMINI" y tomar las últimas 2
            const conversacionesGemini = historialReciente
                .filter(entrada => entrada.intencion === "GEMINI")
                .slice(-limite)
                .map(entrada => ({
                    pregunta: entrada.pregunta,
                    respuesta: entrada.respuesta
                }));

            if (conversacionesGemini.length === 0) {
                
                return null;
            }

            

            return conversacionesGemini;
        } catch (error: any) {
            console.error("❌ Error al obtener conversaciones Gemini:", error);
            return null;
        }
    }

    async obtenerUltimaConversacion(numeroCliente: string): Promise<Date | null> {
        try {
            if (!(await this.asegurarConexion())) {
                
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOne({ numero: numeroCliente }).exec();

            if (!cliente.historial || cliente.historial.length === 0) {
                
                return null;
            }
            // Obtener la última entrada del historial
            const ultimaEntrada = cliente.historial[cliente.historial.length - 1];

            return ultimaEntrada.fecha;
        } catch (error: any) {
            console.error("❌ Error al obtener última conversación:", error);
            return null;
        }
    }

    async cambiarEstado(numero: string, nuevoEstado: string): Promise<ICliente | null> {
        try {
            if (!(await this.asegurarConexion())) {
                throw new Error('No hay conexión a MongoDB');
            }

            const cliente = await Cliente.findOneAndUpdate(
                { numero },
                { estado: nuevoEstado },
                { new: true } // Retorna el documento actualizado
            ).exec();

            if (!cliente) {
                console.error(`❌ Cliente con numero ${numero} no encontrado`);
                return null;
            }

            
            return cliente;
        } catch (error: any) {
            console.error("❌ Error al cambiar estado:", error);
            return null;
        }
    }

}

// Exportar una instancia de AdaptadorMongo
export const instanciaAdaptadorMongo = new AdaptadorMongo(config.mongoDb_uri);