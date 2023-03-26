import { useNavigate } from "react-router";
import { logout } from "@apis/auth";
import style from './header.module.less';

export default function Header() {
  const history = useNavigate();

  return <div className={style.header}>
    <nav>
      <span className={style['menu-item']} onClick={() => history('/', { state: { currentDir: '' } })}>File</span>
    </nav>
    <span>
      <span onClick={async () => {
        await logout();
        window.location.href = '/login';
      }}>Logout</span>
    </span>
  </div>
}