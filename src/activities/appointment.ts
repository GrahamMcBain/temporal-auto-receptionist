import type { Appointment, AppointmentRequest } from '../shared/types';

/**
 * This module stands in for calendar, CRM, and notification integrations.
 * In production these functions would call external systems; keeping them as
 * Activities makes their retries, timeouts, and idempotency explicit.
 */
const holds = new Map<string, string>();
const appointments = new Map<string, Appointment>();

function slotKey(request: Pick<AppointmentRequest, 'date' | 'requestedTime'>) {
  return `${request.date}:${request.requestedTime}`;
}

export async function checkAndHoldSlot(input: AppointmentRequest & { workflowId: string }) {
  const key = slotKey(input);
  const heldBy = holds.get(key);
  if (heldBy && heldBy !== input.workflowId) {
    throw new Error(`The ${input.requestedTime} slot is no longer available.`);
  }
  holds.set(key, input.workflowId);
  return { held: true, expiresIn: '15 minutes' };
}

export async function releaseSlotHold(input: Pick<AppointmentRequest, 'date' | 'requestedTime'> & { workflowId: string }) {
  const key = slotKey(input);
  if (holds.get(key) === input.workflowId) holds.delete(key);
}

export async function createAppointment(input: AppointmentRequest & { workflowId: string }) {
  const existing = appointments.get(input.workflowId);
  if (existing) return existing;

  const key = slotKey(input);
  if (holds.get(key) !== input.workflowId) {
    throw new Error('The appointment hold is no longer valid.');
  }

  const appointment: Appointment = {
    ...input,
    id: `apt_${input.workflowId}`,
    status: 'confirmed',
  };
  appointments.set(input.workflowId, appointment);
  holds.delete(key);
  return appointment;
}

export async function updateCrm(appointment: Appointment) {
  console.info(`CRM updated for ${appointment.email}: ${appointment.id}`);
}

export async function sendBookingConfirmation(appointment: Appointment) {
  console.info(`Confirmation sent for ${appointment.id}`);
}

export async function sendAppointmentReminder(appointmentId: string) {
  console.info(`Reminder sent for ${appointmentId}`);
}

export const appointmentActivities = {
  checkAndHoldSlot,
  releaseSlotHold,
  createAppointment,
  updateCrm,
  sendBookingConfirmation,
  sendAppointmentReminder,
};
