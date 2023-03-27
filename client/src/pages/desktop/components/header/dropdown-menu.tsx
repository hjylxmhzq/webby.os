import { AppMenu } from '@webby/core/web-app';
import { useEffect, useRef, useState } from 'react';
import style from './dropdown-menu.module.less';

export function DropdownMenu({ menu }: { menu: AppMenu }) {
  const el = useRef<HTMLSpanElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const onClickOpen = () => {
    setShowMenu(true);
    menu.onClick?.(menu);
  }
  useEffect(() => {
    const hideMenu = (e: MouseEvent) => {
      if (!el.current) return;
      if (el.current.contains(e.target as HTMLElement)) {
        return;
      }
      setShowMenu(false);
    };
    window.addEventListener('mousedown', hideMenu);
    return () => {
      window.removeEventListener('mousedown', hideMenu);
    }
  }, []);
  const onClick = (item: AppMenu) => {
    if (!item.children?.length) {
      setShowMenu(false);
    }
    item.onClick?.(item);
  };
  return <span className={style.dropdown} ref={el}>
    <span className={style['menu-text']} onClick={onClickOpen}>
      {menu.name}
    </span>
    {
      showMenu && menu.children?.length &&
      <div className={style['menu-item-popup']}>
        {
          menu.children?.map(submenu => {
            return <MenuItem key={submenu.name} item={submenu} onClick={onClick} />
          })
        }
      </div>
    }
  </span>
}

function MenuItem({ item, onClick }: { item: AppMenu, onClick: (item: AppMenu) => void }) {
  const [showChildren, setShowChildren] = useState(false);
  const onMouseover = () => setShowChildren(true);
  const onMouseout = () => setShowChildren(false);
  const _onClick = () => {
    onClick(item);
  };
  return <div className={style['menu-item']} onMouseOver={onMouseover} onMouseOut={onMouseout}>
    <span className={style['menu-item-text']} onClick={_onClick}>
      <span>
        {item.name}
      </span>
      <span>
        {
          item.children?.length && <span>&gt;</span>
        }
      </span>
    </span>
    {
      showChildren && item.children?.length &&
      <div className={style['menu-item-submenu']}>
        {
          item.children.map((submenu) => {
            return <MenuItem key={submenu.name} item={submenu} onClick={onClick}></MenuItem>
          })
        }
      </div>
    }
  </div>
}