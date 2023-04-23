import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, AppInstallContext, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { http } from '@webby/core/tunnel';
import { downloadLink } from '../../utils/download';
import { formatFileSize, makeDefaultTemplate } from '../../utils/formatter';

let reactRoot: ReactDom.Root;

async function mount(ctx: AppContext) {

  setTimeout(() => {
    ctx.appWindow.setSize(900, 600);
  });
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />)
}

async function unmount() {
  if (reactRoot) {
    reactRoot.unmount();
  }
}

const defautTemplate = makeDefaultTemplate('未知');

async function installed(ctx: AppInstallContext) {
  let abort: AbortController | undefined = undefined;
  ctx.hooks.onGlobalSearch(async (kw: string) => {
    if (!kw) return [];
    try {
      if (abort) {
        abort.abort();
      }
      abort = new AbortController();
      const resp = await http.fetch('https://worker.zlib.app/api/search/', {
        method: 'post',
        body: JSON.stringify({
          "keyword": kw,
          "page": 1,
          "sensitive": false
        }),
        signal: abort.signal,
        headers: {
          'content-type': 'application/json'
        },
      });
      const json = await resp.json();
      const result = json.data.map((r: any) => {
        return {
          isHtml: true,
          title: `<strong>${r.title}</strong>`,
          content: '',
          pre: defautTemplate`<div style="display: flex"><img style="height: 80px; margin-right: 10px" src=${r.cover} />
          <div>作者: ${r.author}\n年份: ${r.year}\n出版社: ${r.publisher}\n文件大小: ${r.filesize && formatFileSize(+r.filesize)}\n可下载: ${r.zlib_download ? '是' : '否'}</div></div>`,
          onClick() {
            if (r.zlib_download) {
              downloadLink(`https://worker.zlib.app/download/${r.id}`, 'true');
            }
          }
        }
      })
      return result;
    } catch (err) {
      return [{
        title: '搜索发生错误'
      }];
    } finally {
      abort = undefined;
    }
  });
}

function Index() {
  return <div></div>
}

defineApp({
  mount,
  unmount,
  installed,
  getAppInfo() {
    return {
      name: 'VNC Viewer',
      iconUrl,
      width: 500,
      height: 500,
      supportExts: [],
    }
  }
})
