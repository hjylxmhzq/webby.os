declare module "*.module.less" {
  const classes: {[key: string]: string};
  export default classes;
}

declare module "*.svg" {
  const img: string;
  export default img;
}
