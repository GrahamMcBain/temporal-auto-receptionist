/**
 * The original demo approach: synchronous and process-local.
 * It is deliberately kept here as the "before" version for the walkthrough.
 */
import type { Appointment, AppointmentRequest } from '../shared/types';

const slots = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '3:30 PM'];

export class InMemorySchedulingService {
  private appointments: Appointment[] = [];

  checkAvailability(date: string) {
    const booked = new Set(
      this.appointments
        .filter((appointment) => appointment.date === date && appointment.status === 'confirmed')
        .map((appointment) => appointment.requestedTime),
    );
    return slots.filter((slot) => !booked.has(slot));
  }

  book(request: AppointmentRequest): Appointment {
    if (!this.checkAvailability(request.date).includes(request.requestedTime)) {
      throw new Error('Requested appointment is no longer available.');
    }
    const appointment = { ...request, id: `apt_${this.appointments.length + 1}`, status: 'confirmed' as const };
    this.appointments.push(appointment);
    return appointment;
  }
}
