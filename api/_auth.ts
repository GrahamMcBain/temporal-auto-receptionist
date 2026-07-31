type Request = { headers?: Record<string, string | string[] | undefined> };
type Response = { status: (status: number) => { json: (body: unknown) => unknown } };

/** Only the deployed LiveKit agent may start or signal customer workflows. */
export function requireInternalApiKey(request: Request, response: Response) {
  const expected = process.env.TEMPORAL_BOOKING_API_SECRET;
  if (!expected) {
    response.status(500).json({ error: 'TEMPORAL_BOOKING_API_SECRET is required.' });
    return false;
  }
  const authorization = request.headers?.authorization;
  const token = Array.isArray(authorization) ? authorization[0] : authorization;
  if (token !== `Bearer ${expected}`) {
    response.status(401).json({ error: 'Unauthorized.' });
    return false;
  }
  return true;
}
