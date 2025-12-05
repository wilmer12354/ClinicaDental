// src/flows/flujoListaNegra.ts

import { addKeyword, EVENTS } from '@builderbot/bot';
import { listaNegraTurso } from '../../bd/adaptadorTurso';
import { responderConAnimacion } from '../../utilidades/chatUX';
import { instanciaAdaptadorMongo } from '~/bd/adaptadorMongo';
import { flujoMedicoAgendar } from './medico_agendar';
import { getDailyTransactions } from '../../utilidades/supabase';

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Limpia un número de teléfono eliminando caracteres no numéricos
 */
const limpiarNumero = (numero: string): string => {
  return numero.replace(/\D/g, '');
};

/**
 * Valida que un número tenga formato internacional válido (8-15 dígitos)
 */
const esNumeroValido = (numero: string): boolean => {
  const clean = limpiarNumero(numero);
  console.log('🔍 Validando número:', clean);
  return clean.length >= 8 && clean.length <= 15
};

// ============================================================================
// MANEJADORES DE COMANDOS
// ============================================================================

/**
 * Lista todos los números bloqueados
 */
const manejarListar = async (
  provider: any,
  ctx: any,
  fallBack: Function
): Promise<any> => {
  const bloqueados = await listaNegraTurso.obtenerTodos();

  if (bloqueados.length === 0) {
    await responderConAnimacion(
      provider,
      ctx,
      '📋 La lista negra está vacía'
    );
  } else {
    const lista = bloqueados
      .map((num, i) => `${i + 1}. 📞 ${num}`)
      .join('\n');

    await responderConAnimacion(
      provider,
      ctx,
      `*NÚMEROS BLOQUEADOS* (${bloqueados.length}):\n\n${lista}`
    );
  }

  return fallBack();
};

/**
 * Bloquea un nuevo número
 */
const manejarBloquear = async (
  ctx: any,
  provider: any,
  fallBack: Function
): Promise<any> => {
  const partes = ctx.body.trim().split(' ');

  // Validar formato del comando
  if (partes.length < 2) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Formato incorrecto*\n\n' +
      'Ejemplo: `bloquear 71234567`'
    );
    return fallBack();
  }

  const numeroABloquear = partes[1];

  // Validar formato
  if (!esNumeroValido(numeroABloquear)) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Número inválido*\n\n' +
      'El número debe tener entre 8 y 15 dígitos.'
    );
    return fallBack();
  }

  const numeroLimpio = limpiarNumero(numeroABloquear);

  // Verificar si ya está bloqueado
  const yaBloqueado = await listaNegraTurso.estaBloqueado(numeroLimpio);
  if (yaBloqueado) {
    await responderConAnimacion(
      provider,
      ctx,
      `ℹ️ El número +${numeroLimpio} ya está en la lista negra\n\n` +
      'Envía otro comando o escribe "listar"'
    );
    return fallBack();
  }

  // Agregar a la lista negra
  const agregado = await listaNegraTurso.agregar(numeroLimpio);

  if (agregado) {
    await responderConAnimacion(
      provider,
      ctx,
      `✅ *Número bloqueado exitosamente*\n\n📞 +${numeroLimpio}`,
      '🚫'
    );

    console.log(`✅ Bloqueado: +${numeroLimpio}`);
  } else {
    await responderConAnimacion(
      provider,
      ctx,
      '❌ No se pudo bloquear el número. Intenta nuevamente.'
    );
  }

  return fallBack();
};

/**
 * Desbloquea un número específico
 */
const manejarDesbloquear = async (
  ctx: any,
  provider: any,
  fallBack: Function
): Promise<any> => {
  const partes = ctx.body.trim().split(' ');

  // Validar formato del comando
  if (partes.length < 2) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Formato incorrecto*\n\n' +
      'Uso: `desbloquear +59171234567`\n' +
      'Ejemplo: `desbloquear 71234567`'
    );
    return fallBack();
  }

  const numeroADesbloquear = partes[1];

  // Validar número
  if (!esNumeroValido(numeroADesbloquear)) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Número inválido*\n\n' +
      'El número debe tener entre 8 y 15 dígitos.'
    );
    return fallBack();
  }

  const numeroLimpio = limpiarNumero(numeroADesbloquear);


  // Verificar si está bloqueado y desbloquear
  const estaBloqueado = await listaNegraTurso.estaBloqueado(numeroLimpio);
  
  if (!estaBloqueado) {
    await responderConAnimacion(
      provider,
      ctx,
      `ℹ️ El número +${numeroLimpio} no estaba bloqueado`
    );
  } else {
    const eliminado = await listaNegraTurso.eliminar(numeroLimpio);
    
    if (eliminado) {
      await responderConAnimacion(
        provider,
        ctx,
        `✅ *Número desbloqueado exitosamente*\n\n📞 +${numeroLimpio}`,
        '✅'
      );
      console.log(`✅ Desbloqueado: +${numeroLimpio}`);
    } else {
      await responderConAnimacion(
        provider,
        ctx,
        '❌ No se pudo desbloquear el número. Intenta nuevamente.'
      );
    }
  }

  return fallBack();
};

/**
 * Cambia el estado de un cliente a ACTIVO
 */
