import localforage from "localforage";

export interface Meta {
  key: string,
  size: number,
  saved_at: number,
  accessed_at: number,
}

export interface MetaAll {
  metas: Meta[],
  totalSize: number,
}

export class LocalCache {
  local: LocalForage
  maxSize: number
  constructor(storeName: string, options: { maxSize?: number } = {}) {
    this.local = localforage.createInstance({ name: storeName });
    this.maxSize = options.maxSize || 1024 * 1024 * 512; // 512MB
  }
  drop() {
    return this.local.dropInstance();
  }
  async getMetaAll() {
    const existedMeta = await this.local.getItem<MetaAll>('meta:all');
    if (!existedMeta) {
      const metaAll: MetaAll = {
        metas: [],
        totalSize: 0,
      };
      await this.local.setItem('meta:all', metaAll);
      return metaAll;
    }
    return existedMeta;
  }
  private async setMetaAll(metaAll: MetaAll) {
    await this.local.setItem('meta:all', metaAll);
  }
  private async updateMeta(meta: Meta) {
    const metas = await this.getMetaAll();
    const existed = metas.metas.findIndex(m => m.key === meta.key);
    if (existed > -1) {
      metas.metas[existed] = meta;
    } else {
      metas.metas.push(meta);
    }
    metas.metas.sort((m1, m2) => m2.accessed_at - m1.accessed_at);
    const totalSize = metas.metas.reduce((prev, next) => prev + next.size, 0);
    metas.totalSize = totalSize;
    await this.setMetaAll(metas);
  }
  async set<T extends string | number | ArrayBuffer | Blob>(key: string, value: T) {
    const now = Date.now();
    const meta: Meta = {
      key,
      saved_at: now,
      size: 0,
      accessed_at: now,
    }
    if (value instanceof Blob) {
      meta.size = value.size;
    }
    if (value instanceof ArrayBuffer) {
      meta.size = value.byteLength;
    }
    await this.local.setItem(`data:${key}`, value);
    await this.updateMeta(meta);
    await this.checkSize();
  }
  private async updateAccessedTime(key: string) {
    const now = Date.now();
    const metaAll = await this.getMetaAll();
    const existed = metaAll.metas.findIndex(m => m.key === key);
    if (existed > -1) {
      metaAll.metas[existed].accessed_at = now;
    }
    metaAll.metas.sort((m1, m2) => m2.accessed_at - m1.accessed_at);
    this.setMetaAll(metaAll);
  }
  async get<T>(key: string): Promise<Awaited<T> | null> {
    const data = await this.local.getItem<T>(`data:${key}`);
    await this.updateAccessedTime(key);
    return data;
  }
  async getMeta(key: string) {
    const metaAll = await this.getMetaAll();
    return metaAll.metas.find(m => m.key === key);
  }
  private async checkSize() {
    const metaAll = await this.getMetaAll();
    if (metaAll.totalSize > this.maxSize) {
      let size = metaAll.totalSize;
      const toRemoved: Meta[] = [];
      while (size > this.maxSize) {
        const m = metaAll.metas.pop();
        if (m) {
          size -= m.size || 0;
          toRemoved.push(m);
        } else {
          break;
        }
      }
      for (const m of toRemoved) {
        await this.local.removeItem(`data:${m.key}`);
      }
      const totalSize = metaAll.metas.reduce((prev, next) => prev + next.size, 0);
      metaAll.totalSize = totalSize;
      await this.setMetaAll(metaAll);
    }
  }
}