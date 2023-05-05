import ReactDom from 'react-dom/client';
import { AppContext, AppInstallContext, defineApp } from '@webby/core/web-app';
import iconUrl from './icon.svg';
import { http } from '@webby/core/tunnel';
import { downloadLink } from '../../utils/download';
import { formatFileSize, makeDefaultTemplate } from '../../utils/formatter';
import Epub, { Rendition } from 'epubjs';
import style from './index.module.less';
import { KeyboardEvent, MouseEvent, WheelEvent, useEffect, useRef, useState } from 'react';
import { systemPrompt, systemSelectFile } from '@webby/core/system';
import { read_file } from '@webby/core/fs';
import { availableFonts } from '../../utils/fonts';
import Icon from '../../components/icon/icon';
import classNames from 'classnames';
import { Collection } from '@webby/core/kv-storage';
import { PopButton } from '../../components/button';
import { CachedEventEmitter } from '../../utils/events';
import path from 'path-browserify';

let reactRoot: ReactDom.Root;

const _store = new Collection('book-reader');

interface Config {
  font: string,
  fontSize: number,
  theme: 'dark' | 'warn' | 'light',
  file?: string,
  location?: string,
}

async function mount(ctx: AppContext) {
  const fonts = await availableFonts();
  const state = await _store.getReactiveState<Config>('config', { font: 'Arial', fontSize: 18, theme: 'dark' });

  ctx.onOpenFile(file => {
    eventBus.emit('open', file);
  });

  ctx.systemMenu.set([
    {
      name: '文件',
      children: [{
        name: '打开',
        async onClick() {
          const files = await systemSelectFile({ allowedExts: ['epub'] })
          if (files && files.length) {
            eventBus.emit('open', files[0]);
          }
        }
      }]
    },
    {
      name: '样式',
      children: [
        {
          name: '字体',
          children: fonts.map(f => {
            return {
              name: f,
              onClick(menu) {
                const parent = menu.parent();
                if (rendition) {
                  rendition.themes.font(f);
                  if (parent) {
                    parent.setName(`字体(${f})`);
                  }
                  menu.setChecked(true, true);
                }
              }
            }
          }),
        },
        {
          name: '字体大小',
          id: 'fontsize',
          children: [{
            name: '放大',
            onClick(menu) {
              if (rendition) {
                fontSize += 2;
                rendition.themes.fontSize(fontSize + 'px');
                menu.parent()!.name = `字体大小(${fontSize}px)`
                state.state.fontSize = fontSize;
              }
            }
          }, {
            name: '缩小',
            onClick(menu) {
              if (rendition) {
                fontSize -= 2;
                rendition.themes.fontSize(fontSize + 'px')
                menu.parent()!.name = `字体大小(${fontSize}px)`
                state.state.fontSize = fontSize;
              }
            }
          }]
        },
        {
          name: '主题',
          id: 'theme',
          children: [
            {
              name: '白色',
              id: 'light',
              onClick(menu) {
                if (rendition) {
                  rendition.themes.select('light');
                  state.state.theme = 'light';
                  menu.setChecked(true, true);
                }
              }
            },
            {
              name: '黑色',
              id: 'dark',
              onClick(menu) {
                if (rendition) {
                  rendition.themes.select('dark');
                  state.state.theme = 'dark';
                  menu.setChecked(true, true);
                }
              }
            },
            {
              name: '暖色',
              id: 'warm',
              onClick(menu) {
                if (rendition) {
                  rendition.themes.select('warm');
                  state.state.theme = 'warn';
                  menu.setChecked(true, true);
                }
              }
            }
          ]
        }
      ]
    },
    {
      name: '分页',
      children: [
        {
          name: '跳转',
          async onClick() {
            if (rendition) {
              const r = await systemPrompt({ title: '跳转到', records: [{ name: '页数', type: 'number' }] });
              const page = parseInt(r?.['页数'] || '0');
              rendition.display(page);
            }
          }
        }
      ]
    }
  ]);

  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />)


  interface Props {
    file?: string,
  }

  let rendition: Rendition;
  let fontSize = 16;

  const eventBus = new CachedEventEmitter();

  function Index(props: Props) {
    const [resoure, setResource] = useState<ArrayBuffer>();
    const containerRef = useRef<HTMLDivElement>(null);
    const maskRef = useRef<HTMLDivElement>(null);
    const [showMask, setShowMask] = useState(false);
    const [showNext, setShowNext] = useState(true);
    const [showPrev, setShowPrev] = useState(true);
    const [toc, setToc] = useState<TreeNode[]>([]);

    ctx.appWindow.onWindowResize((w, h) => {
      if (rendition) {
        rendition.resize(w, h);
      }
    });

    useEffect(() => {
      if (state.state.file) {
        eventBus.emit('open', state.state.file);
      }

      const open = async (file: string) => {
        if (file) {
          const p = path.parse(file).base;
          ctx.appWindow.setTitle(`Book - ${p}`);
          state.state.file = file;
          const r = await read_file(file, { localCache: true, showProgressMessage: true });
          const ab = await r.arrayBuffer();
          setResource(ab);
        }
      }
      eventBus.on('open', open);

      return () => eventBus.off('open', open);

    }, []);

    useEffect(() => {
      if (resoure && containerRef.current) {
        const book = Epub(resoure);
        rendition = book.renderTo(containerRef.current, {
          manager: "continuous", flow: "paginated", width: '100%', height: '100%'
        });
        console.log(book, rendition);
        rendition.themes.register("light", { "body": { "background-color": "#FFFFFF", "color": "#000000" }, 'p': { 'line-height': '160% !important' }, font: 'Arial' });
        rendition.themes.register("dark", { "body": { "background-color": "#1e1e1e", "color": "#D9D9D9" }, 'p': { 'line-height': '160% !important' }, font: 'Arial' });
        rendition.themes.register("warm", { "body": { "background-color": "#98b087", "color": "#333" }, 'p': { 'line-height': '160% !important' }, font: 'Arial' });

        const theme = state.state.theme;
        rendition.themes.select(theme);
        ctx.systemMenu.getById(theme)?.setChecked(true, true);

        const fontSize = state.state.fontSize;
        rendition.themes.fontSize(fontSize + 'px');
        ctx.systemMenu.getById('fontsize')!.name = `字体大小(${fontSize}px)`;

        rendition.on("relocated", function (location: any) {
          state.state.location = location.start?.cfi;

          if (location.atEnd) {
            setShowNext(false);
          } else {
            setShowNext(true);
          }

          if (location.atStart) {
            setShowPrev(false);
          } else {
            setShowPrev(true);
          }

        });

        const lastLocatioin = state.state.location;
        rendition.display(lastLocatioin || undefined).then(() => {
          focus();
          (rendition as any).manager.on('added', (e: any) => {
            const iframe = e.element?.firstElementChild;
            setTimeout(() => {
              iframe?.focus();
            }, 100);
          });
        });

        rendition.on('keydown', (e: KeyboardEvent) => {
          keydown(e);
        });

        book.loaded.navigation.then(function (toc) {

          const treeNodes: TreeNode[] = [];
          toc.forEach(t => {
            treeNodes.push(toc2Tree(t));
            return {};
          });
          setToc(treeNodes);
        });

        return () => {
          book.destroy();
          rendition.destroy();
        };
      }
    }, [resoure]);

    useEffect(() => {

      if (props.file) {
        eventBus.emit('open', props.file);
      }

    }, [props.file]);

    let pageChangeTimer: number | undefined;
    let curAnimation = '';
    const nextPage = async () => {
      let container = containerRef.current;
      if (container) {
        if (pageChangeTimer) {
          clearTimeout(pageChangeTimer);
        }
        if (curAnimation === 'prev') {
          rendition?.prev();
        } else if (curAnimation === 'next') {
          rendition?.next();
        }
        curAnimation = 'next';
        const views = [...container.querySelectorAll('.epub-view')] as HTMLDivElement[];
        const w = container.clientWidth;
        views.forEach((v: HTMLDivElement) => {
          v.style.transition = 'transform 0.3s cubic-bezier(0.230, 1.000, 0.320, 1.000)';
          v.style.transform = `translateX(-${w}px)`;
        });
        pageChangeTimer = window.setTimeout(() => {
          views.forEach((v: HTMLDivElement) => {
            v.style.transition = 'none';
            v.style.transform = 'translateX(0px)';
          });
          rendition?.next();
          pageChangeTimer = undefined;
          curAnimation = '';
        }, 300);
      }
    }

    const prevPage = async () => {
      let container = containerRef.current;
      if (container) {
        if (pageChangeTimer) {
          if (curAnimation === 'prev') {
            rendition?.prev();
          } else if (curAnimation === 'next') {
            rendition?.next();
          }
          clearTimeout(pageChangeTimer);
        }
        curAnimation = 'prev';
        const views = [...container.querySelectorAll('.epub-view')] as HTMLDivElement[];
        const w = container.clientWidth;
        views.forEach((v: HTMLDivElement) => {
          v.style.transition = 'transform 0.3s cubic-bezier(0.230, 1.000, 0.320, 1.000)';
          v.style.transform = `translateX(${w}px)`;
        });
        pageChangeTimer = window.setTimeout(() => {
          views.forEach((v: HTMLDivElement) => {
            v.style.transition = 'none';
            v.style.transform = 'translateX(0px)';
          });
          rendition?.prev();
          pageChangeTimer = undefined;
          curAnimation = '';
        }, 300);
      }
    }

    const jump = (target: string) => {
      if (rendition) {
        rendition.display(target);
      }
    }

    function focus() {
      if (containerRef.current) {
        const el = containerRef.current;
        setTimeout(() => {
          const iframe = el.querySelector('iframe');
          iframe?.focus();
        }, 100);
      }
    }

    const keydown = async (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        await nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        await prevPage();
      }
    }

    const mouseDown = (e: MouseEvent) => {
      setShowMask(false);
    };

    const mouseUp = (e: MouseEvent) => {
      setShowMask(true);
      focus();
    }

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        nextPage();
      } else if (e.deltaY < 0) {
        prevPage();
      }
    };

    return <div tabIndex={0} className={style.box}>
      {
        resoure ?
          <>
            {showPrev && <div className={classNames(style['btn'], style.left)} onClick={prevPage}><Icon size={25} className={style.icon} name="arrow-down"></Icon></div>}
            {showNext && <div className={classNames(style['btn'], style.right)} onClick={nextPage}><Icon size={25} className={style.icon} name="arrow-down"></Icon></div>}
            <div className={style['pop-btn']}>
              <PopButton width={35} height={35} button={<div style={{ fontSize: 12 }}>目录</div>} children={
                <div className={style.menu}>
                  {
                    toc.map(t => {
                      return <Tree key={t.title} isOpen={false} tree={t} onClick={t => jump(t.value)} />
                    })
                  }
                </div>
              } />
            </div>
            <div ref={containerRef} className={style.container}></div>
            <div
              style={{ display: showMask ? 'block' : 'none' }}
              // onWheel={onWheel}
              // onMouseDown={mouseDown}
              // onMouseUp={mouseUp}
              onKeyDown={keydown} tabIndex={0} ref={maskRef} className={style.mask}></div>
          </>
          : <OpenFile onSelectFile={file => {
            state.state.file = file;
          }} />
      }
    </div>
  }
}

