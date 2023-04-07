import { post } from "../utils/http";

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

export interface UserInfo {
    username: string,
    user_root: string,
    group_name: string,
}

export async function getAllUsers(): Promise<UserInfo[]> {
    let resp = await post('/auth/get_all_users', {});
    if (resp.status === 0) {
        return resp.data;
    }
    return [];
}

export interface GroupInfo {
    name: string,
    desc: string,
    permissions: string,
}

export async function getAllGroups(): Promise<GroupInfo[]> {
    let resp = await post('/auth/get_all_groups', {});
    if (resp.status === 0) {
        return resp.data;
    }
    return [];
}

export async function addUser(user: {
    username: string,
    password: string,
    email: string,
    group: string,
}): Promise<boolean> {
    let resp = await post('/auth/register', user);
    if (resp.status === 0) {
        return true;
    }
    return false;
}

export async function deleteUser(user: {
    username: string,
}): Promise<boolean> {
    let resp = await post('/auth/delete_user', user);
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
