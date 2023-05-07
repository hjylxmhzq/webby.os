import React, { ReactNode, useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { HTMLAttributes } from "react";
import ReactDOM from 'react-dom';
import style from './index.module.less';
import { Icon } from "../icon";

interface Props {
  children: React.ReactNode,
  menu: Menu[],
}

export function ContextMenu(props: Props & HTMLAttributes<HTMLDivElement>) {
  const [pos, setPos] = useState<{ x: number, y: number }>()
  const container = useRef<HTMLDivElement>(null);

  const onClick = (e: React.MouseEvent) => {
    if (e.button !== 2) return;
    const { clientX, clientY } = e;
    const pos = {
      x: clientX,
      y: clientY,
    };
    setPos(pos);
  }

  return <div
    ref={container}
    onContextMenu={e => {
      e.preventDefault()
      onClick(e);
    }}
    {...props}>
    {props.children}
    {
      pos && <Menu menu={props.menu} onClose={() => setPos(undefined)} {...pos} />
    }
  </div>
}

export interface Menu {
  icon?: string;
  name: string;
  onClick?: (menu: Menu) => void;
  children?: Menu[];
}

interface MenuProps {
  menu: Menu[],
  x: number,
  y: number,
  onClose: () => void;
}

function Menu(props: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hide = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (ref.current?.contains(el)) {
        return;
      }
      props.onClose();
    };
    window.addEventListener('mousedown', hide);
    return () => {
      window.removeEventListener('mousedown', hide);
    }
  }, []);

  const el = <div ref={ref} className={style.menu} style={{ position: 'fixed', left: props.x, top: props.y }}>
    {
      props.menu.map(m => {
        return <div className={style['menu-row']} onMouseUp={() => {
          m.onClick?.(m);
          props.onClose();
        }}>
          <span>
            {
              m.icon && <Icon className={style.icon} name={m.icon} size={12}></Icon>
            }
          </span>
          <span>
            {m.name}
          </span>
        </div>
      })
    }
  </div>
  const node = ReactDOM.createPortal(el, document.body);
  return node;
}