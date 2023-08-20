import classNames from "classnames";
import { memo, MouseEventHandler, useEffect, useMemo, useRef, useState } from "react";
import classnames from 'classnames';
import { create_download_link, create_thumbnail_link, FileStat } from "@webby/core/fs";
import style from './image-viewer.module.less';
import { AppContext, AppWindow } from "@webby/core/web-app";
import { SmartImage } from "@webby/components";

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

function is_image(file: string) {
  return file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.jpg');
}

export default function ImagePreview({ appWindow, ctx, dir, files, file, onPreviewingChange }: {appWindow: AppWindow, ctx: AppContext,  dir: string, files: FileStat[], file: FileStat, onPreviewingChange?: (file: FileStat) => void }) {

  const pics = useMemo(() => files.filter(f => is_image(f.name)), [files]);
  const idx = useMemo(() => pics.findIndex(f => f.name === file.name), [pics, file]);
  const thumnailRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const imgScaleRef = useRef(1);
  const [show, showThumbnail] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(idx);
  const lastHighlightElRef = useRef<HTMLDivElement>();

  useEffect(() => {
    setCurrentIdx(idx);
  }, [idx]);

  const highlight = (el: HTMLDivElement) => {
    el.classList.add(style['highlight']);
    if (lastHighlightElRef.current) {
      lastHighlightElRef.current.classList.remove(style['highlight']);
    }
    lastHighlightElRef.current = el;
  }

  useEffect(() => {
    const scroll = (idx: number) => {
      if (!thumnailRef.current) return;
      const el = thumnailRef.current;
      const t = el.querySelector(`[data-idx="${idx}"]`) as HTMLDivElement;
      highlight(t);
    }

    const arrowPressed = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIdx((idx) => {
          if (idx > 0) {
            scroll(idx - 1);
            return idx - 1;
          } else {
            return idx;
          }
        });
      } else if (e.key === 'ArrowRight') {
        setCurrentIdx((idx) => {
          if (idx < pics.length - 1) {
            scroll(idx + 1);
            return idx + 1;
          } else {
            return idx;
          }
        });
      }
    };
    window.addEventListener('keydown', arrowPressed, false);
    return () => {
      window.removeEventListener('keydown', arrowPressed, false);
    };
    // eslint-disable-next-line
  }, [files, onPreviewingChange]);

  useEffect(() => {
    let timer: number | undefined;

    const onMove = (e: MouseEvent, target: any) => {
      const el = target as HTMLElement;
      if (!el.nodeType || el.nodeType !== document.ELEMENT_NODE) return;
      if (containerRef.current?.contains(el)) {
        showThumbnail(true);
        window.clearTimeout(timer);
        if (thumnailRef.current?.contains(el)) return;
        timer = window.setTimeout(() => {
          if (containerRef.current) {
            showThumbnail(false);
          }
        }, 2000);
      }
    }
    if (!containerRef.current) return;
    const onMoveDebounced = debounce(onMove, 100, (e) => e.composedPath()[0]);
    window.addEventListener('mousemove', onMoveDebounced, false);
    return () => {
      window.removeEventListener('mousemove', onMoveDebounced, false);
    }
  }, []);

  useEffect(() => {
    onPreviewingChange?.(pics[currentIdx]);
    // eslint-disable-next-line
  }, [onPreviewingChange, currentIdx]);

  const filename = currentIdx === -1 ? file.name : pics[currentIdx].name
  const currentSrc = create_download_link(dir, filename);
  appWindow.setTitle(`Image - ${filename}`);
  const clickThumbnail: MouseEventHandler<HTMLDivElement> = (e) => {
    let el = e.target as HTMLDivElement | null;
    while (el && !el?.dataset?.idx) {
      el = el.parentElement as HTMLDivElement;
    }
    if (el?.dataset?.idx) {
      const idx = parseInt(el.dataset.idx);
      setCurrentIdx(idx);
      highlight(el);
    }
  };

  useEffect(() => {
    if (!thumnailRef.current) return;
    const el = thumnailRef.current;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const dy = e.deltaY;
      el.scrollLeft += dy;
    };
    el.addEventListener('wheel', onWheel, false);
    return () => {
      el.removeEventListener('wheel', onWheel, false);
    }
  }, []);

  const _translate = useRef([0, 0]);
  useEffect(() => {
    const translate = _translate.current;
    if (!imgRef.current || !containerRef.current) return;

    const el = imgRef.current;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!imgRef.current || !containerRef.current) return;
      crect = containerRef.current.getBoundingClientRect();
      irect = imgRef.current.getBoundingClientRect();
      maxWidth = (crect.width + irect.width) / 2;
      maxHeight = (crect.height + irect.height) / 2;
      imgScaleRef.current -= e.deltaY / 30;
      if (imgScaleRef.current < 0.8) imgScaleRef.current = 0.8;
      if (imgScaleRef.current > 5) imgScaleRef.current = 5;
      const scale = imgScaleRef.current;
      const residual = 200;
      if (translate[0] * scale < -maxWidth + residual) {
        translate[0] = (-maxWidth + residual) / scale;
      } else if (translate[0] * scale > maxWidth - residual) {
        translate[0] = (maxWidth - residual) / scale;
      }
      el.style.transform = `scale(${imgScaleRef.current}) translate(${translate[0]}px, ${translate[1]}px)`;
    };

    let isMouseDown = false;
    let translateStart = [0, 0];
    const containerEl = containerRef.current;
    let crect = containerEl.getBoundingClientRect();
    let irect = imgRef.current.getBoundingClientRect();
    let maxWidth = (crect.width + irect.width) / 2;
    let maxHeight = (crect.height + irect.height) / 2;

    const onMouseDown = (e: MouseEvent) => {
      if (!imgRef.current || !containerRef.current) return;
      crect = containerRef.current.getBoundingClientRect();
      irect = imgRef.current.getBoundingClientRect();
      maxWidth = (crect.width + irect.width) / 2;
      maxHeight = (crect.height + irect.height) / 2;
      isMouseDown = true;
      translateStart = [e.clientX, e.clientY];
    }
    const onMouseUp = () => {
      isMouseDown = false;
      translate[0] += moveX;
      translate[1] += moveY;
    }
    let moveX = 0;
    let moveY = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const scale = imgScaleRef.current;
      const [currentX, currentY] = [e.clientX, e.clientY];
      moveX = currentX - translateStart[0];
      moveY = currentY - translateStart[1];
      let nextX = (translate[0] + moveX);
      let nextY = (translate[1] + moveY);
      const residual = 200;
      if (nextX * scale < -maxWidth + residual) {
        nextX = (-maxWidth + residual) / scale;
      } else if (nextX * scale > maxWidth - residual) {
        nextX = (maxWidth - residual) / scale;
      }
      moveX = nextX - translate[0];

      if (nextY * scale < -maxHeight + residual) {
        nextY = (-maxHeight + residual) / scale;
      } else if (nextY * scale > maxHeight - residual) {
        nextY = (maxHeight - residual) / scale;
      }
      moveY = nextY - translate[1];

      el.style.transform = `scale(${scale}) translate(${nextX}px, ${nextY}px)`;
    };
    containerEl.addEventListener('mousedown', onMouseDown, false);
    containerEl.addEventListener('mouseup', onMouseUp, false);
    containerEl.addEventListener('mousemove', onMouseMove, false);

    el.addEventListener('wheel', onWheel, false);
    return () => {
      containerEl.removeEventListener('mousedown', onMouseDown, false);
      containerEl.removeEventListener('mouseup', onMouseUp, false);
      containerEl.removeEventListener('mousemove', onMouseMove, false);
      el.removeEventListener('wheel', onWheel, false);
    }
  }, []);

  useEffect(() => {
    if (!imgRef.current || !_translate.current) return;
    imgScaleRef.current = 1;
    _translate.current[0] = 0;
    _translate.current[1] = 0;
    imgRef.current.style.transform = 'scale(1)';
  }, [currentIdx]);

  const onImageLoaded = (e: React.SyntheticEvent) => {
    const el = e.target as HTMLElement;
    if (el?.tagName.toLowerCase() === 'img') {
      el.style.width = 'auto';
    }
  }

  return <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', height: '100%' }} ref={containerRef}>
    <img draggable="false" loading="lazy" style={{ transition: 'transform 0.08s', maxWidth: '100%', height: 'auto', objectFit: 'contain', minHeight: 200 }} src={currentSrc} alt={currentSrc} ref={imgRef} />
    <div onLoad={onImageLoaded} onClick={clickThumbnail} className={classNames({ [style['show']]: show }, style['image-thumbnails'], style['scrollbar'])} ref={thumnailRef}>
      <Thumbnails pics={pics} dir={dir} />
    </div>
  </ div>
}

const Thumbnails = memo(({ pics, dir }: { pics: FileStat[], dir: string }) => {
  const createLink = create_thumbnail_link;
  return <>
    {
      pics.map((p, idx) => {
        return <div key={p.name} data-idx={idx} className={classnames(style.thumbnail)}>
          <SmartImage src={createLink(dir, p.name)} alt="" />
        </div>
      })
    }
  </>
});
