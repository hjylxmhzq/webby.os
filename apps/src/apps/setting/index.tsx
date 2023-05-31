import { useEffect, useRef, useState } from "react";
import Button from "./components/button/index.tsx";
import { Popover } from "./components/popover/index.tsx";
import style from './index.module.less';
import ReactDom from 'react-dom/client';
import { AppContext, AppDefinitionWithContainer, AppInfo, AppWindow, createAppWindow, defineApp, getAppManager } from '@webby/core/web-app';
import { http } from '@webby/core/utils';
import iconUrl from './icon.svg';
import { Collection, commonCollection } from "@webby/core/kv-storage";
import { create_download_link_from_file_path, getLocalFSCache, MetaAll } from "@webby/core/fs";
import { auth, systemInfo } from "@webby/core/api";
import classNames from 'classnames';
import { systemMessage, systemSelectFile } from "@webby/core/system";
import { Switch } from "../../components/switch/index.tsx";
import { formatFileSize, formatTime } from "./utils.ts";
import { SmartImage } from "@webby/components";
import RecordBlock from "./components/record-block/index.tsx";
import qrCode from 'qrcode';
import DigitInput from "./components/digits-input/index.tsx";
import { customAlphabet } from 'nanoid';
import base32Encode from 'base32-encode';

const localFSCache = getLocalFSCache();
let reactRoot: ReactDom.Root;

let appWindow: AppWindow | undefined;
export async function mount(ctx: AppContext) {
  console.log('start setting', appWindow);
  if (appWindow) {
    appWindow.setActive(true);
    return;
  }
  appWindow = createAppWindow();
  appWindow.noBackground(true);
  setTimeout(() => {
    appWindow?.setSize(900, 600);
  });
  const root = appWindow.body;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<SettingPage />)

}

type menuKey = keyof typeof menu;

const appManager = getAppManager();
const menu = {
  '桌面与个性化': <DesktopSetting />,
  '用户与安全性': <UserSetting />,
  '应用管理': <AppSetting />,
  '文件系统': <FileSetting />,
  '全局搜索': <GlobalSearchSetting />,
  '系统状态': <SystemInfo />,
  '日志': <LogSetting />,
}

function SettingPage() {
  const [tabName, setTabName] = useState<menuKey>(Object.keys(menu)[0] as menuKey);
  return <div className={style['setting-page']}>
    <div className={style['left-bar']}>
      <div style={{ lineHeight: '40px' }}>设置</div>
      {
        Object.keys(menu).map((name: any) => {
          return <div key={name} className={classNames(style['menu-item'], { [style['active-tab']]: name === tabName })} onClick={() => setTabName(name)}>{name}</div>
        })
      }
    </div>
    <div className={classNames(style['info-page'])}>
      {menu[tabName]}
    </div>
  </div >
}


function GlobalSearchSetting() {

  const [searchStatus, setSearchStatus] = useState<{ appName: string, enabled: boolean, app: AppDefinitionWithContainer }[]>([]);

  function refresh() {
    const status = appManager.apps
      .filter((app) => app.hooks.globalSearch.isRegisted())
      .map((app) => {
        return {
          app,
          appName: app.name,
          enabled: app.hooks.globalSearch.isEnabled(),
        };
      });
    console.log(status)
    setSearchStatus(status);
  }

  useEffect(() => {
    refresh();
    appManager.apps.forEach((app) => {
      app.hooks.globalSearch.onEnabledChange(() => {
        refresh();
      });
    });
  }, []);

  return <div>
    <div className={style['section-title']}>将App加入全局搜索<span style={{ fontWeight: 100, fontStyle: 'italic' }}>(Ctrl/Cmd+F)</span></div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          searchStatus.map(({ enabled, appName, app }, idx) => {
            return <div key={appName} className={classNames(style['setting-item-row'], style.justify)}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <SmartImage src={app.getAppInfo().iconUrl} style={{ height: 18, width: 18, objectFit: 'contain', marginRight: 5 }} />
                <span>{appName}</span>
              </span>
              <Switch enabled={enabled} onChange={(enabled) => {
                app.hooks.globalSearch.setEnabled(enabled);
              }}></Switch>
            </div>
          })
        }
      </div>
    </div>
  </div>
};

