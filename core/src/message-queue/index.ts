export class MessageQueue {
  ws: WebSocket;
  ready: Promise<void>
  constructor(public queueKey: string) {
    let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let host = window.location.host;
    let url = `${protocol}://${host}/websocket/message_queue/join`;
    const urlObj = new URL(url);
    urlObj.searchParams.set('key', queueKey);
    const ws = new WebSocket(urlObj.toString());
    this.ws = ws;
    this.ready = new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(undefined));
    });
  }
  close() {
    this.ws.close();
  }
  subscribe(cb: (msg: string | Blob) => void) {
    const listener = (ev: MessageEvent) => {
      if (typeof ev.data === 'string') {
        const d = JSON.parse(ev.data);
        if (d.type === 'message') {
          cb(d.content);
        }
      } else {
        cb(ev.data);
      }
    };
    this.ws.addEventListener('message', listener);
    return () => {
      this.ws.removeEventListener('message', listener);
    }
  }
  async send(message: string | ArrayBufferLike | Blob) {
    await this.ready;
    if (message instanceof ArrayBuffer || message instanceof Blob) {
      this.ws.send(message);
    } else {
      this.ws.send(JSON.stringify({ type: 'message', content: message }));
    }
  }
}