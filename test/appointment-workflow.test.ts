import path from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { appointmentActivities } from '../src/activities/appointment';
import { appointmentWorkflow, bookingStatus, cancelAppointment, confirmAppointment } from '../src/workflows/appointment';

describe('appointment workflow', () => {
  let env: TestWorkflowEnvironment;

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await env?.teardown();
  });

  async function runWithWorker(test: () => Promise<void>) {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: 'appointment-test',
      workflowsPath: path.join(__dirname, '../src/workflows/appointment.ts'),
      activities: appointmentActivities,
    });
    await worker.runUntil(test);
  }

  it('waits durably for confirmation, then books', async () => {
    await runWithWorker(async () => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue: 'appointment-test',
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
    await runWithWorker(async () => {
      const handle = await env.client.workflow.start(appointmentWorkflow, {
        taskQueue: 'appointment-test',
        workflowId: 'appointment-cancelled',
        args: [{
          customerName: 'Grace Hopper', email: 'grace@example.com', service: 'diagnostic',
          date: '2026-08-05', requestedTime: '1:00 PM',
        }],
      });
      await handle.signal(cancelAppointment);
      await expect(handle.result()).resolves.toEqual({ status: 'cancelled' });
    });
  });
});
