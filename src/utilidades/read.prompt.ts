import path from 'path'
import fs from 'fs'

export function cargarArchivoPrompt(filename: string): string {
  try {
    const promptPath = path.join(process.cwd(), 'assets', filename)
    if (!fs.existsSync(promptPath)) {
      throw new Error(`Archivo no encontrado: ${promptPath}`)
    }
    const contenido = fs.readFileSync(promptPath, 'utf-8')
    if (!contenido || contenido.trim().length === 0) {
      throw new Error('El archivo está vacío')
    }
    return contenido
  } catch (error: any) {
    throw new Error(`Error al cargar el archivo de prompt: ${error.message}`)
  }
}