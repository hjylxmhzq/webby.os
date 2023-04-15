import EventEmitter from "events";
import { commonCollection } from "../kv-storage";

const store = commonCollection.systemHook;
export class SystemHook<T extends (...args: any[]) => Promise<any>> {
  constructor(public hookName: string) {
    store.get<{ [appName: string]: boolean }>('hook_status_' + hookName).then(status => {
      if (status) {
        this.hookStatus = status;
      }
    });
  }
  hookStatus: { [appName: string]: boolean } = {};
  callbacks: { [appName: string]: T[] } = {};
  eventBus = new EventEmitter();
  setEnabled(appName: string, enabled: boolean) {
    this.hookStatus[appName] = enabled;
    store.set('hook_status_' + this.hookName, this.hookStatus);
    this.eventBus.emit('enabled_change', appName);
  }
  isEnabled(appName: string): boolean {
    return !!this.hookStatus[appName];
  }
  onEnabledChange(cb: (appName: string) => void) {
    this.eventBus.on('enabled_change', cb);
    return () => {
      this.eventBus.off('enabled_change', cb);
    }
  }
  register(appName: string, cb: T) {
    const cbs = this.callbacks[appName] || [];
    this.callbacks[appName] = cbs;
    cbs.push(cb);
    return () => {
      const idx = cbs.indexOf(cb);
      if (idx !== -1) {
        cbs.splice(idx, 1);
      }
    }
  }
}
