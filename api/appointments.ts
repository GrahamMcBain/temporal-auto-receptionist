import { createTemporalClient, taskQueue } from '../src/temporal-client';
import { requireInternalApiKey } from './_auth';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!requireInternalApiKey(request, response)) return;
  try {
    const client = await createTemporalClient();
    const workflowId = `appointment-${crypto.randomUUID()}`;
    await client.workflow.start('appointmentWorkflow', {
      taskQueue: taskQueue(),
      workflowId,
      args: [request.body],
    });
    return response.status(202).json({ workflowId, status: 'pending' });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start booking' });
  }
}
