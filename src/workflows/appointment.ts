import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
  startChild,
  workflowInfo,
} from '@temporalio/workflow';
import type * as activities from '../activities/appointment';
import type { AppointmentRequest, AppointmentStatus, BookingResult } from '../shared/types';

const { checkAndHoldSlot, releaseSlotHold, createAppointment, updateCrm, sendBookingConfirmation, sendAppointmentReminder } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3 },
  });

export const confirmAppointment = defineSignal('confirmAppointment');
export const cancelAppointment = defineSignal('cancelAppointment');
export const bookingStatus = defineQuery<AppointmentStatus>('bookingStatus');

/**
 * Owns one appointment's durable lifecycle. It is safe to pause for customer
 * confirmation because Temporal replays the workflow after worker failures.
 */
export async function appointmentWorkflow(request: AppointmentRequest): Promise<BookingResult> {
  const workflowId = workflowInfo().workflowId;
  let status: AppointmentStatus = 'pending';
  let confirmed = false;
  let cancelled = false;

  setHandler(confirmAppointment, () => {
    confirmed = true;
  });
  setHandler(cancelAppointment, () => {
    cancelled = true;
  });
  setHandler(bookingStatus, () => status);

  await checkAndHoldSlot({ ...request, workflowId });

  const receivedDecision = await condition(() => confirmed || cancelled, '15 minutes');
  if (cancelled) {
    await releaseSlotHold({ ...request, workflowId });
    status = 'cancelled';
    return { status };
  }
  if (!receivedDecision) {
    await releaseSlotHold({ ...request, workflowId });
    status = 'expired';
    return { status };
  }

  // This Activity is idempotent by workflow ID and verifies the reservation again.
  const appointment = await createAppointment({ ...request, workflowId });
  await updateCrm(appointment);
  await sendBookingConfirmation(appointment);

  const reminderWorkflowId = `appointment-reminder-${appointment.id}`;
  await startChild(appointmentReminderWorkflow, {
    workflowId: reminderWorkflowId,
    args: [appointment.id],
  });

  status = 'confirmed';
  return { status, appointmentId: appointment.id, reminderWorkflowId };
}

/** A separate durable timer keeps reminders independent of the booking call. */
export async function appointmentReminderWorkflow(appointmentId: string): Promise<void> {
  await sleep('24 hours');
  await sendAppointmentReminder(appointmentId);
}
