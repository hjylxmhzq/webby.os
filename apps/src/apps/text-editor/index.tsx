import { read_file } from '@webby/core/fs';
import { AppContext, AppInfo, createAppWindow, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { type CherryOptions } from 'cherry-markdown/types/cherry.js';


function mountMDE() {
  const _Cherry = (window as any).Cherry;

  const cherry: any = new _Cherry({
    id: 'text-area',
    value: '',
  } as CherryOptions);

  

  (window as any).cherry = cherry;
}

export async function mount(ctx: AppContext) {
  const appWindow = createAppWindow();
  const rootEl = appWindow.body;
  rootEl.style.position = 'absolute';
  rootEl.style.inset = '0';

  ctx.onOpenFile(async (file) => {
    const content = await read_file(file);
    const ab = await content.arrayBuffer();
    const td = new TextDecoder();
    const c = td.decode(ab);
    console.log('open: ', file);
    await loadingPromise;
    (iframe.contentWindow as any).cherry.setValue(c);
  });

  const html = `
    <html>
    <head>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cherry-markdown@0.8.17/dist/cherry-markdown.min.css">
      <style>
      body {
        padding: 0;
        margin: 0;
      }
      #loading {
        border: 5px solid #aaa;
        border-top-color: transparent;
        position: fixed;
        left: calc(50vw - 50px);
        top: calc(50vh - 50px);
        width: 100px;
        height: 100px;
        border-radius: 50%;
        box-sizing: border-box;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      </style>
    </head>
    <body>
    <div id="text-area"></div>
    <div id="loading"></div>
    <script defer src="https://cdn.jsdelivr.net/npm/cherry-markdown@0.8.17/dist/cherry-markdown.min.js"></script>
    <script>
    window.addEventListener('load', () => {
      document.body.removeChild(document.querySelector('#loading'));
      (${mountMDE.toString()})();
    });
    </script>
    </body>
    </html>
    `

  const src = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const iframe = document.createElement('iframe');
  const btn = document.createElement('button');
  btn.addEventListener('click', () => {
    const value = (iframe.contentWindow as any).cherry.getValue();
  });

  btn.innerHTML = '保存';
  btn.style.cssText = `position: absolute;
  cursor: pointer;
  right: 10px;
  top: 10px;
  z-index: 999;
  border: 0;
  border-radius: 5px;
  padding: 5px;
  background-color: #eee;`;
  iframe.src = src;
  let loadingPromise = new Promise((resolve) => {
    iframe.addEventListener('load', () => {
      rootEl.appendChild(btn);
      URL.revokeObjectURL(src);
      resolve(undefined);
    });
    iframe.addEventListener('error', () => {
      URL.revokeObjectURL(src);
    })
    iframe.style.cssText = `position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    border: 0;`;
    rootEl.appendChild(iframe);
  });
}

export async function unmount(ctx: AppContext) {
}

export function getAppInfo(): AppInfo {
  return {
    name: 'TextEditor',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: ['txt', 'json', 'md', 'toml', 'js', 'py', 'ts'],
  }
}

defineApp({
  start: mount,
  exit: unmount,
  getAppInfo
})