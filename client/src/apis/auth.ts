import { getLocalFSCache } from "@webby/core/fs";
import { post } from "./utils";

export enum LoginStatus {
    Success = 'success',
    NeedOTPCode = 'needotp',
    Error = 'error',
}

export async function login(username: string, password: string, totpCode?: string) {
    let resp = await post('/auth/login', {
        name: username,
        password,
        otp_code: totpCode,
    });
    if (resp.status === 0) {
        return LoginStatus.Success;
    }
    if (resp.message.includes('otp error')) {
        return LoginStatus.NeedOTPCode;
    }
    return LoginStatus.Error;
}

export async function logout(cleanup = true) {
    let resp = await post('/auth/logout', {});
    if (resp.status === 0) {
        if (cleanup) {
            const localFSCache = getLocalFSCache();
            localFSCache.drop();
            localStorage.clear();
        }
        return true;
    }
    return false;
}

export async function resetPassword(oldPwd: string, newPwd: string) {
    let resp = await post('/auth/reset_password', {
        old_password: oldPwd,
        new_password: newPwd,
    });
    if (resp.status === 0) {
        return true;
    }
    return false;
}

export async function requestOneTimeToken(module_prefix = ""): Promise<string> {
    let resp = await post('/auth/request_one_time_token', { module_prefix });
    if (resp.status === 0) {
        return resp.data.token;
    }
    throw new Error(resp.message);
}
