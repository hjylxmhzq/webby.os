type FindCallback<T> = (item: T, idx: number, arr: T[]) => boolean

export function removeFromArray<T>(arr: T[], item: T): T | undefined;
export function removeFromArray<T>(arr: T[], item: FindCallback<T>): T | undefined;
export function removeFromArray<T>(arr: T[], item: T | FindCallback<T>) {
  let index = -1
  if (typeof item === 'function') {
    index = arr.findIndex(item as FindCallback<T>);
  } else {
    index = arr.indexOf(item);
  }
  if (index !== -1) {
    const result = arr.splice(index, 1);
    return result[0];
  }
  return undefined;
}

export const removeFromArrayByIndex = <T>(arr: T[], index: number) => {
  if (index !== -1) {
    const result = arr.splice(index, 1);
    return result[0];
  }
  return undefined;
}
