import style from './index.module.less';
import classnames from 'classnames';
import Icon from '../icon/icon';
import { MouseEvent } from 'react';

export interface IProps {
  className?: string,
  size?: number,
  onChange?: (checked: boolean) => void,
  checked?: boolean,
  disabled?: boolean
  onClick?: (e: MouseEvent) => void;
}
export default function Checkbox({ onClick, size = 14, checked, onChange, className, disabled }: IProps) {
  return <div
    onClick={(e) => {
      !disabled && onChange?.(!checked);
      onClick?.(e);
    }}
    style={{ width: size, height: size }}
    className={classnames(className, style['checkbox'], { [style['disabled']]: disabled })}
  >
    <Icon className={classnames(style['tick'], { [style['checked']]: checked })} name="gou" size={size - 2} />
  </div>
}
