// @ts-nocheck
import '@icons/icons';
import './icon.less';
import classnames from 'classnames';
import mime from 'mime';
import { MouseEvent, useEffect, useState } from 'react';
import { http } from '@webby/core/utils';
import path from 'path-browserify';
import { create_download_link_from_file_path } from '@webby/core/fs';

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

export function FileThumbnailIcon(props: { imgStyle?: React.CSSProperties, noThumbnail?: boolean, className?: string, file: IconFile, dir: string, size?: number | string, imgHeight?: number, imgWidth?: number }) {
  let filename = props.file.name;
  let guess = mime.getType(filename);
  let name = 'file-b-2';
  let [imgReady, setImgReady] = useState('');

  useEffect(() => {
    let src = '';
    let abort: AbortController;
    if (!props.noThumbnail && guess?.includes('image')) {
      abort = new AbortController();
      const file = path.join(props.dir, filename);
      http.inner_fetch(create_download_link_from_file_path(file, 3600),
        {
          method: 'get',
          headers: { 'content-type': 'application/json' },
          signal: abort.signal,
        }).then(async resp => {
          const blob = await resp.blob();
          src = URL.createObjectURL(blob);
          setImgReady(src);
        });
    }
    return () => {
      if (abort) {
        abort.abort();
      }
      if (src) {
        URL.revokeObjectURL(src);
      }
    }
  }, [props.dir, filename, guess, props.noThumbnail]);

  if (imgReady) {
    return <img className={props.className} style={{ width: props.imgWidth || 16, height: props.imgHeight || 16, ...props.imgStyle || {} }} src={imgReady} alt={filename}></img>
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