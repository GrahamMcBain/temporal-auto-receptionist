import { createServer } from 'node:http';

export function startHealthServer() {
  const port = Number(process.env.WORKER_HEALTH_PORT ?? 8080);
  const server = createServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
  });
  server.listen(port, '0.0.0.0');
}
