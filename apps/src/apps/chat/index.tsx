import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo } from '@webby/core/web-app';
import { create_download_link_from_file_path } from '@webby/core/fs';
import Chat from './chat';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';

let reactRoot: ReactDom.Root;

const store = new Collection('built_in_app_chat');

export async function mount(ctx: AppContext) {
  ctx.systemMenu = [{
    name: '设置',
    children: [
      {
        name: '配置API Token',
        onClick() {
        }
      }
    ]
  }];
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />)
}

function Index() {
  const [apiToken, setapiToken] = useState('');
  const onInput = (msg: string) => { };
  const [msgs, setMsgs] = useState<string[]>([]);

  useEffect(() => {
    store.get('api_token').then(v => {
      if (v) {
        setapiToken(v);
      }
    });
  }, []);

  return <div style={{ position: 'absolute', inset: 0 }}>
    <Chat msgs={msgs} onInput={onInput} />
  </div>
}

export async function unmount(ctx: AppContext) {
  reactRoot.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Chat',
    iconUrl,
    width: 800,
    height: 500,
    supportExts: [],
  }
}
