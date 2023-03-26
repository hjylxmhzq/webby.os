import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react";
import { resetPassword } from "@apis/auth";
import { get_file_index_updated_at, get_storage_info } from "@apis/file";
import { update_index, get_job_status } from "@apis/gallery";
import Button from "@components/button";
import Checkbox from "@components/checkbox";
import { Popover } from "@components/popover";
import { setting, Setting } from "@store";
import { formatTime } from "@utils/formatter";
import StoragePieChart from "./components/pie-chart";
import style from './index.module.less';

interface IProps {
  setting: Setting,
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

export default SettingPage;

type menuKey = keyof typeof menu;

const DownloadSetting = observer(({ setting }: IProps) => {
  const [rpcUrl, setRpcUrl] = useState(setting.download.aria2RpcUrl);
  const [rpcToken, setRpcToken] = useState(setting.download.aria2RpcToken);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [indexUpdatedAt, setIndexUpdatedAt] = useState(0);
  const [storageInfo, setStorageInfo] = useState<any>([]);

  const convertedStorageInfo = useMemo(() => {
    return storageInfo
      .filter((info: any) => !!info.format)
      .map((info: any) => ({ size: info.size, name: info.format }));
  }, [storageInfo]);

  async function updateIndexingStatus() {
    let status = await get_job_status();
    if (status.data.Running !== undefined) {
      setUpdatedCount(status.data.Running);
      setTimeout(updateIndexingStatus, 1000);
    } else {
      await updateIndexUpdatedAtTime();
      await updateStorageInfo();
    }
  }

  async function updateIndexUpdatedAtTime() {
    let updatedAt = await get_file_index_updated_at();
    setIndexUpdatedAt(parseInt(updatedAt, 10));
  }

  async function updateStorageInfo() {
    let storageInfo = await get_storage_info();
    setStorageInfo(storageInfo);
  }

  useEffect(() => {
    updateIndexingStatus();
    updateIndexUpdatedAtTime();
    updateStorageInfo();
    // eslint-disable-next-line
  }, []);

  return <div>
    <div>Aria2 Configuration</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>Enable Aria2 download link: </span>
        <Checkbox className={style.checkbox} checked={setting.download.aria2Enabled} onChange={checked => {
          if (checked) setting.enableAria2();
          else setting.disableAria2();
        }} />
      </div>
      <div className={style['setting-item']}>
        <span>Aria2RPC URL: </span>
        <input style={{ width: 250 }} className={style.input} type="text" placeholder="e.g. http://localhost:6800/jsonrpc" value={rpcUrl} onChange={e => setRpcUrl(e.target.value)} />
        <Button style={{ fontSize: 12 }} onClick={() => {
          setting.setAria2RPCUrl(rpcUrl);
        }}>Save</Button>
      </div>
      <div className={style['setting-item']}>
        <span>Aria2RPC Token: </span>
        <input style={{ width: 250 }} className={style.input} type="text" placeholder="aria2 token" value={rpcToken} onChange={e => setRpcToken(e.target.value)} />
        <Button style={{ fontSize: 12 }} onClick={() => {
          setting.setAria2RPCToken(rpcToken);
        }}>Save</Button>
      </div>
    </div>
    <div>Download Options</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>Enable Zip Download for Folder: </span>
        <Checkbox className={style.checkbox} checked={setting.download.zipDownloadEnabled} onChange={checked => {
          setting.enableZipDownload(checked);
        }} />
      </div>
    </div>
    <div>Preview Options</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>Enable image thumbnails scale: </span>
        <Checkbox className={style.checkbox} checked={setting.preview.thumbnailScalingEnabled} onChange={checked => {
          setting.enableThumbnailScaling(checked);
        }} />
      </div>
      <div className={style['setting-item']}>
        <span>Enable Pdf preview: </span>
        <Checkbox className={style.checkbox} checked={setting.preview.pdfPreviewEnabled} onChange={checked => {
          setting.enablePdfPreview(checked);
        }} />
      </div>
    </div>
    <div>File Indexing</div>
    <div className={style['setting-section']}>
      <div className={style['setting-item']}>
        <span>Update Files Index: </span>
        <Button style={{ fontSize: 12 }} onClick={async () => {
          await update_index();
          await updateIndexingStatus();
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
        <StoragePieChart items={convertedStorageInfo} />
      </div>
    </div>
  </div>
});

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
              let success = await resetPassword(...pwds);
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

const menu = {
  Files: <DownloadSetting setting={setting} />,
  Authentication: <UserSetting />
}
