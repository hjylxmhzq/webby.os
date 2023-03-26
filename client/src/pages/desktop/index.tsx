import Header from "./components/header";
import style from './index.module.less';
import { AppDefinition, appManager, WindowManager } from "src/utils/micro-app";
import { useEffect, useRef, useState } from "react";
import { autorun } from "mobx";


export function HomePage() {
  const mountPoint = useRef<HTMLDivElement>(null);
  const wm = useRef<WindowManager>();
  const [apps, setApps] = useState<{ [appName: string]: AppDefinition }>({});

  useEffect(() => {
    autorun(() => {
      let app = appManager.apps;
      setApps({ ...app });
    });
    if (!mountPoint.current) return;
    wm.current = new WindowManager(mountPoint.current);
    (window as any).wm = wm.current;
    return () => {
      wm.current?.destroy();
    }
  }, []);
  const appNames = Object.keys(apps);
  return <div>
    <Header></Header>
    <div className={style['main-window']}>
      <img className={style['desktop-bg']} src="https://images4.alphacoders.com/640/640956.jpg" alt="background" />
      <div ref={mountPoint}></div>
      <div className={style['icons-grid']}>
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
