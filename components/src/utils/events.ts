import { EventEmitter } from "events";

export class CachedEventEmitter {

  private eventBus = new EventEmitter();
  private cachedArgs: Record<string, unknown[][]> = {};
  on(type: string, cb: (...args: any[]) => void) {
    if (this.cachedArgs[type]) {
      for (const args of this.cachedArgs[type]) {
        cb(...args);
      }
    }
    delete this.cachedArgs[type];
    this.eventBus.on(type, cb);
  }
  off(type: string, cb: (...args: any[]) => void) {
    delete this.cachedArgs[type];
    this.eventBus.off(type, cb);
  }
  emit(type: string, ...args: any[]) {
    if (this.eventBus.listeners(type).length === 0) {
      const cList = this.cachedArgs[type] || [];
      cList.push(args);
      this.cachedArgs[type] = cList;
    } else {
      this.eventBus.emit(type, ...args);
    }
  }
  removeAllListeners() {
    this.eventBus.removeAllListeners();
  }
}