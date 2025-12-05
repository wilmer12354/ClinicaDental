// ============================================
// src/services/googleCalendar.ts (ACTUALIZADO)
// ============================================

import axios from 'axios';
import { config } from '../configuracion/index';

interface AvailabilityCheck {
  comprobarDisponibilidad: boolean;
  startTime: string;
  endTime: string;
}

interface CreateReservation {
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  email: string;
  nombre: string;
  telefono: string;
  motivo: string;
}

// ⭐ NUEVA INTERFAZ
interface Appointment {
  eventId: string;
  title: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
}


interface NextAvailableSlot {
  start: string;
  end: string;
  formatted: string;
}

interface AvailabilityResponse {
  available: boolean;
  nextAvailable?: NextAvailableSlot | null;
}

export const comprobarDisponibilidad = async (
  startTime: Date, 
  endTime: Date
): Promise<AvailabilityResponse> => {
  try {
    const response = await axios.post(
      config.googleScriptUrl,
      {
        comprobarDisponibilidad: true,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      } as AvailabilityCheck,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    console.log('Respuesta de disponibilidad:', response.data);
    
    return {
      available: response.data.available,
      nextAvailable: response.data.nextAvailable || null
    };
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    throw new Error('Error al verificar disponibilidad');
  }
};

export const agendarCita = async (data: CreateReservation): Promise<any> => {
  try {
    const respuesta = await axios.post(
      config.googleScriptUrl,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    return respuesta.data;
  } catch (error) {
    console.error('Error al crear cita:', error);
    throw new Error('Error al crear la cita');
  }
};
/*
// ⭐ NUEVA FUNCIÓN: Obtener citas de un usuario por teléfono
export const getUserAppointments = async (phone: string): Promise<Appointment[]> => {
  try {
    const response = await axios.post(
      config.googleScriptUrl,
      {
        action: 'listAppointments',
        phone: phone
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    if (response.data.success && response.data.appointments) {
      return response.data.appointments;
    }

    return [];
  } catch (error) {
    console.error('Error al obtener citas del usuario:', error);
    throw new Error('Error al obtener las citas');
  }
};*/

// ⭐ NUEVA FUNCIÓN: Obtener citas de un usuario por teléfono
export const obtenerCitasPaciente = async (phone: string): Promise<any> => {
  try {
    const response = await axios.post(
      config.googleScriptUrl,
      {
        action: 'listAppointments',
        phone: phone
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    if (response.data.success && response.data.appointments) {
      return response.data.appointments;
    }

    return [];
  } catch (error) {
    console.error('Error al obtener citas del usuario:', error);
    throw new Error('Error al obtener las citas');
  }
};

// ⭐ NUEVA FUNCIÓN: Cancelar una cita
export const cancelarCita = async (eventId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    console.log(' Enviando petición de cancelación:');
    console.log('   URL:', config.googleScriptUrl);
    console.log('   EventId:', eventId);

    const payload = {
      action: 'cancelAppointment',
      eventId: eventId
    };

    console.log('   Payload completo:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      config.googleScriptUrl,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    console.log(' Respuesta del servidor:', JSON.stringify(response.data, null, 2));

    return {
      success: response.data.success,
      message: response.data.message
    };
  } catch (error) {
    console.error(' Error al cancelar cita:', error);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      message: error.message || 'Error desconocido al cancelar'
    };
  }
};