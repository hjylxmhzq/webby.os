import React, { MouseEvent } from 'react';
import '../../icons/icons';
import './icon.less';
import classnames from 'classnames';
import mime from 'mime';

export default function Icon({ name, size, className, onClick }: { className?: string, name: string, size?: number | string, onClick?: (e: MouseEvent) => void }) {
  return <span onClick={onClick} >
      <svg className={classnames('icon', className)} aria-hidden="true" style={size ? { fontSize: size } : {}}>
      <use xlinkHref={'#icon-' + name}></use>
    </svg>
  </span>
}

export interface IconFile {
  is_dir: boolean,
  name: string,
}

export function FileIcon(props: { className?: string, file: IconFile, size?: number | string }) {
  let filename = props.file.name;
  let guess = mime.getType(filename);
  let name = 'ziliao';
  if (props.file.is_dir) {
    name = 'wenjianjia';
  } else if (guess?.includes('image')) {
    name = 'tupian';
  }
  return <Icon {...props} name={name} />;
}