function UserSetting() {

  const [pwds, setPwds] = useState(['', ''] as [string, string]); // [old_password, new_password]
  const [users, setUsers] = useState<auth.UserInfo[]>([]);
  const [groups, setGroups] = useState<auth.GroupInfo[]>([]);
  const [sessions, setSessions] = useState<auth.SessionState[]>([]);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', email: '', group: '' });
  const [lastAdmin, setLastAdmin] = useState(true);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const qrCodeCanvas = useRef<HTMLCanvasElement>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [secret, setSecret] = useState('');

  async function refresh() {
    const users = await auth.getAllUsers();
    const groups = await auth.getAllGroups();
    const sessions = await auth.getSessionState();
    const otpEnabled = await auth.isOtpEnabled();
    setOtpEnabled(otpEnabled);
    const admins = users.filter(u => u.group_name === 'admin').length;
    if (admins > 1) {
      setLastAdmin(false);
    } else {
      setLastAdmin(true);
    }
    if (groups.length > 0) {
      setNewUser({ ...newUser, group: groups[0].name });
    }
    sessions && setSessions(sessions);
    setUsers(users);
    setGroups(groups);
  }
  useEffect(() => {
    refresh();
  }, []);

  return <div>
    <div className={style['section-title']}>账户安全</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>重置密码</span>
        <input className={style.input} type="text" placeholder="请输入旧密码" value={pwds[0]} onChange={e => setPwds([e.target.value, pwds[1]])} />
        <input className={style.input} type="text" placeholder="请输入新密码" value={pwds[1]} onChange={e => setPwds([pwds[0], e.target.value])} />
        <Popover inline auto content={
          <div style={{ lineHeight: '35px', fontSize: 12, padding: '0 10px' }}>
            This operation requires to refresh page and login again
            <Button type="danger" onClick={async () => {
              let success = await auth.resetPassword(...pwds);
              if (success) {
                window.location.pathname = '/';
              }
            }} style={{ fontSize: 12 }}>Yes</Button>
          </div>
        }>
          <Button style={{ fontSize: 12 }}>修改</Button>
        </Popover>
      </div>
    </div>
    <div className={style['setting-section']}>
      <div className={classNames(style['setting-item'], style.justify)}>
        <span>两步验证<span style={{ fontWeight: 100, fontStyle: 'italic' }}>(TOTP)</span></span>
        <Switch enabled={otpEnabled} onChange={async (enabled) => {
          if (enabled) {
            const secret = customAlphabet('1234567890abcdefghijklnmopqrstuvwxyz', 25)();
            setSecret(secret);
            const uint8 = new TextEncoder().encode(secret);
            const encoded = base32Encode(uint8, 'RFC4648');
            const url = `otpauth://totp/${"webbyos"}:${window.location.hostname}?secret=${encoded}&issuer=x-gateway`
            qrCode.toCanvas(qrCodeCanvas.current, url, { width: 250, margin: 2 }, (err) => {
              if (err) {
                console.error(err);
              }
            });
            setShowOtpForm(true);
            systemMessage({ title: '两步验证设置', content: '扫描二维码并输入验证码', timeout: 5000 });
          } else {
            await auth.disableOtp();
            setOtpEnabled(false);
            systemMessage({ title: '两步验证设置', content: '已关闭两步验证', timeout: 5000 });
          }
        }} />
      </div>
      <div style={{ display: showOtpForm ? 'block' : 'none' }} className={classNames(style['setting-item'])}>
        <div style={{ textAlign: 'center' }}>
          <canvas ref={qrCodeCanvas}></canvas>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <DigitInput length={6} onChange={(r) => setVerifyCode(r.filter(r => typeof r === 'number').join(''))} />
          <Button
            style={{ opacity: verifyCode.length === 6 ? 1 : 0.5, pointerEvents: verifyCode.length === 6 ? 'all' : 'none', }}
            onClick={async () => {
              const success = await auth.enableOtp(secret, verifyCode);
              if (!success) {
                systemMessage({ title: '两步验证设置', content: '验证码错误', timeout: 5000 });
              } else {
                setOtpEnabled(true);
                setShowOtpForm(false);
                systemMessage({ title: '两步验证设置', content: '已开启两步验证', timeout: 5000 });
              }
            }}>确定</Button>
          <Button onClick={async () => {
            setShowOtpForm(false);
          }}>取消</Button>
        </div>
      </div>
    </div>
    <div className={style['section-title']}>用户管理</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <div>
          用户列表
          <Button style={{ fontSize: 12 }} onClick={() => setAdding(true)}>添加用户</Button>
        </div>
        <div className={style['user-list']}>
          <div className={classNames(style['user-list-item'], style.head)}>
            <span>用户名</span>
            <span>用户组</span>
            <span>用户根目录</span>
          </div>
          {
            users.map(user => {
              return <div key={user.username} className={style['user-list-item']}>
                <span>{user.username}</span>
                <span>{user.group_name}</span>
                <span>{user.user_root}</span>
                {
                  (!lastAdmin || user.group_name !== 'admin') &&
                  <Popover inline auto content={
                    <div style={{ lineHeight: '35px', fontSize: 12, padding: '0 10px' }}>
                      确认删除用户 {user.username} 吗
                      <Button type="danger" onClick={async () => {
                        await auth.deleteUser({ username: user.username });
                        await refresh();
                      }} style={{ fontSize: 12 }}>确认</Button>
                    </div>
                  }>
                    <Button style={{ fontSize: 12 }}>删除</Button>
                  </Popover>
                }
              </div>
            })
          }
          {
            adding && <div className={style['user-list-item']}>
              <input className={style.input} type="text" placeholder="用户名" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
              <input className={style.input} type="text" placeholder="密码" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <input className={style.input} type="text" placeholder="邮箱" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <select className={style.input} placeholder="用户组" value={newUser.group} onChange={e => { setNewUser({ ...newUser, group: e.target.value }) }}>
                {
                  groups.map(g => {
                    return <option key={g.name} value={g.name}>{g.name}</option>
                  })
                }
              </select>
              <Button style={{ fontSize: 12 }} onClick={() => setAdding(false)}>取消</Button>
              <Button style={{ fontSize: 12 }} onClick={async () => {

                for (let k in newUser) {
                  if (!(newUser as any)[k]) {
                    systemMessage({ type: 'error', title: '信息错误', content: `${k} 不能为空`, timeout: 5000 });
                    return;
                  }
                }
                await auth.addUser(newUser)
                await refresh();
                setAdding(false);

              }}>确定</Button>
            </div>
          }
        </div>
      </div>
    </div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <div>
          用户组列表
        </div>
        <div className={style['user-list']}>
          <div className={classNames(style['user-list-item'], style.head)}>
            <span>组名</span>
            <span>描述</span>
            <span>权限</span>
          </div>
          {
            groups.map(group => {
              return <div key={group.name} className={style['user-list-item']}>
                <span>{group.name}</span>
                <span>{group.desc}</span>
                <span>{group.permissions}</span>
              </div>
            })
          }
        </div>
      </div>
    </div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <div>
          会话列表
        </div>
        <div className={style['user-list']}>
          <div className={classNames(style['user-list-item'], style.head)}>
            <span>用户</span>
            <span>登录时间</span>
            <span>IP</span>
            <span>状态</span>
          </div>
          {
            sessions.map(sess => {
              return <div key={sess.key} className={style['user-list-item']}>
                <span>{sess.state.user.username}</span>
                <span>{formatTime(sess.state.user.last_login * 1000)}</span>
                <span>{sess.state.user.ip}</span>
                <span>
                  {sess.state.user.is_login ? '已登陆' : '未登录'}
                  <Popover inline auto content={
                    <div style={{ lineHeight: '35px', fontSize: 12, padding: '0 10px' }}>
                      此操作可能导致当前连接中断，确认删除会话吗？
                      <Button
                        type="danger"
                        onClick={async () => {
                          const sessions = await auth.deleteSessionState(sess.key);
                          sessions && setSessions(sessions);
                        }}
                        style={{ fontSize: 12 }}>确认</Button>
                    </div>
                  }>
                    <Button type="danger" style={{ fontSize: 12, color: 'red', padding: '2px 5px', margin: '0 5px' }}>删除</Button>
                  </Popover></span>
              </div>
            })
          }
        </div>
      </div>
    </div>
  </div>
}

