"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCsrfToken = exports.fetch = void 0;
const xHeaderPrefix = 'x-header-';
function fetch(url, init) {
    return __awaiter(this, void 0, void 0, function* () {
        let headers = (init === null || init === void 0 ? void 0 : init.headers) || {};
        let newHeader = {};
        if (headers) {
            if (typeof headers.forEach === 'function') {
                let newHeader = {};
                headers.forEach((v) => {
                    newHeader[xHeaderPrefix + v[0]] = v[1];
                });
            }
            else if (Array.isArray(headers)) {
                headers.forEach(([k, v]) => {
                    newHeader[xHeaderPrefix + k] = v;
                });
            }
            else {
                Object.entries(headers).forEach(([k, v]) => {
                    newHeader[xHeaderPrefix + k] = v;
                });
            }
        }
        if (init === null || init === void 0 ? void 0 : init.keepResponseHeaders) {
            newHeader['x-keep-resp'] = init.keepResponseHeaders.join(',');
        }
        newHeader['csrf_token'] = getCsrfToken() || '';
        newHeader['target-url'] = url.toString();
        let newInit = init;
        if (newInit) {
            newInit.headers = newHeader;
        }
        else {
            newInit = {
                headers: newHeader,
            };
        }
        const resp = yield window.fetch('/tunnel/http', newInit);
        const proxyResp = new Proxy(resp, {
            get(resp, key) {
                if (key === 'headers') {
                    function getHeader(name) {
                        return resp.headers.get(xHeaderPrefix + name);
                    }
                    return {
                        get: getHeader,
                    };
                }
                else {
                    if (typeof resp[key] === 'function') {
                        return resp[key].bind(resp);
                    }
                    return resp[key];
                }
            }
        });
        return proxyResp;
    });
}
exports.fetch = fetch;
function getCsrfToken() {
    var _a;
    const csrfToken = (_a = window.document.cookie.match(/csrf_token=(.+?)($|,)/)) === null || _a === void 0 ? void 0 : _a[1];
    return csrfToken;
}
exports.getCsrfToken = getCsrfToken;
