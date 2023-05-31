import Header from "./components/header/header";
import style from './index.module.less';
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from '@webby/core/tunnel';
import { AppActionMenu, AppDefinitionWithContainer, ProcessState, SystemMessage, SystemMessageHandle, initSharedScope } from "@webby/core/web-app";
import { Collection, commonCollection } from '@webby/core/kv-storage'
import { getAppManager, getProcessManager, getWindowManager } from '@webby/core/web-app'
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
const windowManager = getWindowManager();
const processManager = getProcessManager();

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

export function systemSelectFile(app: AppDefinitionWithContainer, options: SelectFileProps): Promise<string[] | null> {
  return new Promise((resolve) => {
    desktopEventBus.once(DeskTopEventType.SelectFileFinished, (files: string[] | null) => {
      resolve(files);
    })
    if (!app) {
      throw new Error('app is not defined, systemMessage can not be used outside app scope');
    }
    desktopEventBus.emit(DeskTopEventType.SelectFile, options, app);
  });
}

export function setSystemTitleBarFlow(isFlow: boolean) {
  desktopEventBus.emit(DeskTopEventType.FlowTitltBar, isFlow);
}

export function showGlobalSearch() {
  desktopEventBus.emit(DeskTopEventType.ShowGlobalSearch);
}

export function systemMessage(app: AppDefinitionWithContainer, msg: SystemMessage, onClose?: () => void): SystemMessageHandle {
  console.log('system message from app: ', app);
  if (!app) {
    throw new Error('app is not defined, systemMessage can not be used outside app scope');
  }
  const id = Math.random().toString();
  desktopEventBus.emit(DeskTopEventType.SystemMessage, { ...msg, id, app });
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

export function systemPrompt(app: AppDefinitionWithContainer, prompt: PromptContent): Promise<PromptResult | null> {
  return new Promise((resolve, _reject) => {
    desktopEventBus.once(DeskTopEventType.PromptFinished, (result: PromptResult | null) => {
      resolve(result);
    });
    desktopEventBus.emit(DeskTopEventType.ShowPrompt, prompt);
  });
}
let isMobile = (function () {
  let check = false;
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(a.substring(0, 4))) check = true; })(navigator.userAgent || navigator.vendor);
  return check;
})();

export type IdMessage = { id: string, app: AppDefinitionWithContainer } & SystemMessage;

export function HomePage() {

  const mountPoint = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<AppDefinitionWithContainer[]>([]);
  const [currentMenu, setCurrentMenu] = useState<AppActionMenu[]>([]);
  const [activeApp, setActiveApp] = useState<ProcessState | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [fileSelectorOptioins, setFileSelectorOptioins] = useState<SelectFileProps>({});
  const [wallpaper, setWallpaper] = useState('');
  const wallpaperRef = useRef(wallpaper);
  wallpaperRef.current = wallpaper;
  const [messages, setMessages] = useState<(IdMessage)[]>([]);
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
        const wallpaper = await read_file_to_link(wp, { localCache: true, allowStaled: true });
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
        } else {
          setWallpaper('');
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
    const selectFiles = (options: SelectFileProps, app: AppDefinitionWithContainer) => {
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
    appManager.init();
    windowManager.setContainer(mountPoint.current);
    windowManager.onActiveWindowChange((win, _old) => {
      const process = win?.ownerProcess;
      process && setActiveApp(process);
      if (process) setCurrentMenu(process.ctx.systemMenu.get());
      else setCurrentMenu([]);
    });
    return () => {
      unbind();
    }
  }, []);
  const deactiveApps = () => {
    windowManager.blurAll();
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
          itemSize={isMobile ? 80 : 100}
          onStartApp={async (app, newWindow = false) => {
            if (isMobile || newWindow) {
              const url = new URL(window.location.href);
              url.hash = `#app=${app}`;
              let strWindowFeatures = `menubar=no,location=no,resizable=yes,scrollbars=no,status=no`;
              window.open(url.href, `${app}_window`, strWindowFeatures)
            } else {
              await processManager.startApp(app);
            }
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
