import classNames from 'classnames';
import style from './loading-bar.module.less';

export default function LoadingBar({ loading }: { loading: boolean }) {
  return <div className={classNames(style['loading-bar'], { [style['is-loading']]: loading })}></div>
}