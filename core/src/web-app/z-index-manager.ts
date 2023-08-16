export class ZIndexManager {
  public startIdx = 100;
  public zIndex = this.startIdx;
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

    // resort
    this.mapping = this.mapping.filter(([el]) => {
      if (document.contains(el)) {
        return true;
      }
      return false;
    });
    this.mapping.sort((a, b) => { return a[1] - b[1] });
    this.mapping.forEach(([el], idx) => {
      this.mapping[idx][1] = idx + this.startIdx;
      el.style.zIndex = idx + this.startIdx + '';
    });
    this.zIndex = this.mapping.length + this.startIdx;
  }
}

const zIndexManager = new ZIndexManager();

export default zIndexManager;