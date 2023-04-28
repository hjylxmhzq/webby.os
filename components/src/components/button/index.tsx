import classNames from "classnames";
import { CSSProperties, MouseEventHandler, ReactNode, useEffect, useRef, useState } from "react";
import style from './index.module.less';
import React from "react";

interface Props {
  onClick?: MouseEventHandler;
  children: ReactNode;
  height?: number
  type?: 'normal' | 'danger',
  style?: CSSProperties,
  className?: string,
}

export default function Button(props: Props) {
  const onClick: MouseEventHandler = function (this: any, e) {
    props.onClick?.call(this, e);
  };
  return <button
    style={{ height: props.height || 'auto', ...(props.style || {}) }}
    className={classNames(props.className, style.btn, { [style.danger]: props.type === 'danger' })}
    onClick={onClick}>{props.children}</button>
}

export function AnimationButton(props: Props) {
  return <button
    style={{ height: props.height || 'auto', ...(props.style || {}) }}
    className={classNames(props.className, style.btn, style.animation, { [style.danger]: props.type === 'danger' })}
    onClick={props.onClick}>{props.children}</button>
}

interface PopBtnProps {
  children?: ReactNode;
  button?: ReactNode;
  width?: number;
  height?: number;
}

export function PopButton(props: PopBtnProps) {
  const w = props.width || 50;
  const h = props.height || 50;
  const ref = useRef<HTMLDivElement>(null);
  const rectRef = useRef({ width: w, height: h });
  const [show, setShow] = useState(false);

  // useEffect(() => {
  //   if (ref.current) {
  //     const rect = ref.current.getBoundingClientRect();
  //     rectRef.current = { width: rect.width, height: rect.height };
  //   }
  // }, []);

  const onMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      rectRef.current = { width: rect.width, height: rect.height };
    }
    setShow(true);
  }

  const onMouseLeave = () => {
    setShow(false);
  };

  const s = show ? rectRef.current : { width: w, height: h };
  return <div className={style['pop-btn']} style={s} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <div className={style['pop-content']}>
      <div ref={ref}>{props.children}</div>
    </div>
    <div className={style['pop-inner-btn']} style={{ width: w, height: h }}>{props.button}</div>
  </div>
}
