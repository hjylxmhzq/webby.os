declare module '*.module.less' {
  const classes: { [className: string]: string };
  export default classes;
}

declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.ico' {
  const url: string;
  export default url;
}
