import { FilterXSS, whiteList } from "xss";

whiteList.div?.push('style');
whiteList.img?.push('style');
const filter = new FilterXSS({
  whiteList: whiteList,
});
export function xssFilter(html: string) {
  return filter.process(html);
}