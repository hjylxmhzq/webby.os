import { useEffect, useRef, useState } from "react";
import ReactDOM from 'react-dom';
import style from './index.module.less';
import React from "react";

interface Props {
  children: React.ReactElement,
  content: React.ReactElement,
  show?: boolean,
  auto?: boolean,
  inline?: boolean,
  position?: 'top' | 'bottom',
}

export function Popover(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ left: 0, top: 0 });
  const [isShow, setIsShow] = useState(props.show);

  useEffect(() => {
    setIsShow(props.show);
  }, [props.show]);

  useEffect(() => {
    if (ref.current && contentRef.current) {
      const el = ref.current.firstElementChild;
      const contentEl = contentRef.current;
      if (!el) return;
      const bodyRect = document.body.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const rect1 = contentEl.getBoundingClientRect();
      const top = props.position === 'top' ? rect.top - bodyRect.top - rect1.height + 10 : rect.top - bodyRect.top + rect.height + 25;
      setRect({ left: rect.right - bodyRect.left - rect1.width, top });
    }
  }, [isShow, props.content, props.children]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      let target = e.composedPath()[0] as HTMLElement;
      if (contentRef.current && ref.current) {
        let contentEl = contentRef.current;
        let el = ref.current;
        if (contentEl.contains(target) || el.contains(target)) {
          return;
        }
        setIsShow(false);
      }
    };
    window.addEventListener('click', onClick, false);
    return () => {
      window.removeEventListener('click', onClick, false);
    };
  }, []);


  const onClick = (e: React.MouseEvent) => {
    if (props.auto) {
      setIsShow(true);
    }
  }

  const contentEl = <div onClick={onClick} ref={contentRef} className={style['popover-item']} style={{ position: 'fixed', left: rect.left, top: rect.top }}>
    {props.content}
  </div>;
  const portal = ReactDOM.createPortal(contentEl, document.body);
  return <div style={{ display: props.inline ? 'inline-block' : 'block' }} onClick={onClick} ref={ref}>
    {props.children}
    {isShow && portal}
  </div>
}