import { AppActionMenu } from '@webby/core/web-app';
import { WheelEvent, useEffect, useRef, useState } from 'react';
import style from './dropdown-menu.module.less';
import classNames from 'classnames';
import Icon from 'src/components/icon/icon';

export function DropdownMenu({ menu }: { menu: AppActionMenu }) {
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
  const onClick = (item: AppActionMenu) => {
    if (!item.children?.length) {
      setShowMenu(false);
    }
    item.onClick?.(item);
  };

  const hasCheckedInChildren = menu.children?.some(c => c.checked);
  return <span className={style.dropdown} ref={el}>
    <span className={style['menu-text']} onClick={onClickOpen}>
      {menu.name}
    </span>
    {
      showMenu && !!menu.children?.length &&
      <div className={classNames(style['menu-item-popup'], 'scrollbar')}>
        {
          menu.children?.map((submenu: AppActionMenu) => {
            return <MenuItem morePadding={hasCheckedInChildren} key={submenu.name} item={submenu} onClick={onClick} />
          })
        }
      </div>
    }
  </span>
}

function MenuItem({ morePadding, item, onClick }: { morePadding?: boolean, item: AppActionMenu, onClick: (item: AppActionMenu) => void }) {
  const [showChildren, setShowChildren] = useState(false);
  const [startIdx, setStartIdx] = useState(0);
  const onMouseover = () => setShowChildren(true);
  const onMouseout = () => setShowChildren(false);
  const _onClick = () => {
    onClick(item);
  };
  const maxItems = (document.documentElement.clientHeight - 30) / 26 >> 0;

  const endIdx = startIdx + maxItems;

  const children: AppActionMenu[] | undefined = item.children?.slice(startIdx, endIdx);

  const up = () => {
    if (startIdx > 0) {
      setStartIdx(startIdx - 1);
    }
  };

  const down = () => {
    if (endIdx < (item.children?.length || 0)) {
      setStartIdx(startIdx + 1);
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY > 0) {
      down();
    } else if (e.deltaY < 0) {
      up();
    }
  }

  const hasMoreUp = startIdx > 0;
  const hasMoreDown = endIdx < (item.children?.length || 0);

  const hasCheckedInChildren = item.children?.some(c => c.checked);

  return <div className={classNames(style['menu-item'], { [style['more-padding']]: morePadding })} onMouseOver={onMouseover} onMouseOut={onMouseout} onWheel={onWheel}>
    <span className={classNames(style['menu-item-text'])} onClick={_onClick}>
      <span className={style.tick}>
        {
          !!item.checked && <Icon size={12} name='gou' />
        }
      </span>
      <span className={style.text}>
        {item.name}
      </span>
      <span className={style.arrow}>
        {
          !!item.children?.length && <Icon name="arrow-down" className={style['arrow-icon']} />
        }
      </span>
    </span>
    {
      showChildren && !!children?.length &&
      <div className={style['menu-item-submenu']}>
        {
          hasMoreUp && <Icon onClick={up} name='arrow-down' className={style['up-arrow']}></Icon>
        }
        {
          children.map((submenu: AppActionMenu) => {
            return <MenuItem morePadding={hasCheckedInChildren} key={submenu.name} item={submenu} onClick={onClick}></MenuItem>
          })
        }
        {
          hasMoreDown && <Icon onClick={down} name='arrow-down'></Icon>
        }
      </div>
    }
  </div>
}