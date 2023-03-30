import Header from "./components/header/header";
import style from './index.module.less';
import { AppDefinition, appManager, windowManager } from "src/utils/micro-app";
import { useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppMenu, AppState } from "@webby/core/web-app";
import { Collection } from '@webby/core/kv-storage'
import { debounce } from "src/utils/common";

(window as any)._http = http;
(window as any)._Collection = Collection;

// const remote_store = new Collection('desktop_config');

export function HomePage() {

  const mountPoint = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<{ [appName: string]: AppDefinition }>({});
  const [currentMenu, setCurrentMenu] = useState<AppMenu[]>([]);
  const [activeApp, setActiveApp] = useState<AppState | null>(null);

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
      <img className={style['desktop-bg']} onMouseDown={deactiveApps} src="https://images4.alphacoders.com/640/640956.jpg" alt="background" />
      <div ref={mountPoint}></div>
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
  </div>
}
