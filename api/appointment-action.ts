import { createTemporalClient } from '../src/temporal-client';
import { requireInternalApiKey } from './_auth';

const signals = { confirm: 'confirmAppointment', cancel: 'cancelAppointment' } as const;

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!requireInternalApiKey(request, response)) return;
  const { workflowId, action } = request.body ?? {};
  if (typeof workflowId !== 'string' || !(action in signals)) {
    return response.status(400).json({ error: 'workflowId and a valid action are required' });
  }
  try {
    const client = await createTemporalClient();
    await client.workflow.getHandle(workflowId).signal(signals[action as keyof typeof signals]);
    return response.status(202).json({ workflowId, action });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to signal booking' });
  }
}
