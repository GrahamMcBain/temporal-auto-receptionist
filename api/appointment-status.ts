import { createTemporalClient } from '../src/temporal-client';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const workflowId = request.query?.workflowId;
  if (typeof workflowId !== 'string') return response.status(400).json({ error: 'workflowId is required' });
  try {
    const client = await createTemporalClient();
    const status = await client.workflow.getHandle(workflowId).query('bookingStatus');
    return response.status(200).json({ workflowId, status });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to query booking' });
  }
}