function toc2Tree(toc: ePub.NavItem): TreeNode {
  const node: TreeNode = {
    title: toc.label,
    value: toc.href,
    children: [],
  };
  let children: TreeNode[] = [];
  toc.subitems?.forEach((v, i) => {
    children[i] = toc2Tree(v);
  });
  node.children = children;
  return node;
}

async function unmount() {
  if (reactRoot) {
    reactRoot.unmount();
  }
}

const defautTemplate = makeDefaultTemplate('未知');

async function installed(ctx: AppInstallContext) {
  let abort: AbortController | undefined = undefined;
  ctx.hooks.globalSearch.options.lazy = true;
  ctx.hooks.globalSearch.register(async ({ keyword: kw, cb }) => {
    if (!kw) return [];
    try {
      if (abort) {
        abort.abort();
      }
      abort = new AbortController();
      const resp = await http.fetch('https://worker.zlib.app/api/search/', {
        method: 'post',
        body: JSON.stringify({
          "keyword": kw,
          "page": 1,
          "sensitive": false
        }),
        signal: abort.signal,
        headers: {
          'content-type': 'application/json'
        },
      });
      const json = await resp.json();
      const result = json.data.map((r: any) => {
        return {
          isHtml: true,
          title: `<strong>${r.title}</strong>`,
          content: '',
          thumbnails: [r.cover],
          pre: defautTemplate`<div style="display: flex">
          <div>作者: ${r.author}\n年份: ${r.year}\n出版社: ${r.publisher}\n文件大小: ${r.filesize && formatFileSize(+r.filesize)}\n可下载: ${r.zlib_download ? '是' : '否'}</div></div>`,
          onClick() {
            if (r.zlib_download) {
              downloadLink(`https://worker.zlib.app/download/${r.id}`, 'true');
            }
          }
        }
      });
      cb(result);
    } catch (err) {
      cb([{
        title: `搜索发生错误: ${err}`,
      }]);
    } finally {
      abort = undefined;
    }
  });
}

