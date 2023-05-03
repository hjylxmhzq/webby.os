import ReactDom from 'react-dom/client';
import { AppContext, AppInstallContext, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { http } from '@webby/core/tunnel';
import { downloadLink } from '../../utils/download';
import { formatFileSize, makeDefaultTemplate } from '../../utils/formatter';
import Epub, { Rendition } from 'epubjs';
import style from './index.module.less';
import { KeyboardEvent, MouseEvent, WheelEvent, useEffect, useRef, useState } from 'react';
import { systemPrompt, systemSelectFile } from '@webby/core/system';
import { create_download_link_from_file_path } from '@webby/core/fs';
import { availableFonts } from '../../utils/fonts';
import Icon from '../../components/icon/icon';
import classNames from 'classnames';
import { Collection } from '@webby/core/kv-storage';
import { PopButton } from '../../components/button';
import { CachedEventEmitter } from '../../utils/events';
import path from 'path-browserify';

let reactRoot: ReactDom.Root;

async function mount(ctx: AppContext) {
  
  const eventBus = new CachedEventEmitter();

  function Index() {
    return <div>
      <div>App Center</div>
      <div>book reader</div>
    </div>
  }

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

async function installed(ctx: AppInstallContext) {
  
}

defineApp({
  mount,
  unmount,
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
