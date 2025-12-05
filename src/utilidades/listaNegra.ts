// src/utilidades/blacklistPersistente.ts

import fs from 'fs';
import path from 'path';

const ARCHIVO_LISTA_NEGRA = path.join(process.cwd(), 'data', 'listaNegra.json');

class ListaNegraPersistente {
  private LN_numeros: Set<string> = new Set();

  constructor() {
    this.cargarDesdeArchivo();
  }

  // Cargar blacklist desde archivo
  private cargarDesdeArchivo(): void {
    try {
      // Crear directorio si no existe
      const dir = path.dirname(ARCHIVO_LISTA_NEGRA);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Cargar archivo si existe
      if (fs.existsSync(ARCHIVO_LISTA_NEGRA)) {
        const data = fs.readFileSync(ARCHIVO_LISTA_NEGRA, 'utf-8');
        const numeros = JSON.parse(data) as string[];
        this.LN_numeros = new Set(numeros);
        console.log(`📋 Lista negra cargada: ${numeros.length} números`); // ⭐ CORREGIDO
      } else {
        console.log('📋 Lista negra vacía, creando archivo...');
      }
    } catch (error) {
      console.error('❌ Error al cargar blacklist:', error);
    }
  }

  // Guardar blacklist en archivo
private guardarEnArchivo(): void {
  try {
    const numeros = Array.from(this.LN_numeros);
    const contenido = JSON.stringify(numeros, null, 2);
    
    console.log('📝 Guardando en:', ARCHIVO_LISTA_NEGRA);
    console.log('📝 Contenido:', contenido);
    
    fs.writeFileSync(ARCHIVO_LISTA_NEGRA, contenido);
    
    // Verificar que se guardó
    const verificar = fs.readFileSync(ARCHIVO_LISTA_NEGRA, 'utf-8');
    console.log('✅ Verificado, contenido guardado:', verificar);
    
  } catch (error) {
    console.error('❌ Error al guardar blacklist:', error);
  }
}

  agregar(numero: string): boolean {
    const cleanNumber = this.cleanNumber(numero);
    if (this.LN_numeros.has(cleanNumber)) {
      console.log(`⚠️ Número ya bloqueado: ${cleanNumber}`);
      return false;
    }
    this.LN_numeros.add(cleanNumber);
    this.guardarEnArchivo();
    console.log(`🚫 Número bloqueado: ${cleanNumber}`); // ⭐ CORREGIDO
    return true;
  }

  eliminar(numero: string): boolean {
    const cleanNumber = this.cleanNumber(numero);
    const removed = this.LN_numeros.delete(cleanNumber);
    if (removed) {
      this.guardarEnArchivo();
      console.log(`✅ Número desbloqueado: ${cleanNumber}`); // ⭐ CORREGIDO
    }
    return removed;
  }

  estaBloqueado(numero: string): boolean {
    const cleanNumber = this.cleanNumber(numero);
    return this.LN_numeros.has(cleanNumber);
  }

  obtenerTodos(): string[] {
    return Array.from(this.LN_numeros);
  }

  limpiar(): void {
    this.LN_numeros.clear();
    this.guardarEnArchivo();
    console.log('🗑️ Lista negra limpiada');
  }

  contar(): number {
    return this.LN_numeros.size;
  }

  private cleanNumber(numero: string): string {
    return numero.replace(/\D/g, '');
  }
}

export const listaNegraPersistente = new ListaNegraPersistente();