function LogSetting() {
  const [log, setLog] = useState('');
  const readLog = async () => {
    const resp = await http.inner_fetch('/log/read_to_string', { method: 'post' })
    const text = await resp.json();
    setLog(text.data);
  }
  useEffect(() => {
    readLog();
  }, []);
  return <div className={style.log}>
    {log}
  </div>
}

function FileSetting() {
  const [localFSCacheMeta, setLocalFSCacheMeta] = useState<MetaAll>();
  const loadMeta = async () => {
    const metaAll = await localFSCache.getMetaAll();
    setLocalFSCacheMeta(metaAll);
  }
  const loadCollections = async () => {
    Collection.collections().then(cols => {
      const colObjs = cols.reduce((prev, next) => { prev[next] = []; return prev }, {} as { [key: string]: [string, any][] });
      setCollections(colObjs);
    });
  }
  const expandCollections = async (colKey: string) => {
    Collection.allowBuiltIn = true;
    const col = new Collection(colKey);
    Collection.allowBuiltIn = false;
    const entries = await col.entries();
    setCollections((cols) => {
      cols[colKey] = entries;
      return {
        ...cols,
      }
    })
  }
  const collapseCollections = async (colKey: string) => {
    setCollections((cols) => {
      cols[colKey] = [];
      return {
        ...cols,
      }
    })
  }
  const [collections, setCollections] = useState<{ [key: string]: [string, any][] }>({});
  useEffect(() => {
    loadMeta();
    loadCollections();
  }, []);
  return <div>
    <div className={style['section-title']}>本地文件缓存</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>空间占用：</span>
        <span>{formatFileSize(localFSCacheMeta?.totalSize || 0)}</span>
      </div>
      <div className={style['setting-item']}>
        <span>最大容量：</span>
        <span>{formatFileSize(localFSCache.maxSize)}</span>
      </div>
      <div className={style['setting-item']}>
        <span>清空缓存：</span>
        <Button onClick={async () => {
          localFSCache.drop();
          loadMeta();
        }}>清空</Button>
      </div>
    </div>
    <div className={style['section-title']}>缓存列表</div>
    <div className={classNames(style['setting-section'], style['limit-height'])}>
      <div className={style['setting-item']}>
        {
          !!localFSCacheMeta?.metas.length ? localFSCacheMeta?.metas.map(m => {
            return <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
              <span>{m.key}</span>
              <span style={{ flex: '0 0 75px', textAlign: 'right' }}>{formatFileSize(m.size)}</span>
            </div>
          })
            : '无本地缓存文件'
        }
      </div>
    </div>
    <div className={style['section-title']}>Key-Value存储列表</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          Object.entries(collections).map(([colKey, colEntries]) => {
            return <div key={colKey}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{colKey}</span>
                <span>
                  <Button onClick={async () => {
                    Collection.allowBuiltIn = true;
                    await new Collection(colKey).remove_all();
                    Collection.allowBuiltIn = false;
                    loadCollections();
                  }}>清空</Button>
                  <Button onClick={async () => {
                    if (collections[colKey].length) {
                      collapseCollections(colKey);
                    } else {
                      expandCollections(colKey);
                    }
                  }}>{collections[colKey].length ? '折叠' : '展开'}</Button>
                </span>
              </div>
              {
                !!colEntries.length &&
                <div className={style['collection-entries']}>
                  <RecordBlock record={Object.fromEntries(colEntries)} />
                </div>
              }
            </div>
          })
        }
      </div>
    </div>
  </div>
}

