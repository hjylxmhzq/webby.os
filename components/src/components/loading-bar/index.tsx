import classNames from 'classnames';
import style from './index.module.less';

export function LoadingBar({ loading }: { loading: boolean }) {
  return <div className={classNames(style['loading-bar'], { [style['is-loading']]: loading })}></div>;
}
