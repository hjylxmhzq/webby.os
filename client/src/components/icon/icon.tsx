// @ts-nocheck
import '@icons/icons';
import './icon.less';
import classnames from 'classnames';
import mime from 'mime';
import { MouseEvent } from 'react';
import { create_download_link } from '@webby/core/fs';

export default function Icon({ name, size, className, onClick }: { className?: string, name: string, size?: number | string, onClick?: (e: MouseEvent) => void }) {
  return <svg onClick={onClick} className={classnames('icon', className)} aria-hidden="true" style={size ? { fontSize: size } : {}}>
    <use xlinkHref={'#icon-' + name}></use>
  </svg>
}

export interface IconFile {
  is_dir: boolean,
  name: string,
}

export function FileIcon(props: { className?: string, file: IconFile, size?: number | string }) {
  let filename = props.file.name;
  let guess = mime.getType(filename);
  let name = 'file-b-2';
  if (props.file.is_dir) {
    name = 'file-b-';
  } else if (guess?.includes('image')) {
    name = 'tupian';
  } else if (guess?.includes('video')) {
    name = 'file-b-3';
  } else if (guess?.includes('text')) {
    name = 'file-b-1';
  }
  return <Icon {...props} name={name} />;
}

export function FileThumbnailIcon(props: { className?: string, file: IconFile, dir: string, size?: number | string, imgHeight?: number, imgWidth?: number }) {
  let filename = props.file.name;
  let guess = mime.getType(filename);
  let name = 'file-b-2';
  if (guess?.includes('image')) {
    const link = create_download_link(props.dir, filename);
    return <img className={props.className} style={{ width: props.imgWidth || 16, height: props.imgHeight || 16, }} src={link} alt={filename}></img>
  }
  if (props.file.is_dir) {
    name = 'file-b-';
  } else if (guess?.includes('image')) {
    name = 'tupian';
  } else if (guess?.includes('text')) {
    name = 'file-b-1';
  }
  return <Icon {...props} name={name} />;
}