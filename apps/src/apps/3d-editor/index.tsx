import { MessageQueue } from '@webby/core/message-queue';
import { AppContext, AppInfo } from '@webby/core/web-app';

const iconUrl = 'https://v1.vuepress.vuejs.org/hero.png';


export async function mount(ctx: AppContext) {
  let key = Math.random().toString(16).substring(2);
  let mq = new MessageQueue(key);
  ctx.systemMessage({ type: 'info', title: '当前场景共享密钥', content: key, timeout: 0 });
  ctx.systemMenu = [{
    name: '共享',
    children: [
      {
        name: '同步相机位置',
        async onClick() {
          if (editor) {
            const scene = editor.toJSON();
            await mq.send(JSON.stringify(scene));
          }
        }
      },
      {
        name: '加入共享',
        onClick() {
          const _key = prompt('请输入共享密钥');
          if (_key) {
            key = _key;
            mq = new MessageQueue(key);
            mq.subscribe(onEditorChange);
            ctx.systemMessage({ type: 'info', title: '已切换场景共享会话', content: key, timeout: 0 });
          }
        }
      },
      {
        name: '显示共享密钥',
        onClick() {
          ctx.systemMessage({ type: 'info', title: '当前场景共享密钥', content: key, timeout: 0 });
        }
      }
    ]
  }];

  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.boxSizing = 'border-box';
  iframe.style.border = '0';
  root.appendChild(iframe);
  iframe.src = '/apps/3d-editor/asset/index.html';
  let editor: any;
  const onEditorChange = (msg: any) => {
    const scene = JSON.parse(msg as string);
    if (!scene.camera) {
      scene.camera = editor.toJSON().camera;
    }
    editor.parsing = true;
    editor.clear();
    editor.fromJSON(scene);
    setTimeout(() => {
      editor.parsing = false;
    }, 300);
  };
  iframe.addEventListener('load', () => {
    const w = iframe.contentWindow as any;
    w.onSaveState = async function () {
      const scene = editor.toJSON();
      delete scene.camera;
      await mq.send(JSON.stringify(scene));
    };
    mq.subscribe(onEditorChange);
    editor = w.editor;
    console.log('editor', editor);
  });
  ctx.onOpenFile((file) => {
    iframe.src = file;
    console.log('open: ', file);
  });
  setTimeout(() => {
    ctx.appWindow.setSize(900, 600);
  }, 100);
}

export async function unmount(ctx: AppContext) {
  ctx.appRootEl.innerHTML = '';
}

export function getAppInfo(): AppInfo {
  return {
    name: '3DEditor',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: [],
  }
}
