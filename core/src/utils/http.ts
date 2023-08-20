import axios, { AxiosProgressEvent } from 'axios';

export interface Response {
  status: 0 | 1,
  data: any,
  message: string,
}

const httpGroupHandlers = new Map<string, [AbortController, Promise<globalThis.Response>]>();

export function getCsrfToken() {
  const csrfToken = window.document.cookie.match(/csrf_token=(.+?)($|,)/)?.[1];
  return csrfToken;
}

export async function post(api: string, body: any, tag = 'default') {
  const resp = await post_raw(api, body, tag).then(resp => resp.json() as Promise<Response>);
  if (resp.status !== 0) {
    throw new Error(resp.message);
  }
  return resp;
}

// unique request by tag
export async function post_raw(
  api: string,
  body: any,
  tag: string = 'default',
) {
  const handlers = httpGroupHandlers.get(tag);
  if (handlers) {
    return handlers[1].then((resp) => resp.clone());
  }
  const abort = new AbortController();
  const p = fetch(api, {
    method: 'post',
    signal: abort.signal,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'csrf-token': getCsrfToken() || '',
    }
  });
  httpGroupHandlers.set(tag, [abort, p]);
  const resp = await p;
  httpGroupHandlers.delete(tag);
  return resp.clone();
}

export async function post_formdata(api: string, body: FormData, onUploadProgress?: (e: AxiosProgressEvent) => void) {
  const resp = await axios.postForm(api, body, { headers: { 'csrf-token': getCsrfToken() || '', }, responseType: 'json', onUploadProgress });
  return resp.data;
}

export async function inner_fetch(input: RequestInfo | URL, init?: RequestInit): Promise<globalThis.Response> {
  const innerInit = init || {};

  innerInit.headers = innerInit.headers || {};
  (innerInit.headers as any)['csrf-token'] = getCsrfToken() || ''

  const p = fetch(input, init);
  return p;
}

(window as any).__post = post;