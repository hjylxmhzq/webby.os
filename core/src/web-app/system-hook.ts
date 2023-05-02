import EventEmitter from "events";
import { commonCollection } from "../kv-storage";

const store = commonCollection.systemHook;
export class SystemHook<T extends any> {
  constructor(public hookName: string, public options: { lazy: boolean } = { lazy: false }) {
    store.get<{ enabled: boolean }>('hook_status_' + hookName).then(status => {
      if (status) {
        this.hookStatus = status;
      }
    });
  }
  hookStatus: { enabled: boolean } = { enabled: false };
  eventBus = new EventEmitter();
  setEnabled(enabled: boolean) {
    this.hookStatus.enabled = enabled;
    store.set('hook_status_' + this.hookName, this.hookStatus);
    this.eventBus.emit('enabled_change', enabled);
  }
  isEnabled(): boolean {
    return !!this.hookStatus.enabled;
  }
  onEnabledChange(cb: (enabled: boolean) => void) {
    this.eventBus.on('enabled_change', cb);
    return () => {
      this.eventBus.off('enabled_change', cb);
    }
  }
  isRegisted() {
    return this.eventBus.listenerCount('hook');
  }
  emit(args: T) {
    this.eventBus.emit('hook', args);
  }
  register(cb: (r: T) => void) {
    this.eventBus.on('hook', cb);
    return () => {
      this.eventBus.off('hook', cb);
    };
  }
}
