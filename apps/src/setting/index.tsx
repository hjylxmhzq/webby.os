import { AppContext, AppInfo } from '@webby/core/web-app';
import ReactDom from 'react-dom/client';
import SettingPage from './setting';
import iconUrl from './icon.svg';

let root: ReactDom.Root;
export async function mount(ctx: AppContext) {
  root = ReactDom.createRoot(ctx.appRootEl);
  root.render(<SettingPage />)
}

export async function unmount(ctx: AppContext) {
  root?.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Setting',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: [],
  }
}
