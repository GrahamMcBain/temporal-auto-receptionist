export const services = ['oil_change', 'tire_rotation', 'brake_inspection', 'diagnostic'] as const;

export type ServiceId = (typeof services)[number];
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

export type AppointmentRequest = {
  customerName: string;
  email: string;
  service: ServiceId;
  date: string;
  requestedTime: string;
};

export type Appointment = AppointmentRequest & {
  id: string;
  status: AppointmentStatus;
};

export type BookingResult =
  | { status: 'confirmed'; appointmentId: string; reminderWorkflowId: string }
  | { status: 'cancelled' }
  | { status: 'expired' };
