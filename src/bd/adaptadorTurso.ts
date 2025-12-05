// src/bd/adaptadorListaNegra.ts

import { createClient, type Client } from '@libsql/client';

interface NumeroListaNegra {
    id: number;
    numero: string;
    fecha_bloqueo: string;
    estado: string;
}

class AdaptadorListaNegraTurso {
    private cliente: Client;

    constructor() {
        this.cliente = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN!,
        });

        this.inicializarTabla();
    }

    /**
     * Crea la tabla si no existe
     */
    private async inicializarTabla(): Promise<void> {
        try {
            await this.cliente.execute(`
        CREATE TABLE IF NOT EXISTS lista_negra (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          fecha_bloqueo DATETIME NOT NULL,
          estado TEXT NOT NULL DEFAULT 'activo'
        )
      `);
           
        } catch (error) {
            console.error('❌ Error al inicializar tabla lista_negra:', error);
        }
    }

    /**
     * Limpia un número de teléfono eliminando caracteres no numéricos
     */
    private limpiarNumero(numero: string): string {
        return numero.replace(/\D/g, '');
    }

    /**
     * Agrega un número a la lista negra
     */
    async agregar(numero: string): Promise<boolean> {
        try {
            const numeroLimpio = this.limpiarNumero(numero);

            // Verificar si ya existe
            const existe = await this.estaBloqueado(numeroLimpio);
            if (existe) {
                
                return false;
            }

            const fechaActual = new Date().toISOString();

            const numeroConPrefijo = `591${numeroLimpio}`;
            await this.cliente.execute({
                sql: `INSERT INTO lista_negra (numero, fecha_bloqueo, estado) VALUES (?, ?, ?)`,
                args: [numeroConPrefijo, fechaActual, 'activo']
            });


            
            return true;
        } catch (error) {
            console.error('❌ Error al agregar número a lista negra:', error);
            return false;
        }
    }

    /**
     * Elimina un número de la lista negra (marca como inactivo)
     */
    async eliminar(numero: string): Promise<boolean> {
        try {
            const numeroLimpio = this.limpiarNumero(numero);

            const resultado = await this.cliente.execute({
                sql: `UPDATE lista_negra SET estado = 'inactivo' WHERE numero = ? AND estado = 'activo'`,
                args: [numeroLimpio]
            });

            if (resultado.rowsAffected > 0) {
                
                return true;
            }

            
            return false;
        } catch (error) {
            console.error('❌ Error al eliminar número de lista negra:', error);
            return false;
        }
    }

    /**
     * Verifica si un número está bloqueado
     */
    async estaBloqueado(numero: string): Promise<boolean> {
        try {
            const numeroLimpio = this.limpiarNumero(numero);
          

            const resultado = await this.cliente.execute({
                sql: `SELECT COUNT(*) as count FROM lista_negra WHERE numero = ? AND estado = 'activo'`,
                args: [numeroLimpio]
            });

            const count = resultado.rows[0]?.count as number;
            return count > 0;
        } catch (error) {
            console.error('❌ Error al verificar número en lista negra:', error);
            return false;
        }
    }

    /**
     * Obtiene todos los números bloqueados activos
     */
    async obtenerTodos(): Promise<string[]> {
        try {
            const resultado = await this.cliente.execute(`
        SELECT numero FROM lista_negra WHERE estado = 'activo' ORDER BY fecha_bloqueo DESC
      `);

            return resultado.rows.map((row) => row.numero as string);
        } catch (error) {
            console.error('❌ Error al obtener números de lista negra:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los números con información completa
     */
    async obtenerTodosConInfo(): Promise<NumeroListaNegra[]> {
        try {
            const resultado = await this.cliente.execute(`
        SELECT * FROM lista_negra WHERE estado = 'activo' ORDER BY fecha_bloqueo DESC
      `);

            return resultado.rows.map((row) => ({
                id: row.id as number,
                numero: row.numero as string,
                fecha_bloqueo: row.fecha_bloqueo as string,
                estado: row.estado as string,
            }));
        } catch (error) {
            console.error('❌ Error al obtener información completa:', error);
            return [];
        }
    }

    /**
     * Elimina permanentemente un número (uso con precaución)
     */
    async eliminarPermanente(numero: string): Promise<boolean> {
        try {
            const numeroLimpio = this.limpiarNumero(numero);

            const resultado = await this.cliente.execute({
                sql: `DELETE FROM lista_negra WHERE numero = ?`,
                args: [numeroLimpio]
            });

            if (resultado.rowsAffected > 0) {
                
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error al eliminar permanentemente:', error);
            return false;
        }
    }

    /**
     * Limpia toda la lista negra (marca todos como inactivos)
     */
    async limpiar(): Promise<boolean> {
        try {
            await this.cliente.execute(`
        UPDATE lista_negra SET estado = 'inactivo' WHERE estado = 'activo'
      `);

           
            return true;
        } catch (error) {
            console.error('❌ Error al limpiar lista negra:', error);
            return false;
        }
    }

    /**
     * Cuenta cuántos números están bloqueados
     */
    async contar(): Promise<number> {
        try {
            const resultado = await this.cliente.execute(`
        SELECT COUNT(*) as count FROM lista_negra WHERE estado = 'activo'
      `);

            return resultado.rows[0]?.count as number;
        } catch (error) {
            console.error('❌ Error al contar números bloqueados:', error);
            return 0;
        }
    }

    /**
     * Reactiva un número que estaba marcado como inactivo
     */
    async reactivar(numero: string): Promise<boolean> {
        try {
            const numeroLimpio = this.limpiarNumero(numero);

            const resultado = await this.cliente.execute({
                sql: `UPDATE lista_negra SET estado = 'activo', fecha_bloqueo = ? WHERE numero = ?`,
                args: [new Date().toISOString(), numeroLimpio]
            });

            if (resultado.rowsAffected > 0) {
                
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error al reactivar número:', error);
            return false;
        }
    }
}

// Exportar instancia singleton
export const listaNegraTurso = new AdaptadorListaNegraTurso();