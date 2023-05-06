import Header from "./components/header/header";
import style from './index.module.less';
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppActionMenu, AppDefinitionWithContainer, AppState, SystemMessage, SystemMessageHandle, initSharedScope, processManager } from "@webby/core/web-app";
import { Collection, commonCollection } from '@webby/core/kv-storage'
import { getAppManager } from '@webby/core/system'
import SystemFileSelector, { SelectFileProps } from "./components/system-file-selector";
import EventEmitter from "events";
import { read_file_to_link } from "@webby/core/fs";
import MessageLine from "./components/message";
import { MessageQueue } from '@webby/core/message-queue';
import { net } from '@webby/core/tunnel';
import { GlobalSearch } from "./components/global-search";
import { PromptContent, PromptProps, PromptResult, SystemPrompt } from "./components/system-prompt";
import { DesktopIconGrid } from "./components/grid";

(window as any)._http = http;
(window as any)._Collection = Collection;
(window as any)._MessageQueue = MessageQueue;
(window as any)._systemMessage = systemMessage;
(window as any)._systemPrompt = systemPrompt;
(window as any)._TcpSocket = net.TcpSocket;

initSharedScope({
  systemMessage,
  systemSelectFile,
  systemPrompt,
  setSystemTitleBarFlow,
});

const appManager = getAppManager();

export enum DeskTopEventType {
  SelectFile = 'selectFile',
  SelectFileFinished = 'selectFileFinished',
  SystemMessage = 'systemMessage',
  CloseSystemMessage = 'closeSystemMessage',
  SystemMessageClosed = 'systemMessageClosed',
  ShowGlobalSearch = 'showGlobalSearch',
  ShowPrompt = 'showPrompt',
  PromptFinished = 'promptFinished',
  FlowTitltBar = 'FlowTitltBar',
};

export const desktopEventBus = new EventEmitter();

export function systemSelectFile(options: SelectFileProps): Promise<string[] | null> {
  return new Promise((resolve) => {
    desktopEventBus.once(DeskTopEventType.SelectFileFinished, (files: string[] | null) => {
      resolve(files);
    })
    desktopEventBus.emit(DeskTopEventType.SelectFile, options);
  });
}

export function setSystemTitleBarFlow(isFlow: boolean) {
  desktopEventBus.emit(DeskTopEventType.FlowTitltBar, isFlow);
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
    setMessage(msg: SystemMessage) {
      if (!handle.isClosed) {
        desktopEventBus.emit(DeskTopEventType.SystemMessage, { ...msg, id });
      } else {
        console.error('can not change closed message');
      }
    },
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
  const [apps, setApps] = useState<AppDefinitionWithContainer[]>([]);
  const [currentMenu, setCurrentMenu] = useState<AppActionMenu[]>([]);
  const [activeApp, setActiveApp] = useState<AppState | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [fileSelectorOptioins, setFileSelectorOptioins] = useState<SelectFileProps>({});
  const [wallpaper, setWallpaper] = useState('');
  const wallpaperRef = useRef(wallpaper);
  wallpaperRef.current = wallpaper;
  const [messages, setMessages] = useState<({ id: string } & SystemMessage)[]>([]);
  const [prompt, setPrompt] = useState<PromptProps['prompt']>();
  const [bgFillMode, setBgFillMode] = useState<'fill' | 'contain' | 'cover'>('cover');
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
        const wallpaper = await read_file_to_link(wp, { localCache: true });
        setWallpaper(wallpaper);
      }
      const _bgFillMode = await commonCollection.desktop.get<string>('bg-fill-mode');
      if (_bgFillMode) {
        setBgFillMode(_bgFillMode as 'contain' | 'cover' | 'fill');
      }
      commonCollection.desktop.subscribe('wallpaper', async (v) => {
        if (v) {
          if (wallpaperRef.current) {
            URL.revokeObjectURL(wallpaperRef.current);
          }
          const _wallpaper = await read_file_to_link(v, { localCache: true });
          setWallpaper(_wallpaper);
        }
      });
      commonCollection.desktop.subscribe('bg-fill-mode', (v) => {
        setBgFillMode(v || 'contain');
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
      const existed = msgsRef.current.find(m => m.id === msg.id);
      let msgs;
      if (existed) {
        Object.assign(existed, msg);
        msgs = [...msgsRef.current];
      } else {
        msgs = [...msgsRef.current, msg];
      }
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

    const _setTitleBarFlow = (isFlow: boolean) => {
      setTitlebarFlow(isFlow);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown)

    desktopEventBus.on(DeskTopEventType.SelectFile, selectFiles);
    desktopEventBus.on(DeskTopEventType.SystemMessage, onSystemMessage);
    desktopEventBus.on(DeskTopEventType.CloseSystemMessage, onCloseMsg);
    desktopEventBus.on(DeskTopEventType.ShowGlobalSearch, showSearch);
    desktopEventBus.on(DeskTopEventType.ShowPrompt, showPrompt);
    desktopEventBus.on(DeskTopEventType.FlowTitltBar, _setTitleBarFlow);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown)
      desktopEventBus.off(DeskTopEventType.SelectFile, selectFiles);
      desktopEventBus.off(DeskTopEventType.SystemMessage, onSystemMessage);
      desktopEventBus.off(DeskTopEventType.CloseSystemMessage, onCloseMsg);
      desktopEventBus.off(DeskTopEventType.ShowGlobalSearch, showSearch);
      desktopEventBus.off(DeskTopEventType.ShowPrompt, showPrompt);
      desktopEventBus.off(DeskTopEventType.FlowTitltBar, _setTitleBarFlow);
    };

  }, []);

  useEffect(() => {
    const unbind = appManager.onAppInstalled(() => {
      setApps([...appManager.apps]);
    });
    if (!mountPoint.current) return;
    if (processManager.isInited) return;
    processManager.init(mountPoint.current);
    processManager.eventBus.on('active_app_change', (app: AppState | null, _old) => {
      setActiveApp(app);
      if (app) setCurrentMenu(app.ctx.systemMenu.get());
      else setCurrentMenu([]);
    });
    return () => {
      unbind();
    }
  }, []);
  const deactiveApps = () => {
    processManager.blur();
  }

  const [flowTitlebar, setTitlebarFlow] = useState(false);

  return <div>
    <Header flow={flowTitlebar} menu={currentMenu} activeApp={activeApp}></Header>
    <div className={style['main-window']}>
      {
        wallpaper &&
        <img
          className={style['desktop-bg']}
          onMouseDown={deactiveApps}
          src={wallpaper}
          alt="background"
          style={{ objectFit: bgFillMode }}
        />
      }
      <div style={{ width: '100%' }} ref={mountPoint}></div>
      <div className={style['icons-grid']} onMouseDown={deactiveApps}>
        {/* {
          apps.map(app => {
            let iconUrl = app.getAppInfo().iconUrl;
            return <div key={app.name} className={style['app-icon']} onClick={async (e) => {
              if (e.button === 0 && mountPoint.current) {
                await processManager.startApp(app.name);
              }
            }}>
              <div className={style['app-icon-img']}>
                <img src={iconUrl} alt={app.name} />
              </div>
              {app.name}
            </div>
          })
        } */}
        <DesktopIconGrid
          onStartApp={async (app) => {
            await processManager.startApp(app);
          }}
          apps={apps.map(app => {
            return {
              name: app.name,
              text: app.name,
              icon: app.getAppInfo().iconUrl,
            }
          })} />
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
