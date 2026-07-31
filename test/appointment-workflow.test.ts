import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { appointmentActivities, checkAndHoldSlot, createAppointment } from '../src/activities/appointment';
import { appointmentWorkflow, bookingStatus, cancelAppointment, confirmAppointment } from '../src/workflows/appointment';

describe('appointment workflow', () => {
  let env: TestWorkflowEnvironment;

  beforeEach(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterEach(async () => {
    await env?.teardown();
  });

  async function runWithWorker(
    test: (taskQueue: string) => Promise<void>,
    activities: typeof appointmentActivities = appointmentActivities,
  ) {
    const taskQueue = `appointment-test-${randomUUID()}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, '../src/workflows/appointment.ts'),
      activities,
    });
    await worker.runUntil(() => test(taskQueue));
  }

  it('waits durably for confirmation, then books', async () => {
    await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue,
        workflowId: 'appointment-confirmed',
        args: [{
          customerName: 'Ada Lovelace', email: 'ada@example.com', service: 'oil_change',
          date: '2026-08-04', requestedTime: '10:30 AM',
        }],
      });
      expect(await handle.query(bookingStatus)).toBe('pending');
      await handle.signal(confirmAppointment);
      await expect(handle.result()).resolves.toMatchObject({ status: 'confirmed' });
    });
  });

  it('releases the pending booking when the caller cancels', async () => {
    const request = {
      customerName: 'Grace Hopper', email: 'grace@example.com', service: 'diagnostic' as const,
      date: '2026-08-05', requestedTime: '1:00 PM',
    };
    await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue,
        workflowId: 'appointment-cancelled',
        args: [request],
      });
      await handle.signal(cancelAppointment);
      await expect(handle.result()).resolves.toEqual({ status: 'cancelled' });
    });
    await expect(checkAndHoldSlot({ ...request, workflowId: 'replacement-booking' })).resolves.toMatchObject({ held: true });
  });

  it('expires an unconfirmed hold after fifteen minutes', async () => {
    await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue,
        workflowId: 'appointment-expired',
        args: [{
          customerName: 'Katherine Johnson', email: 'katherine@example.com', service: 'brake_inspection',
          date: '2026-08-06', requestedTime: '11:00 AM',
        }],
      });
      expect(await handle.query(bookingStatus)).toBe('pending');
      // Let the initial hold Activity complete before advancing to the
      // Workflow's confirmation deadline.
      await env.sleep('1 second');
      await env.sleep('16 minutes');
      await expect(handle.result()).resolves.toEqual({ status: 'expired' });
    });
  });

  it('retries a transient calendar failure before confirming the booking', async () => {
    let holdAttempts = 0;
    const retryingActivities = {
      ...appointmentActivities,
      checkAndHoldSlot: async (input: Parameters<typeof checkAndHoldSlot>[0]) => {
        holdAttempts += 1;
        if (holdAttempts < 3) throw new Error('Calendar temporarily unavailable');
        return checkAndHoldSlot(input);
      },
    };

    await runWithWorker(async (taskQueue) => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue,
        workflowId: 'appointment-retried',
        args: [{
          customerName: 'Margaret Hamilton', email: 'margaret@example.com', service: 'tire_rotation',
          date: '2026-08-07', requestedTime: '9:00 AM',
        }],
      });
      await handle.signal(confirmAppointment);
      await expect(handle.result()).resolves.toMatchObject({ status: 'confirmed' });
    }, retryingActivities);

    expect(holdAttempts).toBe(3);
  });

  it('makes appointment creation idempotent by workflow ID', async () => {
    const request = {
      customerName: 'Dorothy Vaughan', email: 'dorothy@example.com', service: 'oil_change' as const,
      date: '2026-08-08', requestedTime: '2:00 PM', workflowId: 'idempotent-appointment',
    };
    await checkAndHoldSlot(request);

    const first = await createAppointment(request);
    const second = await createAppointment(request);

    expect(second).toEqual(first);
  });
});
