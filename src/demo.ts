import { Client, Connection } from '@temporalio/client';
import { appointmentWorkflow, confirmAppointment } from './workflows/appointment';

async function run() {
  const connection = await Connection.connect();
  const client = new Client({ connection });
  const workflowId = `appointment-demo-${Date.now()}`;
  const handle = await client.workflow.start(appointmentWorkflow, {
    taskQueue: 'auto-receptionist',
    workflowId,
    args: [{
      customerName: 'Ada Lovelace',
      email: 'ada@example.com',
      service: 'oil_change',
      date: '2026-08-04',
      requestedTime: '10:30 AM',
    }],
  });

  console.info(`Started ${workflowId}; simulating the voice agent's confirmation signal.`);
  await handle.signal(confirmAppointment);
  console.info(await handle.result());
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
