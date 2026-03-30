import { Server, type Connection } from 'partyserver';

export class RealtimeServer extends Server {
  onConnect(_connection: Connection) {
    // Clients just listen for broadcasts
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === 'POST') {
      const email = await request.json();
      this.broadcast(JSON.stringify(email));
      return new Response('ok');
    }
    return new Response('not found', { status: 404 });
  }
}
