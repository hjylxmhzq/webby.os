const ScaleRegexp = /scale\((-?\d*\.?\d*)(,\s*(-?\d*\.?\d*)\))?/;
export function transformScale(el: HTMLElement, scaleX?: number, scaleY?: number) {
  const transform = el.style.transform;
  const m = transform.match(ScaleRegexp);
  let newTransform;
  if (!m) {
    newTransform = transform + ` scale(${scaleX || 0}, ${scaleY || 0}px)`;
  } else {
    let [input, x, , y] = m;
    y = y ?? x;
    const scale = `scale(${scaleX ?? x}, ${scaleY ?? y})`;
    newTransform = transform.replace(input, scale);
  }
  el.style.transform = newTransform;
}

const TranslateRegexp = /translate\((-?\d*\.?\d*)px(,\s*(-?\d*\.?\d*)px\))?/;
export function transformTranslate(el: HTMLElement, tx?: number, ty?: number) {
  const transform = el.style.transform;
  const m = transform.match(TranslateRegexp);
  let newTransform;
  if (!m) {
    newTransform = transform + ` translate(${tx || 0}px, ${ty || 0}px)`;
  } else {
    let [input, x, , y] = m;
    y = y ?? x;
    const scale = `translate(${tx ?? x}px, ${ty ?? y}px)`;
    newTransform = transform.replace(input, scale);
  }
  el.style.transform = newTransform;
}
