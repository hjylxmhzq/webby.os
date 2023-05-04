import { useEffect, useMemo, useState } from "react";
import Button from "./components/button";
import { Popover } from "./components/popover";
import style from './index.module.less';
import ReactDom from 'react-dom/client';
import { AppContext, AppDefinitionWithContainer, AppInfo, getSharedScope } from '@webby/core/web-app';
import { http } from '@webby/core/utils';
import iconUrl from './icon.svg';
import { commonCollection } from "@webby/core/kv-storage";
import { create_download_link_from_file_path, getLocalFSCache, MetaAll } from "@webby/core/fs";
import { auth } from "@webby/core/api";
import classNames from 'classnames';
import { getAppManager, systemMessage, systemSelectFile } from "@webby/core/system";
import { Switch } from "../../components/switch";
import { formatFileSize } from "./utils";
import { SmartImage } from "@webby/components";

const localFSCache = getLocalFSCache();
let reactRoot: ReactDom.Root;

export async function mount(ctx: AppContext) {

  setTimeout(() => {
    ctx.appWindow.setSize(900, 600);
  });
  const root = ctx.appRootEl;
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
  '日志': <LogSetting />,
}

function SettingPage() {
  const [tabName, setTabName] = useState<menuKey>(Object.keys(menu)[0] as menuKey);
  return <div className={style['setting-page']}>
    <div className={style['left-bar']}>
      <div style={{ lineHeight: '40px' }}>设置</div>
      {
        Object.keys(menu).map((name: any) => {
          return <div key={name} className={style['menu-item']} onClick={() => setTabName(name)}>{name}</div>
        })
      }
    </div>
    <div className={classNames(style['info-page'])}>
      {menu[tabName]}
    </div>
  </div>
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
    <div>将App加入全局搜索</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          searchStatus.map(({ enabled, appName, app }, idx) => {
            return <div key={appName} className={style['setting-item-row']}>
              <span>{appName}</span>
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
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', email: '', group: '' });
  const [lastAdmin, setLastAdmin] = useState(true);

  async function refresh() {
    const users = await auth.getAllUsers();
    const groups = await auth.getAllGroups();
    const admins = users.filter(u => u.group_name === 'admin').length;
    if (admins > 1) {
      setLastAdmin(false);
    } else {
      setLastAdmin(true);
    }
    if (groups.length > 0) {
      setNewUser({ ...newUser, group: groups[0].name });
    }
    setUsers(users);
    setGroups(groups);
  }
  useEffect(() => {
    refresh();
  }, []);

  return <div>
    <div>权限</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>重置密码</span>
        <input className={style.input} type="text" placeholder="old password" value={pwds[0]} onChange={e => setPwds([e.target.value, pwds[1]])} />
        <input className={style.input} type="text" placeholder="new password" value={pwds[1]} onChange={e => setPwds([pwds[0], e.target.value])} />
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
          <Button style={{ fontSize: 12 }}>Confirm</Button>
        </Popover>
      </div>
    </div>
    <div>用户管理</div>
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
    </div><div className={style['setting-section']}>
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
              return <div className={style['user-list-item']}>
                <span>{group.name}</span>
                <span>{group.desc}</span>
                <span>{group.permissions}</span>
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
  useEffect(() => {
    loadMeta();
  }, []);
  return <div>
    <div>本地文件缓存</div>
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
    <div>缓存列表</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          localFSCacheMeta?.metas.map(m => {
            return <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
              <span>{m.key}</span>
              <span>{formatFileSize(m.size)}</span>
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
    <div>已安装应用</div>
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
    <div>第三方应用</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        {
          appManager.thirdPartyApps.map((app, idx) => {
            return <div key={idx}>
              <span>{app.name}</span>
              <Button onClick={async () => {
                await appManager.uninstallApp(app.name);
              }}>删除</Button>
            </div>
          })
        }
      </div>
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
    <div>壁纸</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>{wallpaper || '未设置壁纸'}</span>
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
      </div>
      <div className={style['setting-item']}>
        <span>壁纸填充方法</span>
        <select
          onChange={async e => {
            setBgFillMode(e.target.value as any);
            await commonCollection.desktop.set('bg-fill-mode', e.target.value);
          }}
          value={bgFillMode}
        >
          <option value={'contain'}>contain</option>
          <option value={'cover'}>cover</option>
          <option value={'fill'}>fill</option>
        </select>
      </div>
      <div className={style['setting-item']}>
        {
          wallpaper && <img style={{ width: 300, height: 'auto' }} src={create_download_link_from_file_path(wallpaper)}></img>
        }
      </div>
    </div>
  </div>
}

export async function unmount(ctx: AppContext) {
  reactRoot.unmount();
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
