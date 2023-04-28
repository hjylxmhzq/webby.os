export function formatFileSize(bytes: number, si=false, dp=1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' Bytes';
  }

  const units = si 
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}

export function formatTime(timestamp: number) {
  const t = new Date();
  t.setTime(timestamp);
  return t.toLocaleString();
}

export function makeDefaultTemplate(defaultStr: string) {
  function stringDefault(strList: TemplateStringsArray, ...segs: any[]) {
    let result = '';
    for (let i = 0; i < strList.length; i++) {
      result += strList[i];
      if (i !== strList.length - 1) {
        const seg = segs[i] === undefined || segs[i] === null ? defaultStr : String(segs[i]);
        result += seg;
      }
    }
    return result;
  }
  return stringDefault;
}