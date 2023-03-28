import { post } from "../utils/http";

export class Collection {
  constructor(public collection: string) {
  }
  async set(key: string, value: string): Promise<void> {
    const r = await post('/kv_storage/set', {
      key, value, collection: this.collection
    });
    return r.data;
  }
  async get(key: string): Promise<string | null> {
    const r = await post('/kv_storage/get', {
      key, collection: this.collection
    });
    let d = r.data;
    if (d.length > 0) {
      return d[0].value;
    }
    return null;
  }
  async has(key: string): Promise<string | null> {
    const r = await post('/kv_storage/has', {
      key, collection: this.collection
    });
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
    });
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
}
