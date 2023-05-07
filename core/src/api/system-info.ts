import { post } from "../utils/http"

export type IpAddr = { V6: string } | { V4: string } | { Unsupported: string } | null

export interface SystemInfo {
  "mounts"?:
  {
    "files": number,
    "files_total": number,
    "files_avail": number,
    "free": string,
    "avail": string,
    "total": string,
    "name_max": number,
    "fs_type": string,
    "fs_mounted_from": string,
    "fs_mounted_on": string
  }[]
  ,
  "networks"?: {
    [deviceName: string]: {
      name: string,
      addrs: { addr: IpAddr, netmask: IpAddr }[]
    }
  },
  "memory"?: {
    "total": string,
    "free": string,
    "platform_memory": {
      "total": string,
      "active": string,
      "inactive": string,
      "wired": string,
      "free": string,
      "purgeable": string,
      "speculative": string,
      "compressor": string,
      "throttled": string,
      "external": string,
      "internal": string,
      "uncompressed_in_compressor": string
    }
  },
  "swap"?: {
    "total": string,
    "free": string,
    "platform_swap": {
      "total": string,
      "avail": string,
      "used": string,
      "pagesize": string,
      "encrypted": true
    }
  },
  "socket_stats"?: any
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const resp = await post('/system_info/all', {});
  return resp.data;
}