const manejarCambiarEstado = async (
  ctx: any,
  provider: any,
  fallBack: Function
): Promise<any> => {
  const partes = ctx.body.trim().split(' ');

  // Validar formato del comando
  if (partes.length < 2) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Formato incorrecto*\n\n' +
      'Uso correcto:\n' +
      '• `estado +59171234567`\n' +
      '• `estado 71234567`\n\n' +
      '_El número del cliente debe incluirse después de "estado"_'
    );
    return fallBack();
  }

  // Obtener y limpiar el número
  const numeroObjetivo = limpiarNumero(partes[1]);

  // Validar que sea un número válido
  if (numeroObjetivo.length < 8 || numeroObjetivo.length > 15) {
    await responderConAnimacion(
      provider,
      ctx,
      '⚠️ *Número inválido*\n\n' +
      'El número debe tener entre 8 y 15 dígitos.\n\n' +
      'Ejemplo: `estado 59171234567`'
    );
    return fallBack();
  }

  console.log('📞 Cambiando estado del número:', numeroObjetivo);

  // Cambiar estado en la base de datos
  const clienteActualizado = await instanciaAdaptadorMongo.cambiarEstado(
    numeroObjetivo,
    'ACTIVO'
  );

  if (!clienteActualizado) {
    await responderConAnimacion(
      provider,
      ctx,
      `❌ *No se encontró el cliente*\n\n` +
      `📞 Número: +${numeroObjetivo}\n\n` +
      '_Verifica que el número esté registrado en la base de datos_'
    );
    return fallBack();
  }

  // Confirmación exitosa
  await responderConAnimacion(
    provider,
    ctx,
    `✅ *Estado actualizado exitosamente*\n\n` +
    `👤 Cliente: ${clienteActualizado.nombre}\n` +
    `📞 Número: +${numeroObjetivo}\n` +
    `🟢 Estado: ACTIVO\n\n` +
    `⏰ ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`,
    '✅'
  );

  console.log(
    `✅ Estado actualizado: ${clienteActualizado.nombre} (${numeroObjetivo}) → ACTIVO`
  );

  return fallBack();
};

/**
 * Muestra el menú de ayuda con comandos disponibles
 */
const mostrarAyuda = async (provider: any, ctx: any): Promise<void> => {
  await responderConAnimacion(
    provider,
    ctx,
    '*COMANDOS DISPONIBLES*\n\n' +
    '• `listar` → Ver números bloqueados\n' +
    '• `bloquear <numero>` → Agregar a lista negra\n' +
    '• `desbloquear <numero>` → Quitar de lista negra\n' +
    '• `estado <numero>` → Activar cliente\n' +
    '• `arqueo` → Ver transacciones del día\n\n' +
    '_Ejemplo: bloquear 71234567_'
  );
};

// ============================================================================
// FLUJO PRINCIPAL
// ============================================================================

export const flujoListaNegra = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { provider, fallBack, state, gotoFlow }) => {
    const mensaje = state.get('mensajeAcumulado') || '';
    const comando = mensaje.trim().toLowerCase();

    console.log(' Procesando comando en lista negra:', comando);

    // Comando: Listar
    if (comando === 'listar' || comando === 'lista') {
      return manejarListar(provider, ctx, fallBack);
    }

    // Comando: Bloquear
    if (comando.startsWith('bloquear')) {
      return manejarBloquear(ctx, provider, fallBack);
    }

    // Comando: Desbloquear
    if (comando.startsWith('desbloquear')) {
      return manejarDesbloquear(ctx, provider, fallBack);
    }

    // Comando: Cambiar Estado
    if (comando.startsWith('estado')) {
      return manejarCambiarEstado(ctx, provider, fallBack);
    }

    // Comando: Agendar
    if (comando.startsWith('agendar')) {
      return gotoFlow(flujoMedicoAgendar);
    }

    // Comando: Ver arqueo del día
    if (comando === 'arqueo') {
      try {
        const transactions = await getDailyTransactions();
        
        if (transactions.length === 0) {
          await responderConAnimacion(provider, ctx, '*ARQUEO DEL DÍA*\n\nNo hay transacciones registradas para hoy.');
          return fallBack();
        }

        let totalIngresos = 0;
        let totalEgresos = 0;
        
        const transaccionesTexto = transactions.map(tx => {
          const monto = tx.amount.toFixed(2);
          const tipo = tx.type === 'income' ? '➕ Ingreso' : '➖ Egreso';
          const hora = new Date(tx.transaction_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          
          if (tx.type === 'income') {
            totalIngresos += tx.amount;
          } else {
            totalEgresos += tx.amount;
          }
          
          return `${hora} - ${tipo}: Bs. ${monto}\n   ${tx.description}`;
        }).join('\n\n');

        const saldo = totalIngresos - totalEgresos;
        const mensaje = `*ARQUEO DEL DÍA*\n\n` +
          `💰 Ingresos: Bs. ${totalIngresos.toFixed(2)}\n` +
          `💸 Egresos: Bs. ${totalEgresos.toFixed(2)}\n` +
          `📊 Saldo: Bs. ${saldo.toFixed(2)}\n\n` +
          `*ÚLTIMAS TRANSACCIONES*\n\n${transaccionesTexto}`;

        await responderConAnimacion(provider, ctx, mensaje);
      } catch (error) {
        console.error('Error al obtener el arqueo:', error);
        await responderConAnimacion(
          provider,
          ctx,
          '❌ Ocurrió un error al obtener el arqueo del día. Por favor, inténtalo de nuevo más tarde.'
        );
      }
      return fallBack();
    }

    await state.clear();
    
    // Comando no reconocido - Mostrar ayuda
    return mostrarAyuda(provider, ctx);
  }
);