interface TreeNode {
  title: string,
  value: string,
  children?: TreeNode[]
}

function Tree(props: { isOpen?: boolean, tree: TreeNode, onClick: (ol: TreeNode) => void }) {
  const [isOpen, setIsOpen] = useState(props.isOpen || false);
  return <div className={style['outline-tree']}>
    <div className={style['tree-title']}>
      {
        !!props.tree?.children?.length ? <Icon onClick={() => {
          setIsOpen(!isOpen)
        }} name='arrow-down' className={classNames(style.icon, { [style.open]: isOpen })} />
          : <span style={{ display: 'inline-block', width: 13 }}></span>
      }
      <span onClick={() => props.onClick(props.tree)}>{props.tree.title}</span>
    </div>
    <div className={style.subtree} style={{ height: isOpen ? 'auto' : 0 }}>
      {
        props.tree.children?.map((ol, idx) => {
          return <Tree key={idx} tree={ol} onClick={props.onClick} />
        })
      }
    </div>
  </div>
}


function OpenFile(props: { onSelectFile: (file: string) => void }) {
  return <div className={style['open-btn']} onClick={async () => {
    const file = await systemSelectFile({ allowedExts: ['epub'] });
    if (file && file.length) {
      props.onSelectFile(file[0]);
    }
  }}>Open File</div>;
}

defineApp({
  mount,
  unmount,
  installed,
  getAppInfo() {
    return {
      name: 'VNC Viewer',
      iconUrl,
      width: 500,
      height: 500,
      supportExts: ['epub'],
    }
  }
})
