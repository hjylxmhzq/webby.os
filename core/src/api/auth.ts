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

export interface SessionState {
    key: string,
    ttl: number,
    state: {
        user: {
            username: string,
            is_login: boolean,
            last_login: number,
            user_root: string,
            ip: string,
        }
    }
}

export async function getSessionState() {
    let resp = await post('/auth/get_session_state', {});
    if (resp.status === 0) {
        const data = resp.data;
        const sessions = Object.entries(data).map(([key, d]: any) => {
            let user = {};
            try {
                user = JSON.parse(d.state.user)
            } catch (err) {
                console.error(err);
            }
            return {
                key,
                ttl: d.ttl,
                state: {
                    user,
                },
            } as SessionState;
        }).filter(s => !!s.state.user.username);
        return sessions;
    }
    return null;
}

export async function deleteSessionState(key: string) {
    let resp = await post('/auth/delete_session_state', { key });
    if (resp.status === 0) {
        const data = resp.data;
        const sessions = Object.values(data).map((d: any) => {
            let user = {};
            try {
                user = JSON.parse(d.state.user)
            } catch (err) {
                console.error(err);
            }
            return {
                ttl: d.ttl,
                state: {
                    user,
                },
            } as SessionState;
        }).filter(s => !!s.state.user.username);
        return sessions;
    }
    return null;
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

export async function enableOtp(secret: string, code: string): Promise<boolean> {
    let resp = await post('/auth/enable_otp', { secret, code });
    if (resp.status === 0) {
        return resp.data;
    }
    return false;
}

export async function disableOtp(): Promise<boolean> {
    let resp = await post('/auth/disable_otp', {});
    if (resp.status === 0) {
        return resp.data;
    }
    return false;
}

export async function isOtpEnabled(): Promise<boolean> {
    let resp = await post('/auth/is_otp_enabled', {});
    if (resp.status === 0) {
        return resp.data;
    }
    return false;
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
