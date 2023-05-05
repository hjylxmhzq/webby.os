
export function makeReactive<T extends {}>(obj: T, cb: () => void) {
  
  function _makeReactive(obj: any) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    for (let k of Object.keys(obj)) {
      obj[k] = _makeReactive(obj[k]);
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