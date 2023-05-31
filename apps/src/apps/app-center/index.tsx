import ReactDom from 'react-dom/client';
import { AppContext, AppInstallContext, createAppWindow, defineApp, getSharedScope } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { CachedEventEmitter } from '../../utils/events';
import path from 'path-browserify';
import { systemMessage } from '@webby/core/system';

let reactRoot: ReactDom.Root;

const appManager = getSharedScope().system.appManager;

async function installApp(src: string, name: string) {
  const handle = systemMessage({ title: `正在安装App`, type: 'info', content: `正在安装 ${name}`, timeout: 0 });
  const success = await appManager.installApp(src, name);
  if (!success) {
    handle.setMessage({ title: '安装失败', content: 'App已存在', timeout: 5000 });
    return;
  }
  handle.setMessage({ title: `安装完成`, type: 'info', content: `${name}已安装`, timeout: 3000 });
}

async function mount(ctx: AppContext) {

  const eventBus = new CachedEventEmitter();

  function Index() {
    return <div>
      <div>App Center</div>
      <div onClick={() => {
        installApp('/apps/book-reader.js', 'BookReader2');
      }}>book reader</div>
    </div>
  }

  const appWindow = createAppWindow();
  const root = appWindow.body;
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

async function installed(ctx: AppInstallContext) {

}

defineApp({
  start: mount,
  exit: unmount,
  installed,
  getAppInfo() {
    return {
      name: 'App Center',
      iconUrl,
      width: 500,
      height: 500,
      supportExts: [],
    }
  }
})
