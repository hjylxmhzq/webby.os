import '../../icons/icons';
import './icon.less';
import classnames from 'classnames';
import mime from 'mime';
import { MouseEvent, useEffect, useState } from 'react';
import { SmartImage } from '../image';
import React from 'react';
import { create_download_link_from_file_path } from '@webby/core/fs';
import path from 'path-browserify';

export function Icon({ name, size, className, onClick }: { className?: string, name: string, size?: number | string, onClick?: (e: MouseEvent) => void }) {
  return <svg onClick={onClick} className={classnames('icon', className)} aria-hidden="true" style={size ? { fontSize: size } : {}}>
    <use xlinkHref={'#icon-' + name}></use>
  </svg>
}

export interface IconFile {
  is_dir: boolean,
  name: string,
}

export function FileIcon(props: { className?: string, file: IconFile, size?: number | string }) {
  const filename = props.file.name;
  const guess = (mime as any).getType(filename);
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

export function FileThumbnailIcon(props: { imgStyle?: React.CSSProperties, noThumbnail?: boolean, className?: string, file: IconFile, dir: string, size?: number | string, imgHeight?: number, imgWidth?: number }) {
  const filename = props.file.name;
  const guess = (mime as any).getType(filename);
  let name = 'file-b-2';

  if (!props.noThumbnail && guess?.includes('image')) {
    const absFile = path.join(props.dir, filename);
    const dpr = window.devicePixelRatio || 1;
    const src = create_download_link_from_file_path(absFile, { resize: 150 * dpr, expires: 0 });
    return <SmartImage className={props.className} style={{ width: props.imgWidth || 16, height: props.imgHeight || 16, ...props.imgStyle || {} }} src={src} alt={filename}></SmartImage>;
  }

  if (props.file.is_dir) {
    name = 'file-b-';
  } else if (guess?.includes('image')) {
    name = 'tupian';
  } else if (guess?.includes('text')) {
    name = 'file-b-1';
  } else if (guess?.includes('pdf')) {
    name = 'file-b-7';
  } else if (guess?.includes('audio')) {
    name = 'file-b-6';
  }
  return <Icon {...props} name={name} />;
}