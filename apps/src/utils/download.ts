export function downloadLink(link: string, downloadName: string) {
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.style.display = 'none';
  anchor.download = downloadName;
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}