import style from './index.module.less';
import classnames from 'classnames';

export default function Checkbox({ size = 14, checked, onChange, className }: { className?: string, size?: number, onChange?: (checked: boolean) => void, checked?: boolean }) {
  return <div onClick={() => onChange?.(!checked)} style={{ width: size, height: size }} className={classnames(className, style['checkbox'])}>
    <div className={classnames(style['tick'], { [style['checked']]: checked })} />
  </div>
}
