import Header from "./components/header/header";
import style from './index.module.less';
import { AppDefinition, appManager, WindowManager } from "src/utils/micro-app";
import { useEffect, useRef, useState } from "react";
import { autorun } from "mobx";
import { http } from '@webby/core/tunnel';
import { AppMenu, AppState } from "@webby/core/web-app";

(window as any)._http = http;

export function HomePage() {

  const mountPoint = useRef<HTMLDivElement>(null);
  const wm = useRef<WindowManager>();
  const [apps, setApps] = useState<{ [appName: string]: AppDefinition }>({});
  const [currentMenu, setCurrentMenu] = useState<AppMenu[]>([]);
  const [activeApp, setActiveApp] = useState<AppState | null>(null);

  useEffect(() => {
    autorun(() => {
      let app = appManager.apps;
      setApps({ ...app });
    });
    if (!mountPoint.current) return;
    const winManager = new WindowManager(mountPoint.current);
    winManager.eventBus.on('active_app_change', (app: AppState | null, _old) => {
      setActiveApp(app);
      if (app) setCurrentMenu(app.ctx.systemMenu);
      else setCurrentMenu([]);
    });
    wm.current = winManager;
    (window as any).wm = wm.current;
    return () => {
      wm.current?.destroy();
    }
  }, []);
  const appNames = Object.keys(apps).sort();
  const deactiveApps = () => {
    wm.current?.blur();
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
            return <div key={appName} className={style['app-icon']} onClick={(e) => {
              if (e.button === 0 && mountPoint.current) {
                wm.current?.startApp(appName);
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
