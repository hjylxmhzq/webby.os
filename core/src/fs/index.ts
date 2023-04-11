import { AxiosProgressEvent } from "axios";
import path from "path-browserify";
import { post, post_formdata, post_raw, Response } from "../utils/http";

export interface FileStat {
  name: string;
  size: number;
  is_dir: boolean;
  is_file: boolean;
  created: number;
  modified: number;
  accessed: number;
}

export interface FileStatWithDir {
  name: string;
  dir: string;
  size: number;
  is_dir: boolean;
  is_file: boolean;
  created: number;
  modified: number;
  accessed: number;
}

export async function readdir(dir: string): Promise<FileStat[]> {
  let resp = await post('/file/read_dir', {
    file: dir
  }, 'read_dir_' + dir);
  return resp.data.files;
}

export async function search_files(keyword: string, dir = ''): Promise<FileStatWithDir[]> {
  let resp = await post('/file/search_files', {
    keyword,
    dir
  });
  return resp.data;
}

export async function delete_file(file: string): Promise<boolean> {
  let resp = await post('/file/delete', {
    file: path.join(file)
  });
  return resp.status === 0;
}

export async function delete_files(files: string[]): Promise<boolean> {
  let resp = await post('/file/delete_batch', {
    files
  });
  return resp.status === 0;
}

export async function makedir(dir: string): Promise<boolean> {
  let resp = await post('/file/create_dir', {
    file: dir
  });
  return resp.status === 0;
}

export function create_download_link(dir: string, file: string, params: Record<string, string> = {}) {
  const url = new URL('/file/read', window.location.origin);
  const file_path = path.join(dir, file);
  url.searchParams.set('file', file_path);
  for (let k in params) {
    url.searchParams.set(k, params[k]);
  }
  return url.toString();
}

export function create_download_link_from_file_path(abs_file: string, expires?: number) {
  const url = new URL('/file/read', window.location.origin);
  url.searchParams.set('file', abs_file);
  if (expires) {
    url.searchParams.set('expires', expires + '');
  }
  return url.toString();
}

export async function move_file(from_file: string, to_file: string): Promise<boolean> {
  let resp = await post('/file/move', {
    from_file,
    to_file
  });
  return resp.status === 0;
}

export async function copy_file(from_file: string, to_file: string): Promise<boolean> {
  let resp = await post('/file/copy', {
    from_file,
    to_file
  });
  return resp.status === 0;
}

export function create_thumbnail_link(dir: string, file: string) {
  const url = new URL('/file/read_image', window.location.origin);
  const file_path = path.join(dir, file);
  const dpr = window.devicePixelRatio || 1;
  const size = dpr * 200;
  url.searchParams.set('file', file_path);
  url.searchParams.set('resize', size.toString());
  return url.toString();
}

export function create_compression_download_link(dir: string, file: string) {
  const url = new URL('/file/read_compression', window.location.origin);
  const file_path = path.join(dir, file);
  url.searchParams.set('file', file_path);
  return url.toString();
}

export async function read_text_file(dir: string, file: string) {
  const url = new URL('/file/read', window.location.origin);
  const file_path = path.join(dir, file);
  let resp = await post_raw(url.toString(), { file: file_path });
  let content = await resp.text();
  return content;
}

export async function read_file(file: string): Promise<Blob> {
  const url = new URL('/file/read', window.location.origin);
  const file_path = path.join(file);
  let resp = await post_raw(url.toString(), { file: file_path }, file);
  let content = await resp.blob();
  return content;
}

export async function read_zip_entries(dir: string, file: string) {
  const url = new URL('/file/read_zip_entries', window.location.origin);
  const file_path = path.join(dir, file);
  let resp = await post(url.toString(), { file: file_path }, 'read_zip_entries');
  return resp.data;
}

export async function _search_files(keyword: string) {
  const url = new URL('/file/search', window.location.origin);
  let resp = await post(url.toString(), { keyword }, 'search_files');
  return resp.data;
}

export async function search_files_content(keyword: string) {
  const url = new URL('/file/search_content', window.location.origin);
  let resp = await post(url.toString(), { keyword }, 'search_files_content');
  return resp.data;
}

export async function get_file_index_updated_at() {
  const url = new URL('/file/index_updated_at', window.location.origin);
  let resp = await post(url.toString(), {}, 'file_index_updated_at');
  return resp.data;
}

export async function get_storage_info() {
  const url = new URL('/file/storage_info', window.location.origin);
  let resp = await post(url.toString(), {}, 'storage_info');
  return resp.data;
}

export async function write_files(dir: string, files: File[], config?: { onUploadProgress?: (e: AxiosProgressEvent, info: { text: string }) => void }) {
  const url = new URL('/file/upload', window.location.origin);

  const form = new FormData();
  for (let file of files) {
    let name = file.webkitRelativePath || file.name;
    const file_path = path.join(dir, name);
    form.append(file_path, file, file.name);
  }
  form.append('dir', dir);
  const text = files.length > 1 ? files[0].name + `...(${files.length}Files)` : files[0].name;
  let resp = await post_formdata(url.toString(), form, (e) => config?.onUploadProgress?.(e, { text }));
  return resp;
}

export async function upload(
  dir: string,
  config?: {
    directory?: boolean,
    mulitple?: boolean,
    onUploadProgress?: (e: AxiosProgressEvent, info: { text: string }) => void
  }
): Promise<Response> {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.style.display = 'none';
  input.multiple = !!config?.mulitple;
  input.webkitdirectory = !!config?.directory;
  document.body.appendChild(input);
  return new Promise((resolve, reject) => {
    input.addEventListener('change', async () => {
      if (!input.files) {
        reject(undefined);
        return;
      }
      let length = input.files.length;
      let files: File[] = [];
      for (let i = 0; i < length; i++) {
        const f = input.files.item(i);
        if (f) {
          files.push(f);
        }
      }
      if (files.length) {
        let resp = await write_files(dir, files, config);
        resolve(resp);
      } else {
        reject(undefined);
      }
    }, false);
    input.click();
    document.body.removeChild(input);
  });
}
