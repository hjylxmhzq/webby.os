export class Shell {
  public ws: WebSocket;
  readyPromise: Promise<void>;
  public decoder = new TextDecoder();
  stdout: string[] = [];
  stderr: string[] = [];
  waitings: Promise<void>[] = [];
  onStdOutCb?: (text: string) => void;
  onStdErrCb?: (text: string) => void;
  constructor(url?: string) {
    let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let host = window.location.host;
    if (!url) {
      url = `${protocol}://${host}/shell/start`;
    }
    this.ws = new WebSocket(url);
    this.readyPromise = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => {
        resolve();
      });
      this.ws.addEventListener('message', async (e) => {
        if (e.data instanceof Blob) {
          let ab = await e.data.arrayBuffer();
          let isErr = false;
          const text = this.decoder.decode(ab, { stream: true });
          if (isErr) {
            if (this.onStdErrCb) {
              this.onStdErrCb(text);
            } else {
              this.stderr.push(text);
            }
          } else {
            if (this.onStdOutCb) {
              this.onStdOutCb(text);
            } else {
              this.stdout.push(text);
            }
          }
        }
      });
      this.ws.addEventListener('error', e => reject(e));
    });
  }
  onStdOut(cb: (text: string) => void) {
    this.onStdOutCb = cb;
    if (this.stdout.length) {
      this.onStdOutCb(this.stdout.join(''));
      this.stdout.length = 0;
    }
  }
  onStdErr(cb: (text: string) => void) {
    this.onStdErrCb = cb;
    if (this.stderr.length) {
      this.onStdErrCb(this.stderr.join(''));
      this.stderr.length = 0;
    }
  }
  async setSize(cols: number, rows: number) {
    await this.readyPromise;
    this.ws.send(JSON.stringify({
      type: "set_size",
      payload: JSON.stringify({
        cols, rows,
      }),
    }));
  }
  async write(text: string) {
    await this.readyPromise;
    this.ws.send(JSON.stringify({
      type: 'cmd',
      payload: text,
    }));
  }
  close() {
    this.ws.close();
  }
  onClose(cb: () => void) {
    this.ws.addEventListener('close', cb);
  }
}