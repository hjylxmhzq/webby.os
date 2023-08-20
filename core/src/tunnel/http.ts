const xHeaderPrefix = 'x-header-';

interface ExtraInit {
  keepResponseHeaders?: string[];
}

export async function fetch(url: RequestInfo | URL, init?: RequestInit & ExtraInit) {
  const headers = init?.headers || {};
  const newHeader: Record<string, string> = {};
  if (headers) {
    if (typeof headers.forEach === 'function') {
      const newHeader: Record<string, string> = {};
      headers.forEach((v) => {
        newHeader[xHeaderPrefix + v[0]] = v[1];
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([k, v]) => {
        newHeader[xHeaderPrefix + k] = v;
      });
    } else {
      Object.entries(headers).forEach(([k, v]) => {
        newHeader[xHeaderPrefix + k] = v;
      });
    }
  }
  if (init?.keepResponseHeaders) {
    newHeader['x-keep-resp'] = init.keepResponseHeaders.join(',');
  }
  newHeader['csrf-token'] = getCsrfToken() || '';
  newHeader['target-url'] = url.toString();
  let newInit = init;
  if (newInit) {
    newInit.headers = newHeader;
  } else {
    newInit = {
      headers: newHeader,
    }
  }

  const resp = await window.fetch('/tunnel/http', newInit);

  const proxyResp = new Proxy(resp, {
    get(resp, key: keyof Response) {
      if (key === 'headers') {
        const getHeader = (name: string) => {
          return resp.headers.get(xHeaderPrefix + name);
        }
        return {
          get: getHeader,
        }
      } else {
        const d = resp[key]
        if (typeof d === 'function') {
          return d.bind(resp)
        }
        return d;
      }
    }
  });
  return proxyResp;
}

export function getCsrfToken() {
  const csrfToken = window.document.cookie.match(/csrf_token=(.+?)($|,)/)?.[1];
  return csrfToken;
}