import { AxiosProgressEvent } from "axios";
import path from "path-browserify";
import { post, post_formdata, post_raw, Response } from "../utils/http";
import { systemMessage } from "../system";
import { LocalCache } from "./local-cache";
import { ensureSharedScope } from "../web-app";
export * from './local-cache';

ensureSharedScope();
const localFSCache = new LocalCache('fs', { maxSize: 1024 * 1024 * 1024 });
window.sharedScope.shared['localFSCache'] = localFSCache;

export function getLocalFSCache(): LocalCache {
  const cache = window.sharedScope.shared['localFSCache'];
  return cache;
}

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

export interface GetFileOptions {
  expires?: number;
  resize?: number;
}

export function create_download_link_from_file_path(abs_file: string, options: GetFileOptions = {}) {
  const url = new URL('/file/read', window.location.origin);
  url.searchParams.set('file', abs_file);
  if (options.expires !== undefined) {
    url.searchParams.set('param_expires', options.expires + '');
  }
  if (options.resize !== undefined) {
    url.searchParams.set('param_resize', options.resize + '');
  }
  return url.toString();
}

export async function file_stat(abs_file: string): Promise<FileStat> {
  let resp = await post('/file/stat', {
    file: abs_file,
  });
  return resp.data;
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

export function create_thumbnail_link(dir: string, file: string, size: number = 200) {
  const url = new URL('/file/read', window.location.origin);
  const file_path = path.join(dir, file);
  const dpr = window.devicePixelRatio || 1;
  size = dpr * size;
  url.searchParams.set('file', file_path);
  url.searchParams.set('param_resize', size.toString());
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

export interface ReadFileOptions extends GetFileOptions {
  localCache?: boolean,
  showProgressMessage?: boolean,
  allowStaled?: boolean,
}

export async function read_file(file: string, options: ReadFileOptions = {}): Promise<Blob> {
  const file_path = path.join(file);
  const filename = path.basename(file_path);
  if (options.localCache) {
    const cached = await localFSCache.get<Blob>(file);
    const checkStale = async () => {
      const meta = await localFSCache.getMeta(file);
      if (cached && meta) {
        const fileStat = await file_stat(file);
        if (fileStat.modified < meta.saved_at) {
          if (options.showProgressMessage) {
            systemMessage({ title: '已从本地缓存加载文件', content: `${filename}`, type: 'info', timeout: 3000 })
          }
          return cached;
        }
      }
    }
    if (options.allowStaled && cached) {
      checkStale().then(cached => {
        if (!cached) {
          getFile();
        }
      })
      return cached;
    } else {
      const cached = await checkStale();
      if (cached) {
        return cached;
      }
    }
  }
  const getFile = async () => {
    let body = {
      file: file_path,
      ...(options.resize ? { param_resize: options.resize } : {}),
    }
    const url = new URL('/file/read', window.location.origin);
    let resp = await post_raw(url.toString(), body, file);
    const chunks = [];
    let reader = resp.body?.getReader();
    let content: Blob = new Blob();
    const contentType = resp.headers.get('content-type') || '';
    const total = parseInt(resp.headers.get('content-length') || '0', 10);
    let loaded = 0;
    let handle;
    if (options.showProgressMessage) {
      handle = systemMessage({ title: '正在加载文件', content: `${filename}`, type: 'info', timeout: 0 })
    }
    while (reader && true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      loaded += value.byteLength;
      chunks.push(value);
      if (handle) {
        const percent = loaded / total;
        const percentStr = (percent * 100).toFixed(1) + '%';
        if (!handle.isClosed) {
          handle.setMessage({ title: '正在加载文件', content: `${filename}: ${percentStr}`, type: 'info', timeout: 0, progress: percent })
        }
      }
    }
    if (handle && !handle.isClosed) {
      handle.setMessage({ title: '加载完成', content: `${filename}`, type: 'info', timeout: 2000 })
    }
    content = new Blob(chunks, { type: contentType });
    if (options.localCache) {
      localFSCache.set(file_path, content);
    }
    return content;
  }
  return getFile();
}

export async function read_file_to_link(file: string, options: ReadFileOptions = {}): Promise<string> {
  const data = await read_file(file, options);
  const url = URL.createObjectURL(data);
  return url;
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
