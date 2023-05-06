import style from './header.module.less';
import { useEffect, useRef, useState } from "react";
import { useTheme } from "src/hooks/common";
import Icon from "src/components/icon/icon";
import { fullscreen } from "src/utils/common";
import { DropdownMenu } from "src/pages/desktop/components/header/dropdown-menu";
import { AppActionMenu, AppMenu, AppMenuManager, AppState, processManager } from '@webby/core/web-app';
import { logout } from 'src/apis/auth';
import { showGlobalSearch } from '../..';
import classNames from 'classnames';
import { getAppManager } from '@webby/core/system';

const appManager = getAppManager();

const _luanchMenu: AppMenu = {
  name: 'Desktop',
  children: [{
    name: '系统设置',
    async onClick() {
      processManager.startApp('Setting');
    }
  }, {
    name: '所有应用',
    id: 'all-app',
    children: appManager.apps.map(app => {
      return {
        name: app.name,
        icon: app.getAppInfo().iconUrl,
        onClick() {
          processManager.startApp(app.name);
        }
      }
    }),
  }, {
    name: '退出登录',
    async onClick() {
      await logout();
      window.location.href = '/login';
    }
  }]
};

const luanchMenuManager = new AppMenuManager();
luanchMenuManager.set([_luanchMenu]);

const luanchMenu = luanchMenuManager.get()[0];
appManager.onAppInstalled(() => {
  const menu = luanchMenuManager.getById('all-app')!;
  menu.setChildren(appManager.apps.map(app => {
    return {
      name: app.name,
      icon: app.getAppInfo().iconUrl,
      onClick() {
        processManager.startApp(app.name);
      }
    }
  }));
});

export default function Header(props: { flow: boolean, menu: AppActionMenu[], activeApp?: AppState | null }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function _setTime() {
      let now = new Date();
      let h = now.getHours();
      let m = ('0' + now.getMinutes()).slice(-2);
      let d = '上午';
      if (h >= 12) {
        d = '下午';
        h = h === 12 ? 12 : h - 12;
      }
      setTime(`${d}${h}:${m}`);
    }
    _setTime();
    let timer = setInterval(() => {
      _setTime();
    }, 1000);
    return () => {
      clearInterval(timer);
    }
  }, []);

  const [theme, toggleTheme] = useTheme();
  const el = useRef<HTMLDivElement>(null);

  const [lmenu, setLMenu] = useState(luanchMenu)
  useEffect(() => {
    const unbind = lmenu.onChange((m) => {
      setLMenu(luanchMenu);
    });
    return unbind;
    // eslint-disable-next-line
  }, []);

  return <div className={classNames(style.header, { [style.flow]: props.flow })} ref={el}>
    <nav className={style.left}>
      <DropdownMenu menu={lmenu} />
      {
        props.menu.map((onemenu) => {
          return <DropdownMenu key={onemenu.name} menu={onemenu} />;
        })
      }
    </nav>
    <span className={style.right}>
      <span onClick={() => {
        showGlobalSearch();
      }}>
        <Icon name="search" size={14} className={style.icon} />
      </span>
      <span onClick={() => {
        const elem = document.documentElement as any;
        fullscreen(elem);
      }}>
        <Icon name="fullscreen" size={16} className={style.icon} />
      </span>
      <span onClick={() => toggleTheme(theme === 'light' ? 'dark' : 'light')}>
        <Icon name="dark" size={18} className={style.icon} />
      </span>
      <span>{time}</span>
    </span>
  </div>
}