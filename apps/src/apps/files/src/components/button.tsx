import { MouseEventHandler } from "react"
import style from './button.module.less';

interface Props {
  children: React.ReactNode,
  onClick?: MouseEventHandler
}

export default function Button(props: Props) {
  return <button className={style.btn} onClick={props.onClick}>{props.children}</button>
}
