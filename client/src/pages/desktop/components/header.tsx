import { useNavigate } from "react-router";
import style from './header.module.less';
import { useEffect, useState } from "react";
import { useTheme } from "src/hooks/common";
import Icon from "src/components/icon/icon";
import { fullscreen } from "src/utils/common";

export default function Header() {
  const history = useNavigate();
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

  return <div className={style.header}>
    <nav>
      <span className={style['menu-item']} onClick={() => history('/', { state: { currentDir: '' } })}>File</span>
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