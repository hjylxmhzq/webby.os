import style from './header.module.less';
import { useEffect, useRef, useState } from "react";
import { useTheme } from "src/hooks/common";
import Icon from "src/components/icon/icon";
import { fullscreen } from "src/utils/common";
import { DropdownMenu } from "src/pages/desktop/components/header/dropdown-menu";
import { AppMenu, AppState } from '@webby/core/web-app';
import { logout } from 'src/apis/auth';
import { windowManager } from 'src/utils/micro-app';

const luanchMenu: AppMenu = {
  name: 'Desktop',
  children: [{
    name: '系统设置',
    async onClick() {
      windowManager.startApp('Setting');
    }
  }, {
    name: '退出登录',
    async onClick() {
      await logout();
      window.location.href = '/login';
    }
  }]
}

export default function Header(props: { menu: AppMenu[], activeApp?: AppState | null }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function _setTime() {
      let now = new Date();
      let h = now.getHours();
      let m = ('0' + now.getMinutes()).slice(-2);
      let d = '上午';
      if (h >= 12) {
        d = '下午';
        h -= 12;
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

  return <div className={style.header} ref={el}>
    <nav className={style.left}>
      <DropdownMenu menu={luanchMenu} />
      {
        props.menu.map((onemenu) => {
          return <DropdownMenu key={onemenu.name} menu={onemenu} />;
        })
      }
    </nav>
    <span className={style.right}>
      <span onClick={() => {
        const elem = document.documentElement as any;
        fullscreen(elem);
      }}>
        M
      </span>
      <span onClick={() => toggleTheme(theme === 'light' ? 'dark' : 'light')}>
        <Icon name="dark" size={18} className={style.icon} />
      </span>
      <span>{time}</span>
    </span>
  </div >
}