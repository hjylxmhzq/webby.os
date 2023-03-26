import { AppsRegister } from "src/utils/micro-app";

export declare global {
  interface Window {
    apps: AppsRegister,
  }
}
