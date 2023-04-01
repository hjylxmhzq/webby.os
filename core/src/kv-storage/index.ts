import { post } from "../utils/http";
import EventEmitter from 'events';

export class Collection {
  private eventBus = new EventEmitter();
  constructor(public collection: string) {
  }
  async set(key: string, value: string): Promise<void> {
    const r = await post('/kv_storage/set', {
      key, value, collection: this.collection
    }, Math.random().toString());
    this.eventBus.emit(key, value, key);
    return r.data;
  }
  async get(key: string): Promise<string | null> {
    const r = await post('/kv_storage/get', {
      key, collection: this.collection
    }, 'collection_get' + '_' + key + '_' + this.collection);
    let d = r.data;
    if (d.length > 0) {
      return d[0].value;
    }
    return null;
  }
  async has(key: string): Promise<string | null> {
    const r = await post('/kv_storage/has', {
      key, collection: this.collection
    }, 'collection_has' + '_' + key + '_' + this.collection);
    let d = r.data;
    return d;
  }
  async keys(key: string): Promise<string[]> {
    const r = await post('/kv_storage/keys', {
      key, collection: this.collection
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
  async values(key: string) {
    const r = await post('/kv_storage/values', {
      key, collection: this.collection
    });
    if (r.data.length) {
      return r.data;
    }
    return [];
  }
  async remove(key: string): Promise<boolean> {
    const r = await post('/kv_storage/remove', {
      key, collection: this.collection
    });
    return r.data;
  }
  subscribe<T extends string>(key: T, cb: (value: string | null, key: T) => void): () => void {
    this.eventBus.on(key, cb);
    return () => {
      this.eventBus.off(key, cb);
    }
  }
}

export const commonCollection = {
  desktop: new Collection('desktop_config'),
}
