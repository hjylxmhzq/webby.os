import Header from "./components/header/header";
import style from './index.module.less';
import { AppDefinition, appManager, windowManager } from "src/utils/micro-app";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppMenu, AppState } from "@webby/core/web-app";
import { Collection, commonCollection } from '@webby/core/kv-storage'
import { debounce } from "src/utils/common";
import SystemFileSelector, { SelectFileProps } from "./components/system-file-selector";
import EventEmitter from "events";
import { create_download_link_from_file_path } from "@webby/core/fs";

(window as any)._http = http;
(window as any)._Collection = Collection;

export enum DeskTopEventType {
  SelectFile = 'selectFile',
  SelectFileFinished = 'selectFileFinished',
}
export const desktopEventBus = new EventEmitter();

export function systemSelectFile(options: SelectFileProps): Promise<string[] | null> {
  return new Promise((resolve) => {
    desktopEventBus.once(DeskTopEventType.SelectFileFinished, (files: string[] | null) => {
      resolve(files);
    })
    desktopEventBus.emit(DeskTopEventType.SelectFile, options);
  });
}

export function HomePage() {

  const mountPoint = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<{ [appName: string]: AppDefinition }>({});
  const [currentMenu, setCurrentMenu] = useState<AppMenu[]>([]);
  const [activeApp, setActiveApp] = useState<AppState | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectorOptioins, setFileSelectorOptioins] = useState<SelectFileProps>({});
  const [wallpaper, setWallpaper] = useState('');

  useEffect(() => {
    (async () => {
      const wp = await commonCollection.desktop.get('wallpaper');
      if (wp) {
        setWallpaper(wp);
      }
      commonCollection.desktop.subscribe('wallpaper', (v) => {
        setWallpaper(v || '');
      });
    })();
  }, []);

  const onSelection = useCallback((files: string[] | null) => {
    setShowFileSelector(false);
    desktopEventBus.emit(DeskTopEventType.SelectFileFinished, files);
  }, []);

  useEffect(() => {

    const selectFiles = (options: SelectFileProps) => {
      setFileSelectorOptioins(options);
      setShowFileSelector(true);
    };
    desktopEventBus.on(DeskTopEventType.SelectFile, selectFiles);

    return () => {
      desktopEventBus.off(DeskTopEventType.SelectFile, selectFiles)
    };

  }, []);

  useEffect(() => {
    const unbind = appManager.onAppInstalled(debounce(() => {
      setApps({ ...appManager.apps });
    }));
    if (!mountPoint.current) return;
    if (windowManager.isInited) return;
    windowManager.init(mountPoint.current);
    windowManager.eventBus.on('active_app_change', (app: AppState | null, _old) => {
      setActiveApp(app);
      if (app) setCurrentMenu(app.ctx.systemMenu);
      else setCurrentMenu([]);
    });
    return () => {
      unbind();
    }
  }, []);
  const appNames = Object.keys(apps).sort();
  const deactiveApps = () => {
    windowManager.blur();
  }
  return <div>
    <Header menu={currentMenu} activeApp={activeApp}></Header>
    <div className={style['main-window']}>
      {
        wallpaper &&
        <img
          className={style['desktop-bg']}
          onMouseDown={deactiveApps}
          src={create_download_link_from_file_path(wallpaper, 3600 * 24 * 30)}
          alt="background"
        />
      }
      <div style={{ width: '100%' }} ref={mountPoint}></div>
      <div className={style['icons-grid']} onMouseDown={deactiveApps}>
        {
          appNames.map(appName => {
            let app = apps[appName]!;
            let iconUrl = app.getAppInfo().iconUrl;
            return <div key={appName} className={style['app-icon']} onClick={async (e) => {
              if (e.button === 0 && mountPoint.current) {
                await windowManager.startApp(appName);
              }
            }}>
              <div className={style['app-icon-img']}>
                <img src={iconUrl} alt={appName} />
              </div>
              {appName}
            </div>
          })
        }
      </div>
    </div>
    {
      showFileSelector &&
      <SystemFileSelector onSelection={onSelection} options={fileSelectorOptioins} />
    }
  </div>
}
