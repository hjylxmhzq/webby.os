export class ZIndexManager {
  public zIndex = 1;
  public mapping: ([HTMLElement, number])[] = [];
  setTop(el: HTMLElement) {
    this.zIndex += 1;
    el.style.zIndex = this.zIndex + '';
    const idx = this.mapping.findIndex(([ele]) => ele === el);

    if (idx > -1) {
      this.mapping[idx][1] = this.zIndex;
    } else {
      this.mapping.push([el, this.zIndex]);
    }

    // rerange
    this.mapping = this.mapping.filter(([el]) => {
      if (document.contains(el)) {
        return true;
      }
      return false;
    });
    this.mapping.sort((a, b) => { return a[1] - b[1] });
    this.mapping.forEach(([el], idx) => {
      this.mapping[idx][1] = idx + 1;
      el.style.zIndex = idx + 1 + '';
    });
    this.zIndex = this.mapping.length;
  }
}

const zIndexManager = new ZIndexManager();

export default zIndexManager;