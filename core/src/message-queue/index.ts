import EventEmitter from "events";

function fromBytesToUuid(bytes: Uint8Array) {

  let count = 0;
  let result = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = ('00' + bytes[i].toString(16)).slice(-2);
    count += 2;
    result.push(b);
    if (count === 8 || count === 12 || count === 16 || count === 20) {
      result.push('-');
    }
  }

  return result.join('');
}
export class MessageQueue {
  ws: WebSocket;
  ready: Promise<void>;
  eventBus = new EventEmitter();
  constructor(public queueKey: string) {
    let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let host = window.location.host;
    let url = `${protocol}://${host}/websocket/message_queue/join`;
    const urlObj = new URL(url);
    urlObj.searchParams.set('key', queueKey);
    const ws = new WebSocket(urlObj.toString());
    this.ws = ws;
    ws.addEventListener('message', (ev) => {
      const d = ev.data;
      if (typeof d === 'string') {
        const data = JSON.parse(d);
        if (data.type === 'new_participant') {
          this.eventBus.emit("new_participant", data.content);
        } else if (data.type === 'participant_leave') {
          this.eventBus.emit("participant_leave", data.content);
        }
      }
    });
    this.ready = new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(undefined));
    });
  }
  close() {
    if (this.ws.readyState === WebSocket.CLOSED) {
      return;
    }
    this.ws.close();
  }
  subscribe(cb: (msg: string | ArrayBuffer, info: { participantId: string }) => void) {
    const listener = async (ev: MessageEvent) => {
      if (typeof ev.data === 'string') {
        const d = JSON.parse(ev.data);
        if (d.type === 'message') {
          cb(d.content, { participantId: d.participant_id });
        }
      } else {
        const ab = await ev.data.arrayBuffer() as ArrayBuffer;
        const data_ab = ab.slice(0, ab.byteLength - 16);
        const uuid_ab = ab.slice(ab.byteLength - 16, ab.byteLength);
        const uuid = fromBytesToUuid(new Uint8Array(uuid_ab));
        cb(data_ab, { participantId: uuid });
      }
    };
    this.ws.addEventListener('message', listener);
    return () => {
      this.ws.removeEventListener('message', listener);
    }
  }
  on_participant(cb: (msg: NewParticipant) => void) {
    this.eventBus.on("new_participant", cb);
    return () => {
      this.eventBus.off("new_participant", cb);
    }
  }
  on_participant_leave(cb: (msg: NewParticipant) => void) {
    this.eventBus.on("participant_leave", cb);
    return () => {
      this.eventBus.off("participant_leave", cb);
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

interface NewParticipant {
  participant_id: string,
  count: number,
}