import { makeAutoObservable } from 'mobx';

export class Setting {
  download = {
    aria2Enabled: false,
    aria2RpcUrl: "",
    aria2RpcToken: "",
    zipDownloadEnabled: true,
  }
  preview = {
    thumbnailScalingEnabled: false,
    pdfPreviewEnabled: true,
  }
  constructor() {
    this.deserialize();
    makeAutoObservable(this);
  }
  enableAria2() {
    this.download.aria2Enabled = true;
    this.serialize();
  }
  disableAria2() {
    this.download.aria2Enabled = false;
    this.serialize();
  }
  setAria2RPCUrl(url: string) {
    this.download.aria2RpcUrl = url;
    this.serialize();
  }
  setAria2RPCToken(token: string) {
    this.download.aria2RpcToken = token;
    this.serialize();
  }
  enableZipDownload(enabled: boolean) {
    this.download.zipDownloadEnabled = enabled;
    this.serialize();
  }
  enablePdfPreview(enabled: boolean) {
    this.preview.pdfPreviewEnabled = enabled;
    this.serialize();
  }
  enableThumbnailScaling(enabled: boolean) {
    this.preview.thumbnailScalingEnabled = enabled;
    this.serialize();
  }
  private serialize() {
    serialize('store.setting', this);
  }
  private deserialize() {
    let cached = deserialize('store.setting', this);
    if (cached) override(cached, this);
  }
}

export const setting = new Setting();

function serialize(key: string, s: any) {
  const str = JSON.stringify(s);
  localStorage.setItem(key, str);
}

function deserialize(key: string, defaultVal: any) {
  const content = localStorage.getItem(key);
  if (!content) return defaultVal;
  try {
    const value = JSON.parse(content);
    return value;
  } catch (e) {
    console.error(e);
    return defaultVal;
  }
}

function override(obj: any, toObj: any) {
  if (typeof obj === 'object' && obj && typeof toObj === 'object' && toObj) {
    for (let key of Object.keys(obj)) {
      if (typeof obj[key] !== 'object') {
        toObj[key] = obj[key];
      } else if (toObj[key] === undefined) {
        toObj[key] = obj[key];
      } else {
        override(obj[key], toObj[key]);
      }
    }
  }
}