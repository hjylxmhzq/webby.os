import { AppContext, AppInfo } from '@webby/core/web-app';
import { Shell } from '@webby/core/shell';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
// import { WebglAddon } from 'xterm-addon-webgl';
import { CanvasAddon } from 'xterm-addon-canvas';
import 'xterm/css/xterm.css';
import style from './index.module.less';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';

function debounce<T extends Function>(fn: T, delay = 500, mw?: (...args: any[]) => any) {
  let timer: number | undefined;
  return (...args: any[]) => {
    let v: any;
    if (mw) {
      v = mw(...args);
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...args, v);
    }, delay);
  }
}
let store = new Collection('shell_cache');
let shell: Shell;
export async function mount(ctx: AppContext) {

  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  root.style.backgroundColor = 'black';
  const xtermEl = document.createElement('div');
  xtermEl.style.textAlign = 'left';
  xtermEl.style.inset = '0';
  xtermEl.style.left = '10px';
  xtermEl.style.position = 'absolute';
  xtermEl.classList.add(style.container);


  root.appendChild(xtermEl);

  const xterm = new Terminal({
    fontSize: 14,
    fontFamily: 'Ubuntu Mono, courier-new, courier, monospace',
    // lineHeight: 1.2,
  });
  const fitAddon = new FitAddon();

  setTimeout(() => {
    xterm.open(xtermEl);
    fitAddon.fit();
  }, 300);

  xterm.loadAddon(new CanvasAddon());
  xterm.loadAddon(fitAddon);


  fitAddon.fit();

  xterm.onResize(debounce(({ cols, rows }: { cols: number, rows: number }) => {
    shell.setSize(cols, rows);
  }));

  ctx.appWindow.onWindowResize(() => {
    fitAddon.fit();
  });
  shell = new Shell();

  shell.onClose(() => {
    xterm.write('\n\rconnection is closed');
  });
  // const term = new Term(xterm);

  let cache: string[] = [];

  store.get<string>('history').then(v => {
    if (v) {
      xterm.write(v);
      xterm.write('\n\r已从上次会话恢复\n\r');
    }
  });

  xterm.onData(function (key) {

    // console.log(keyCode, JSON.stringify(key));
    shell.write(key);
    // if (keyCode === 'Backspace') {
    //   term.back();
    // } else if (keyCode === "ArrowUp") {
    //   term.up();
    // } else if (keyCode === "ArrowDown") {
    //   term.down()
    // } else if (keyCode === "ArrowLeft") {
    //   term.left();
    // } else if (keyCode === "ArrowRight") {
    //   term.right()
    // } else if (keyCode === "Enter") {
    //   term.enter();
    // } else {
    //   // term.write(key);
    // }
  });

  function writeHisotry(text: string) {
    cache.push(text);
    if (cache.length > 100) {
      cache = cache.slice(-100);
    }
  }

  function saveHistory() {
    store.set('history', cache.join(''));
  }

  const debounceSave = debounce(saveHistory, 3000);

  shell.onStdOut(text => {
    writeHisotry(text);
    debounceSave();
    xterm.write(text);
  });
  shell.onStdErr(text => {
    writeHisotry(text);
    debounceSave();
    xterm.write(text);
  });
  (document as any)._fit = fitAddon;
}

export async function unmount(ctx: AppContext) {
  store.remove('history');
  shell.close();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Baidu',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: ['txt', 'json', 'md', 'toml', 'js', 'py', 'ts'],
  }
}


class Term {
  history: string[] = [];
  cursor = 0;
  currentLine = '';
  offset = 0;
  constructor(public term: Terminal, public promptText = '') {
  }
  clearLine() {
    let tLen = this.currentLine.length + this.promptText.length;
    this.term.write('\b'.repeat(tLen));
    this.term.write(' '.repeat(tLen));
    this.term.write('\b'.repeat(tLen));
  }
  promtp(newLine = true) {
    if (newLine) {
      this.term.write('\n\r');
    }
    this.term.write(this.promptText);
  }
  up() {
    if (this.history[this.cursor - 1]) {
      this.clearLine();
      this.promtp(false);
      this.term.write(this.history[this.cursor - 1]);
      this.currentLine = this.history[this.cursor - 1];
      this.offset = this.currentLine.length;
      this.cursor -= 1;
    }
  }
  down() {
    if (this.cursor + 1 === this.history.length) {
      this.cursor += 1;
      this.clearLine();
      this.promtp(false);
      this.currentLine = '';
      this.offset = 0;
    }
    if (this.history[this.cursor + 1]) {
      this.clearLine();
      this.promtp(false);
      this.term.write(this.history[this.cursor + 1]);
      this.currentLine = this.history[this.cursor + 1];
      this.cursor += 1;
      this.offset = this.currentLine.length;
    }
  }
  left() {
    if (this.offset === 0) return;
    this.offset--;
    this.term.write('\u001b[D');
  }
  right() {
    if (this.offset >= this.currentLine.length) return;
    this.offset++;
    this.term.write('\u001b[C');
  }
  write(text: string) {
    this.currentLine += text;
    this.offset += text.length;
    this.term.write(text);
  }
  write_raw(text: string) {
    this.term.write(text);
    this.promtp(false);
    this.offset = 0;
  }
  back() {
    if (this.currentLine.length) {
      this.currentLine = this.currentLine.slice(0, -1);
      this.term.write('\b  \b\b');
    }
  }
  enter() {
    this.history.push(this.currentLine);
    this.cursor = this.history.length;
    this.currentLine = '';
    this.offset = 0;
    this.promtp();
  }
}