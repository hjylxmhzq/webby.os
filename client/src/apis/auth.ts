import { post } from "./utils";

export async function login(username: string, password: string) {
    let resp = await post('/auth/login', {
        name: username, password,
    });
    if (resp.status === 0) {
        return true;
    }
    return false;
}

export async function logout() {
    let resp = await post('/auth/logout', {});
    if (resp.status === 0) {
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
