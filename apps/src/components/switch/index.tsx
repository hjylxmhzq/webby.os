import style from './index.module.less';
import classNames from 'classnames';

interface Props {
  enabled?: boolean,
  onChange?(enabled: boolean): void;
  className?: string;
}

export function Switch(props: Props) {
  return <span
   tabIndex={0}
    className={classNames(props.className, style.switch, { [style.enabled]: props.enabled })}
    onClick={() => {
      props.onChange?.(!props.enabled);
    }}
  ></span>
}
