
export function makeReactive<T extends object>(obj: T, cb: () => void) {

  function _makeReactive<T>(obj: T) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    for (const k of Object.keys(obj)) {
      obj[k as keyof typeof obj] = _makeReactive(obj[k as keyof typeof obj]);
    }
    const proxy = new Proxy(obj, {
      get(target, p, rec) {
        return Reflect.get(target, p, rec);
      },
      set(target, p, val) {
        if (typeof val === 'object' && val !== null) {
          val = _makeReactive(val);
        }
        const ret = Reflect.set(target, p, val);
        cb();
        return ret;
      }
    });
    return proxy;
  }

  return _makeReactive(obj);
}