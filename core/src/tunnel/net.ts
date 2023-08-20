import EventEmitter from "events";

class TcpSocket {
  public eventBus = new EventEmitter();
  public ws?: WebSocket;
  public readyPromise?: Promise<void>
  constructor(public addr: string, public options: { lazy?: boolean } = {}) {
    if (!options.lazy) {
      this.open();
    }
  }
  open() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const url = `${protocol}://${host}/websocket/websockify/connect?remote=${this.addr}`;
    this.ws = new WebSocket(url);
    this.readyPromise = new Promise((resolve, _reject) => {
      this.ws!.addEventListener('open', () => {
        resolve();
      });
    });
    this.ws.addEventListener('message', async (e) => {
      const data = await (e.data as Blob).arrayBuffer();
      this.eventBus.emit('data', data);
    });
    this.ws.addEventListener('close', (e) => {
      this.eventBus.emit('close', e.reason);
    });
  }
  onData(cb: (data: ArrayBuffer) => void): () => void {
    this.eventBus.on('data', cb);
    return () => {
      this.eventBus.off('data', cb);
    }
  }
  onClosed(cb: (reason: string) => void) {
    this.eventBus.on('close', cb);
    return () => this.eventBus.off('close', cb);
  }
  async send(data: Blob | ArrayBufferLike | string) {
    if (!this.ws) {
      throw new Error('socket must be open before send data');
    }
    await this.readyPromise;
    this.ws?.send(data);
  }
  async close() {
    await this.readyPromise;
    this.ws?.close();
  }
}

export {
  TcpSocket,
}
