import { useEffect, useMemo, useState } from "react";
import Button from "./components/button";
import { Popover } from "./components/popover";
import { formatTime } from "./utils";
import StoragePieChart from "./components/pie-chart";
import style from './index.module.less';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, SelectFileOptions } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { commonCollection } from "@webby/core/kv-storage";
import { create_download_link_from_file_path } from "@webby/core/fs";
import { auth } from "@webby/core/api";
import classNames from 'classnames';

let reactRoot: ReactDom.Root;

export async function mount(ctx: AppContext) {

  setTimeout(() => {
    ctx.appWindow.setSize(900, 600);
  });
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';
  type menuKey = keyof typeof menu;

  const menu = {
    '桌面与个性化': <DesktopSetting selectFile={ctx.selectFile} />,
    '用户与安全性': <UserSetting />,
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


  function DownloadSetting() {
    const [updatedCount, setUpdatedCount] = useState(0);
    const [indexUpdatedAt, setIndexUpdatedAt] = useState(0);
    const [storageInfo, setStorageInfo] = useState<any>([]);

    const convertedStorageInfo = useMemo(() => {
      return storageInfo
        .filter((info: any) => !!info.format)
        .map((info: any) => ({ size: info.size, name: info.format }));
    }, [storageInfo]);

    return <div>
      <div>Preview Options</div>
      <div>File Indexing</div>
      <div className={style['setting-section']}>
        <div className={style['setting-item']}>
          <span>Update Files Index: </span>
          <Button style={{ fontSize: 12 }} onClick={async () => {
          }}>Update</Button>
        </div>
        <div className={style['setting-item']}>
          {
            updatedCount > 0 && <span>Updated: {updatedCount} files</span>
          }
        </div>
        <div className={style['setting-item']}>
          {
            indexUpdatedAt > 0 && <span>Last updated time: {formatTime(indexUpdatedAt)}</span>
          }
        </div>
      </div>
      <div>Storage Layout</div>
      <div className={style['setting-section']}>
        <div className={style['setting-item']}>
          {/* <StoragePieChart items={convertedStorageInfo} /> */}
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
      console.log('last admin', users);
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
                      ctx.systemMessage({ type: 'error', title: '信息错误', content: `${k} 不能为空`, timeout: 5000 });
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

  function DesktopSetting(props: { selectFile: (options: SelectFileOptions) => Promise<string[] | null> }) {

    const [wallpaper, setWallpaper] = useState('');

    useEffect(() => {
      (async () => {
        const wp = await commonCollection.desktop.get<string>('wallpaper');
        if (wp) {
          setWallpaper(wp);
        }
      })();
      const unsubscribe = commonCollection.desktop.subscribe<string>('wallpaper', (v) => {
        setWallpaper(v || '');
      });
      return unsubscribe;
    }, []);

    return <div>
      <div>壁纸</div>
      <div className={style['setting-section']}>
        <div className={style['setting-item']}>
          <span>{wallpaper || '未设置壁纸'}</span>
          <Button onClick={async () => {
            const files = await props.selectFile({ allowedExts: ['jpg', 'png', 'jpeg'] });
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
          {
            wallpaper && <img style={{ width: 300, height: 'auto' }} src={create_download_link_from_file_path(wallpaper)}></img>
          }
        </div>
      </div>
    </div>
  }

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<SettingPage />)

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
