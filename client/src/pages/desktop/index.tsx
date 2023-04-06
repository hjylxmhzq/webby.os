import Header from "./components/header/header";
import style from './index.module.less';
import { AppDefinition, appManager, windowManager } from "src/utils/micro-app";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppMenu, AppState, SystemMessage } from "@webby/core/web-app";
import { Collection, commonCollection } from '@webby/core/kv-storage'
import { debounce } from "src/utils/common";
import SystemFileSelector, { SelectFileProps } from "./components/system-file-selector";
import EventEmitter from "events";
import { create_download_link_from_file_path } from "@webby/core/fs";
import MessageLine from "./components/message";
import { MessageQueue } from '@webby/core/message-queue';


(window as any)._http = http;
(window as any)._Collection = Collection;
(window as any)._MessageQueue = MessageQueue;

export enum DeskTopEventType {
  SelectFile = 'selectFile',
  SelectFileFinished = 'selectFileFinished',
  SystemMessage = 'systemMessage',
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

export function systemMessage(msg: SystemMessage): Promise<void> {
  return new Promise((resolve) => {
    desktopEventBus.emit(DeskTopEventType.SystemMessage, msg);
    resolve();
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
  const [messages, setMessages] = useState<({ id: string } & SystemMessage)[]>([]);
  const msgsRef = useRef(messages);
  msgsRef.current = messages;

  useEffect(() => {
    (async () => {
      const wp = await commonCollection.desktop.get<string>('wallpaper');
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

  const onCloseMsg = (id: string) => {
    const idx = msgsRef.current.findIndex(m => m.id === id);
    if (idx !== -1) {
      msgsRef.current.splice(idx, 1);
      setMessages([...msgsRef.current]);
    }
  }

  useEffect(() => {

    const selectFiles = (options: SelectFileProps) => {
      setFileSelectorOptioins(options);
      setShowFileSelector(true);
    };
    const onSystemMessage = (msg: SystemMessage) => {
      const id = Math.random().toString().substring(2);
      const msgs = [...msgsRef.current, { ...msg, id }];
      setMessages(msgs);
      if (msg.timeout) {
        setTimeout(() => {
          onCloseMsg(id);
        }, msg.timeout);
      }
    };

    desktopEventBus.on(DeskTopEventType.SelectFile, selectFiles);
    desktopEventBus.on(DeskTopEventType.SystemMessage, onSystemMessage);

    return () => {
      desktopEventBus.off(DeskTopEventType.SelectFile, selectFiles);
      desktopEventBus.off(DeskTopEventType.SystemMessage, onSystemMessage);
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
    <MessageLine messages={messages} onClose={onCloseMsg} />
  </div>
}
