import { useNavigate } from "react-router";
import { logout } from "@apis/auth";
import style from './header.module.less';
import { useEffect, useState } from "react";

export default function Header() {
  const history = useNavigate();
  const [time, setTime] = useState('');

  useEffect(() => {
    function _setTime() {
      let now = new Date();
      let h = now.getHours();
      let m = ('0' + now.getMinutes()).substring(0, 2);
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

  return <div className={style.header}>
    <nav>
      <span className={style['menu-item']} onClick={() => history('/', { state: { currentDir: '' } })}>File</span>
    </nav>
    <span>
      <span>{time}</span>
    </span>
  </div>
}