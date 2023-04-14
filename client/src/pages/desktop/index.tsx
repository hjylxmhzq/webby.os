import Header from "./components/header/header";
import style from './index.module.less';
import { AppDefinitionWithContainer, appManager, windowManager } from "src/utils/micro-app";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppMenu, AppState, SystemMessage, SystemMessageHandle } from "@webby/core/web-app";
import { Collection, commonCollection } from '@webby/core/kv-storage'
import { debounce } from "src/utils/common";
import SystemFileSelector, { SelectFileProps } from "./components/system-file-selector";
import EventEmitter from "events";
import { create_download_link_from_file_path } from "@webby/core/fs";
import MessageLine from "./components/message";
import { MessageQueue } from '@webby/core/message-queue';
import { GlobalSearch } from "./components/global-search";
import { PromptContent, PromptProps, PromptResult, SystemPrompt } from "./components/system-prompt";


(window as any)._http = http;
(window as any)._Collection = Collection;
(window as any)._MessageQueue = MessageQueue;
(window as any)._systemMessage = systemMessage;
(window as any)._systemPrompt = systemPrompt;

export enum DeskTopEventType {
  SelectFile = 'selectFile',
  SelectFileFinished = 'selectFileFinished',
  SystemMessage = 'systemMessage',
  CloseSystemMessage = 'closeSystemMessage',
  SystemMessageClosed = 'systemMessageClosed',
  ShowGlobalSearch = 'showGlobalSearch',
  ShowPrompt = 'showPrompt',
  PromptFinished = 'promptFinished',
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

export function showGlobalSearch() {
  desktopEventBus.emit(DeskTopEventType.ShowGlobalSearch);
}

export function systemMessage(msg: SystemMessage, onClose?: () => void): SystemMessageHandle {

  const id = Math.random().toString();
  desktopEventBus.emit(DeskTopEventType.SystemMessage, { ...msg, id });
  const onClosed = (_id: string) => {
    if (_id === id) {
      onClose?.();
      handle.isClosed = true;
      desktopEventBus.off(DeskTopEventType.SystemMessageClosed, onClosed);
    }
  };
  desktopEventBus.on(DeskTopEventType.SystemMessageClosed, onClosed);
  const handle = {
    isClosed: false,
    close() {
      desktopEventBus.emit(DeskTopEventType.CloseSystemMessage, id);
    }
  };
  return handle;
}

export function systemPrompt(prompt: PromptContent): Promise<PromptResult | null> {
  return new Promise((resolve, _reject) => {
    desktopEventBus.once(DeskTopEventType.PromptFinished, (result: PromptResult | null) => {
      resolve(result);
    });
    desktopEventBus.emit(DeskTopEventType.ShowPrompt, prompt);
  });
}

type IdMessage = { id: string } & SystemMessage;

export function HomePage() {

  const mountPoint = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<{ [appName: string]: AppDefinitionWithContainer }>({});
  const [currentMenu, setCurrentMenu] = useState<AppMenu[]>([]);
  const [activeApp, setActiveApp] = useState<AppState | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [fileSelectorOptioins, setFileSelectorOptioins] = useState<SelectFileProps>({});
  const [wallpaper, setWallpaper] = useState('');
  const [messages, setMessages] = useState<({ id: string } & SystemMessage)[]>([]);
  const [prompt, setPrompt] = useState<PromptProps['prompt']>();
  const msgsRef = useRef(messages);
  msgsRef.current = messages;

  const onPromptFinish = (promptResult?: PromptResult) => {
    setPrompt(undefined);
    desktopEventBus.emit(DeskTopEventType.PromptFinished, promptResult || null);
  };

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
      desktopEventBus.emit(DeskTopEventType.SystemMessageClosed, id);
      setMessages([...msgsRef.current]);
    }
  };

  useEffect(() => {

    const selectFiles = (options: SelectFileProps) => {
      setFileSelectorOptioins(options);
      setShowFileSelector(true);
    };
    const onSystemMessage = (msg: IdMessage) => {
      const msgs = [...msgsRef.current, msg];
      setMessages(msgs);
      if (msg.timeout) {
        setTimeout(() => {
          onCloseMsg(msg.id);
        }, msg.timeout);
      }
    };

    const showSearch = () => {
      setShowGlobalSearch(true);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        showSearch();
      }
    };
    const onMouseDown = () => {
      setShowGlobalSearch(false);
    }

    const showPrompt = (prompt: PromptContent) => {
      setPrompt(prompt);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown)

    desktopEventBus.on(DeskTopEventType.SelectFile, selectFiles);
    desktopEventBus.on(DeskTopEventType.SystemMessage, onSystemMessage);
    desktopEventBus.on(DeskTopEventType.CloseSystemMessage, onCloseMsg);
    desktopEventBus.on(DeskTopEventType.ShowGlobalSearch, showSearch);
    desktopEventBus.on(DeskTopEventType.ShowPrompt, showPrompt);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown)
      desktopEventBus.off(DeskTopEventType.SelectFile, selectFiles);
      desktopEventBus.off(DeskTopEventType.SystemMessage, onSystemMessage);
      desktopEventBus.off(DeskTopEventType.CloseSystemMessage, onCloseMsg);
      desktopEventBus.off(DeskTopEventType.ShowGlobalSearch, showSearch);
      desktopEventBus.off(DeskTopEventType.ShowPrompt, showPrompt);
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
    {
      showGlobalSearch && <div className={style['global-search']}>
        <GlobalSearch onClose={() => setShowGlobalSearch(false)} />
      </div>
    }
    {
      !!prompt &&
      <SystemPrompt prompt={prompt} onComfirm={onPromptFinish} onCancel={onPromptFinish} />
    }
  </div>
}