function AppSetting() {
  const [apps, setApps] = useState<AppDefinitionWithContainer[]>([]);
  useEffect(() => {
    setApps([...appManager.apps]);
    appManager.onAppInstalled(() => {
      setApps([...appManager.apps]);
    });
  }, []);

  return <div>
    <div className={style['section-title']}>已安装应用</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          appManager.apps.map((app, idx) => {
            return <div
              key={idx}
              style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
              <SmartImage src={app.getAppInfo().iconUrl} style={{ width: 20, marginRight: 10 }}></SmartImage>
              <span>{app.name}</span>
            </div>
          })
        }
      </div>
    </div>
    <div className={style['section-title']}>第三方应用</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          !!appManager.thirdPartyApps.length ? appManager.thirdPartyApps.map((app, idx) => {
            return <div key={idx}>
              <span>{app.name}</span>
              <Button onClick={async () => {
                await appManager.uninstallApp(app.name);
              }}>删除</Button>
            </div>
          })
            : '未安装第三方应用'
        }
      </div>
    </div>
  </div>
}

function SystemInfo() {

  const [si, setSystemInfo] = useState<systemInfo.SystemInfo>();

  useEffect(() => {
    (async () => {
      const si = await systemInfo.getSystemInfo();
      setSystemInfo(si);
    })();
  }, []);

  return <div>
    <div className={style['section-title']}>存储空间</div>
    <div className={style['setting-section']}>
      {si?.mounts ? <RecordBlock record={si.mounts as any} /> : '无数据'}
    </div>
    <div className={style['section-title']}>网络设备</div>
    <div className={style['setting-section']}>
      {si?.networks ? <RecordBlock record={si.networks as any} /> : '无数据'}
    </div>
    <div className={style['section-title']}>内存</div>
    <div className={style['setting-section']}>
      {si?.memory ? <RecordBlock record={si.memory as any} /> : '无数据'}
    </div>
    <div className={style['section-title']}>Swap</div>
    <div className={style['setting-section']}>
      {si?.swap ? <RecordBlock record={si.swap as any} /> : '无数据'}
    </div>
    <div className={style['section-title']}>Socket状态</div>
    <div className={style['setting-section']}>
      {si?.socket_stats ? <RecordBlock record={si.socket_stats as any} /> : '无数据'}
    </div>
  </div>
}

