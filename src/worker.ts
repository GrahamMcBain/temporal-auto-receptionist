import path from 'node:path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { appointmentActivities } from './activities/appointment';
import { startHealthServer } from './health';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function run() {
  const connection = await NativeConnection.connect({
    address: required('TEMPORAL_ADDRESS'),
    tls: true,
    apiKey: required('TEMPORAL_API_KEY'),
  });
  startHealthServer();
  const worker = await Worker.create({
    connection,
    namespace: required('TEMPORAL_NAMESPACE'),
    workflowsPath: path.join(__dirname, 'workflows/appointment.js'),
    activities: appointmentActivities,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'auto-receptionist',
  });
  await worker.run();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
