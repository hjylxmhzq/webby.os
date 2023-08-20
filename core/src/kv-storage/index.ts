import { post } from "../utils/http";
import EventEmitter from 'events';
import { makeReactive } from "./reactive";


interface StorageOptions {
  localFirst?: boolean,
}

export type SubscribeFn = (cb: (state: any) => void, options?: { once?: boolean }) => void;

export class Collection {
  static allowBuiltIn = false;
  private eventBus = new EventEmitter();
  initedKeys = new Set();
  async getReactiveState(key: string): Promise<{ state: Record<string | number, any>, subscribe: SubscribeFn }>;
  async getReactiveState<T>(key: string, defaultState: T): Promise<{ state: T, subscribe: SubscribeFn }>;
  async getReactiveState(key: string, defaultState: any = {}): Promise<any> {
    let _state = await this.get(key) || defaultState;
    if (typeof _state !== 'object' || _state === null) {
      _state = defaultState;
    }
    const state = makeReactive(_state, () => {
      eventBus.emit('change');
      this.set(key, _state);
    });
    const eventBus = new EventEmitter();
    return {
      state,
      subscribe(cb: (state: any) => void, options: { once?: boolean } = {}) {
        if (options.once) {
          eventBus.once('change', cb);
        } else {
          eventBus.on('change', cb);
        }
        return () => {
          eventBus.off('change', cb);
        }
      }
    };
  }
  getReactiveStateImmediatelly(key: string): { state: Record<string | number, any>, subscribe: SubscribeFn };
  getReactiveStateImmediatelly<T>(key: string, defaultState: T): { state: T, subscribe: SubscribeFn };
  getReactiveStateImmediatelly(key: string, defaultState: any = {}): any {
    const _state = defaultState;
    const state = makeReactive(_state, () => {
      eventBus.emit('change');
      this.set(key, _state);
    });
    this.get(key).then((v) => {
      if (typeof v === 'object' && v !== null) {
        Object.assign(state, v);
      }
    });
    const eventBus = new EventEmitter();
    return {
      state,
      subscribe(cb: (state: any) => void, options: { once?: boolean } = {}) {
        if (options.once) {
          eventBus.once('change', cb);
        } else {
          eventBus.on('change', cb);
        }
        return () => {
          eventBus.off('change', cb);
        }
      }
    };
  }
  constructor(public collection: string, public options: StorageOptions = {}) {
    if (!Collection.allowBuiltIn && collection.startsWith('_')) {
      throw new Error('collection with name starts with "_" is reserved by system');
    }
  }
  async set(key: string, value: any): Promise<void> {
    const v = JSON.stringify(value);
    if (this.options.localFirst) {
      localStorage.setItem(`_collection_${this.collection}|${key}`, v);
    }
    const r = await post('/kv_storage/set', {
      key, value: v, collection: this.collection
    }, Math.random().toString());
    this.eventBus.emit(key, v, key);
    return r.data;
  }
  async get<V = any>(key: string): Promise<V | null> {
    let localVal: V | undefined;
    if (this.options.localFirst) {
      const val = localStorage.getItem(`_collection_${this.collection}|${key}`);
      if (val) {
        localVal = JSON.parse(val);
      }
    }
    const getRemoteVal = async () => {
      const r = await post('/kv_storage/get', {
        key, collection: this.collection
      }, 'collection_get' + '_' + key + '_' + this.collection);
      const d = r.data;
      if (d.length > 0) {
        const val = JSON.parse(d[0].value);
        if (this.options.localFirst) {
          this.initedKeys.add(key);
          const s = JSON.stringify(val);
          localStorage.setItem(`_collection_${this.collection}|${key}`, s);
        }
        return val;
      }
      return null;
    }
    if (localVal) {
      if (!this.initedKeys.has(key)) {
        // not fresh data, update localStorage but dont wait for update
        getRemoteVal();
      }
      return localVal;
    } else {
      return await getRemoteVal();
    }
  }
  async has(key: string): Promise<boolean> {
    const r = await post('/kv_storage/has', {
      key, collection: this.collection
    }, 'collection_has' + '_' + key + '_' + this.collection);
    const d = r.data;
    return d;
  }
  async keys(): Promise<string[]> {
    const r = await post('/kv_storage/keys', {
      collection: this.collection
    });
    if (r.data.length) {
      return r.data;
    }
    return [];
  }
  async remove_all(): Promise<boolean> {
    const r = await post('/kv_storage/remove_collection', {
      collection: this.collection
    }, 'collection_remove_all' + this.collection);
    return r.data;
  }
  static async collections(): Promise<string[]> {
    const r = await post('/kv_storage/collections', {});
    if (r.data.length) {
      return r.data;
    }
    return [];
  }
  async values() {
    const r = await post('/kv_storage/values', {
      collection: this.collection
    });
    if (r.data.length) {
      return r.data.map((v: string) => JSON.parse(v));
    }
    return [];
  }
  async entries(): Promise<[string, any][]> {
    const r = await post('/kv_storage/entries', {
      collection: this.collection
    });
    if (r.data.length) {
      return r.data.map((entry: [string, string]) => [entry[0], JSON.parse(entry[1])]);
    }
    return [];
  }
  async remove(key: string): Promise<boolean> {
    if (this.options.localFirst) {
      localStorage.removeItem(`_collection_${this.collection}|${key}`);
    }
    const r = await post('/kv_storage/remove', {
      key, collection: this.collection
    });
    return r.data;
  }
  subscribe<V = any, T extends string = string>(key: T, cb: (value: V | null) => void): () => void {
    const sc = (window as any).sharedScope;
    let ws = sc.__kv_subsribe_ws as WebSocket | undefined;
    if (!ws || (ws && !(ws.readyState === ws.CONNECTING || ws.readyState === ws.OPEN))) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const url = `${protocol}://${host}/websocket/kv_storage/subscribe`;
      ws = new WebSocket(url);
      sc.__kv_subsribe_ws = ws;
    }
    waitForWs(ws).then(ws => {
      ws.send(JSON.stringify({ type: 'subscribe', collections: { [this.collection]: [key] } }));
    });
    const listener = (e: MessageEvent) => {
      const d = e.data;
      if (d) {
        const json = JSON.parse(d);
        if (json.collection === this.collection && json.key === key) {
          cb(JSON.parse(json.value));
        }
      }
    };
    ws.addEventListener('message', listener);
    return () => {
      ws?.removeEventListener('message', listener);
    }
  }
}

async function waitForWs(ws: WebSocket): Promise<WebSocket> {
  if (ws.readyState === ws.OPEN) {
    return ws;
  }
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve(ws);
    });
  });
}
Collection.allowBuiltIn = true;
export const commonCollection = {
  desktop: new Collection('_desktop_config', { localFirst: true }),
  windowManager: new Collection('_window_manager'),
  processManager: new Collection('_process_manager'),
  appManager: new Collection('_app_manager', { localFirst: true }),
  systemHook: new Collection('_system_hook', { localFirst: true }),
}
Collection.allowBuiltIn = false;