function DesktopSetting() {

  const [wallpaper, setWallpaper] = useState('');
  const [bgFillMode, setBgFillMode] = useState<'contain' | 'cover' | 'fill'>('cover');

  useEffect(() => {
    (async () => {
      const wp = await commonCollection.desktop.get<string>('wallpaper');
      if (wp) {
        setWallpaper(wp);
      }
      const fillMode = await commonCollection.desktop.get('bg-fill-mode');
      if (fillMode) {
        setBgFillMode(fillMode);
      }
    })();
    const unsubscribe = commonCollection.desktop.subscribe<string>('wallpaper', (v) => {
      setWallpaper(v || '');
    });
    const unsubscribe1 = commonCollection.desktop.subscribe<string>('bg-fill-mode', (v: any) => {
      setBgFillMode(v || 'contain');
    });
    return () => {
      unsubscribe();
      unsubscribe1();
    }
  }, []);

  return <div>
    <div className={style['section-title']}>壁纸</div>
    <div className={style['setting-section']}>
      <div className={classNames(style['setting-item'], style.justify)}>
        <span>{wallpaper ? '当前壁纸: ' + wallpaper : '未设置壁纸'}</span>
        <span>
          <Button onClick={async () => {
            const files = await systemSelectFile({ allowedExts: ['jpg', 'png', 'jpeg'] });
            if (files && files.length) {
              commonCollection.desktop.set('wallpaper', files[0]);
            }
          }} style={{ fontSize: 12 }}>设置壁纸</Button>
          {
            wallpaper && <Popover inline auto content={
              <div style={{ lineHeight: '35px', fontSize: 12, padding: '0 10px' }}>
                确认删除当前壁纸
                <Button type="danger" onClick={async () => {
                  await commonCollection.desktop.remove('wallpaper');
                  setWallpaper('');
                }} style={{ fontSize: 12 }}>确认</Button>
              </div>
            }>
              <Button style={{ fontSize: 12 }}>删除壁纸</Button>
            </Popover>
          }
        </span>
      </div>
      <Sep />
      <div className={classNames(style['setting-item'], style.justify)}>
        <span>壁纸填充方法</span>
        <select
          onChange={async e => {
            setBgFillMode(e.target.value as any);
            await commonCollection.desktop.set('bg-fill-mode', e.target.value);
          }}
          style={{ width: 125 }}
          value={bgFillMode}
        >
          <option value={'contain'}>完整包含</option>
          <option value={'cover'}>完整覆盖</option>
          <option value={'fill'}>缩放</option>
        </select>
      </div>
      <Sep />
      <div className={style['setting-item']}>
        <div className={style['section-title']}>预览</div>
        {
          wallpaper && <img style={{ width: 300, height: 'auto' }} src={create_download_link_from_file_path(wallpaper)}></img>
        }
      </div>
    </div>
  </div>
}

function Sep() {
  return <div className={style.sep}></div>
}

export async function unmount(ctx: AppContext) {
  console.log('unmount');
  reactRoot.unmount();
  appWindow = undefined;
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Image',
    iconUrl,
    width: 800,
    height: 500,
    supportExts: [],
  }
}

defineApp({
  start: mount,
  exit: unmount,
  getAppInfo
})