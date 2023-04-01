import { useEffect, useMemo, useState } from "react";
import { auth } from "@webby/core/api";
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
    Files: <DownloadSetting />,
    Authentication: <UserSetting />,
    Desktop: <DesktopSetting selectFile={ctx.selectFile} />
  }

  function SettingPage() {
    const [tabName, setTabName] = useState<menuKey>(Object.keys(menu)[0] as menuKey);
    return <div className={style['setting-page']}>
      <div className={style['left-bar']}>
        <div style={{ lineHeight: '40px' }}>Settings</div>
        {
          Object.keys(menu).map((name: any) => {
            return <div key={name} className={style['menu-item']} onClick={() => setTabName(name)}>{name}</div>
          })
        }
      </div>
      <div className={style['info-page']}>
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
    return <div>
      <div>Secure</div>
      <div className={style['setting-section']}>
        <div className={style['setting-item']}>
          <span>Change Password: </span>
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
    </div>
  }

  function DesktopSetting(props: { selectFile: (options: SelectFileOptions) => Promise<string[] | null> }) {

    const [wallpaper, setWallpaper] = useState('');

    useEffect(() => {
      (async () => {
        const wp = await commonCollection.desktop.get('wallpaper');
        if (wp) {
          setWallpaper(wp);
        }
        commonCollection.desktop.subscribe('wallpaper', (v) => {
          setWallpaper(v || '');
        });
      })();
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
