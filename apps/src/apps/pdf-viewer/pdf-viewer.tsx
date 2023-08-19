import { getDocument, GlobalWorkerOptions, PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, renderTextLayer } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import style from './pdf-viewer.module.less';
import { read_file } from '@webby/core/fs';
import { debounceThrottle, PromiseValue } from './utils';
import Icon from '../../components/icon';
import classNames from 'classnames';
import { systemPrompt } from '@webby/core/system';
import { VirtualScrollbar } from '@webby/components';

const MORE_PAGE = 10;

type Outline = PromiseValue<ReturnType<PDFDocumentProxy['getOutline']>>[0];

const VIEWPORT_WIDTH = 1000;

export default function PdfViewer(props: {
  onResize: (w: number) => void;
  onScroll: (st: number) => void;
  onLoaded: (el: HTMLDivElement) => void;
  width: number;
  file: string;
  pageIdx: number;
}) {
  GlobalWorkerOptions.workerSrc = '/apps/pdf-viewer/pdf.worker.min.js';
  const CMAP_URL = '/apps/pdf-viewer/cmaps/';

  const canvasRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const [totalHeight, setTotalHeight] = useState<number>(0);
  const [canvasNum, setCanvasNum] = useState<number>(0);
  const [canvasList, setCanvasList] = useState<HTMLCanvasElement[]>([]);
  const [textDivList, setTextDivList] = useState<HTMLDivElement[]>([]);
  const [outline, setOutline] = useState<Outline>();
  const [currentPdf, setCurrentPdf] = useState<PDFDocumentProxy>();
  const cacheCanvasList = useRef<HTMLCanvasElement[]>([]);
  const currentPageIdx = useRef(0);
  const [currentPage, setCurrentPage] = useState(0);
  const isWaiting = useRef(false);
  const [isShowOutline, setIsShowOutline] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clientWidth, setClientWidth] = useState(VIEWPORT_WIDTH);
  const [invertColor, setInvertColor] = useState(false);
  const pageIdxBeforeZoom = useRef(-1);
  const [percent, setPercent] = useState('');
  const [viewportScale, setViewportScale] = useState(1);
  const viewportScaleRef = useRef(viewportScale);
  viewportScaleRef.current = viewportScale;
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(VIEWPORT_WIDTH);
  const [viewportPadding, setViewportPadding] = useState(0);

  useEffect(() => {
    // setViewportWidthByPercent(1);
  }, [props.width]);

  function zoomIn() {
    setIsAutoFit(false);
    const w = viewportScale * VIEWPORT_WIDTH;
    let cw = w - 100;
    cw = cw < 100 ? 100 : cw;
    setViewportWidth(cw);
    props.onResize(cw);
  }

  function zoomOut() {
    const el = containerRef.current;
    if (!el) return;
    setIsAutoFit(false);
    const w = viewportScale * VIEWPORT_WIDTH;
    let cw = w + 100;
    const clientWidth = el.clientWidth;
    if (cw > clientWidth) {
      cw = clientWidth;
      setIsAutoFit(true);
    }
    setViewportWidth(cw);
    props.onResize(cw);
  }

  function zoomPercent(percent: number) {
    setIsAutoFit(false);
    setViewportWidthByPercent(percent);
  }

  function zoomFit() {
    setIsAutoFit(true);
    setViewportWidthByPercent(1);
    const width = containerRef.current?.getBoundingClientRect().width;
    props.onResize(width || 100);
  }

  useEffect(() => {
    if (!props.file) return;

    const pages: PDFPageProxy[] = [];
    let loadingTask: PDFDocumentLoadingTask;
    let stop = false;
    (async () => {
      const file = await read_file(props.file, { localCache: true, showProgressMessage: true });
      if (stop) return;
      loadingTask = getDocument({
        data: await file.arrayBuffer(),
        cMapUrl: CMAP_URL,
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;
      setCurrentPdf(pdf);
      const numPages = pdf.numPages;

      for (let i = 0; i < numPages; i++) {
        const page = await pdf.getPage(i + 1);
        pages.push(page);
      }
      const outline = await pdf.getOutline();
      setOutline(outline?.[0]);
      setPages(pages);
    })();

    return () => {
      stop = true;
      loadingTask?.destroy();
    };
  }, [props.file]);

  useEffect(() => {
    const heights: number[] = [];
    let totalHeight = 0;
    for (const page of pages) {
      const viewport = page.getViewport({ scale: 1 });
      const ratio = viewport.height / viewport.width;
      const height = clientWidth * ratio;
      heights.push(height);
      totalHeight += height;
    }
    setTotalHeight(totalHeight);
    setHeights(heights);
    const c = box.current;
    if (!c) return;
    const count = Math.ceil(viewportHeight / heights[0]) + MORE_PAGE;
    const cvsNum = heights.length >= count ? count : heights.length;
    setCanvasNum(cvsNum);
    const el = canvasRef.current;
    if (!el) return;
  }, [pages, clientWidth]);

  useEffect(() => {
    if (canvasRef.current) {
      const cvss = canvasRef.current.querySelectorAll('canvas');
      const divs = canvasRef.current.querySelector('div')?.children;
      if (!cvss || !divs) return;
      cacheCanvasList.current = [];
      for (let i = 0; i < cvss.length; i++) {
        cacheCanvasList.current.push(document.createElement('canvas'));
      }
      setTextDivList(Array.from(divs) as HTMLDivElement[]);
      setCanvasList(Array.from(cvss) as HTMLCanvasElement[]);
      currentPageIdx.current = -1;
      canvasRef.current.scrollTop = 0;
    }
  }, [heights, canvasNum]);

  useEffect(() => {
    if (pageIdxBeforeZoom.current !== -1 && box.current) {
      box.current.scrollTop = calScrollTop(pageIdxBeforeZoom.current);
      pageIdxBeforeZoom.current = -1;
    } else {
      _onScroll(true).then(() => {
        if (box.current) {
          props.onLoaded(box.current!);
        }
      });
    }
  }, [canvasList]);

  function setViewportWidth(width: number) {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const { width: w, height } = rect;
    const ratio = height / width;
    setPercent(Math.floor((width / w) * 100) + '%');
    setViewportHeight(ratio * VIEWPORT_WIDTH);
    setViewportScale(width / VIEWPORT_WIDTH);
    setViewportPadding((w - width) / 2);
  }

  function setViewportWidthByPercent(percent: number) {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const { width } = rect;
    const w = width * percent;
    setViewportWidth(w);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const ob = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const viewportWidth = viewportScaleRef.current * VIEWPORT_WIDTH;
      const ratio = height / viewportWidth;
      if (!isAutoFit) {
        const padding = (width - viewportWidth) / 2;
        if (padding <= 0) {
          setIsAutoFit(true);
          return;
        }
        setViewportPadding(padding);
        setViewportHeight(ratio * VIEWPORT_WIDTH);
        return;
      }
      setViewportHeight(ratio * VIEWPORT_WIDTH);
      setViewportScale(width / VIEWPORT_WIDTH);
    });
    ob.observe(containerRef.current);

    if (isAutoFit) {
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();
      const { width } = rect;
      setViewportWidth(width);
      setViewportPadding(0);
      setPercent('100%');
    }

    return () => {
      ob.disconnect();
    };
  }, [isAutoFit]);

  const _onScroll = async (force = false) => {
    const cvsEl = canvasRef.current;
    if (!cvsEl) return;
    if (!force && box.current) {
      props.onScroll(box.current.scrollTop);
    }
    const cvsList = canvasList;
    const cvsCount = cvsList.length;
    const st = box.current?.scrollTop || 0;
    let sumHeight = 0;
    let paddingTop = 0;
    let paddingBottom = 0;
    let startPageIdx = 0;
    let endPageIdx = 0;
    for (let i = 0; i < heights.length - (cvsCount - 1); i++) {
      const h = heights[i];
      if (sumHeight + h >= st) {
        break;
      }
      paddingTop = sumHeight;
      startPageIdx += 1;
      sumHeight += h;
    }
    const lastPageIdx = currentPageIdx.current;
    setCurrentPage(startPageIdx);
    if (!force && lastPageIdx !== -1 && (startPageIdx === lastPageIdx || (startPageIdx >= lastPageIdx && startPageIdx < lastPageIdx + ((MORE_PAGE / 2) >> 0))))
      return;
    currentPageIdx.current = startPageIdx;

    endPageIdx = startPageIdx + (cvsCount - 1);
    let startHeight = paddingTop;
    for (let i = startPageIdx; i <= endPageIdx; i++) {
      startHeight += heights[i];
    }

    paddingBottom = totalHeight - startHeight;
    // console.log(`idx: ${startPageIdx}-${endPageIdx}\npadding: ${paddingTop}-${paddingBottom}\nsumHeight: ${sumHeight}`);

    const renderTasks: Promise<void>[] = [];
    for (let i = startPageIdx; i <= endPageIdx; i++) {
      const cacheCanvas = cacheCanvasList.current[i - startPageIdx];
      const textDiv = textDivList[i - startPageIdx];

      if (!cacheCanvas) return;
      const context = cacheCanvas.getContext('2d');
      if (!context) return;

      const page = pages[i]; // 需要渲染的页面索引
      if (!page) return;

      const viewport = page.getViewport({ scale: 1.5 });
      // Support HiDPI-screens.
      const outputScale = window.devicePixelRatio || 1;

      cacheCanvas.width = Math.floor(viewport.width * outputScale);
      cacheCanvas.height = Math.floor(viewport.height * outputScale);
      cacheCanvas.style.width = clientWidth + 'px';
      cacheCanvas.style.height = heights[i] + 'px';
      textDiv.style.width = clientWidth + 'px';
      textDiv.style.height = heights[i] + 'px';
      const scaleFactor = clientWidth / viewport.width;
      textDiv.style.setProperty('--scale-factor', scaleFactor * 1.5 + '');

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport,
      };
      isWaiting.current = true;
      textDiv.innerHTML = '';
      const task = page.render(renderContext);
      const textTask = page.getTextContent().then((textContent) => {
        const task = renderTextLayer({
          textContentSource: textContent,
          container: textDiv,
          viewport: viewport,
          textDivs: [],
          isOffscreenCanvasSupported: true,
        });
        return task.promise;
      });
      renderTasks.push(task.promise, textTask);
    }
    await Promise.all(renderTasks);

    for (let i = 0; i < canvasList.length; i++) {
      const canvas = canvasList[i];
      const cacheCanvas = cacheCanvasList.current[i];
      canvas.width = cacheCanvas.width;
      canvas.height = cacheCanvas.height;
      canvas.style.width = cacheCanvas.style.width;
      canvas.style.height = cacheCanvas.style.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(cacheCanvas, 0, 0);
    }
    cvsEl.style.marginTop = paddingTop + 'px';
    cvsEl.style.marginBottom = paddingBottom + 'px';
  };
  const onScroll = useCallback(
    debounceThrottle(() => _onScroll(false), 500),
    [heights, canvasList],
  );

  const box = useRef<HTMLDivElement | null>();

  function calScrollTop(pageIdx: number) {
    let h = 0;
    for (let i = 0; i < pageIdx; i++) {
      h += heights[pageIdx];
    }
    return h;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function calPageIdx(scrollTop: number) {
    let h = 0;
    for (let i = 0; i < heights.length; i++) {
      h += heights[i];
      if (h > scrollTop) {
        return i;
      }
    }
    return heights.length - 1;
  }

  const onClickOutline = useCallback(
    async (ol: Outline) => {
      if (!currentPdf) return;
      const d = ol.dest;
      let pageIdx = -1;
      if (Array.isArray(d) && d.length > 0) {
        pageIdx = await currentPdf.getPageIndex(d[0]);
      } else if (typeof d === 'string') {
        const ref = await currentPdf.getDestination(d);
        if (ref && ref.length) {
          const r = ref[0];
          pageIdx = await currentPdf.getPageIndex(r);
        }
      }
      if (pageIdx !== -1 && box.current) {
        box.current.scrollTop = calScrollTop(pageIdx);
      }
    },
    [currentPdf, heights],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ overflow: 'hidden', height: '100%' }}>
      <div className={style['title-bar']}>
        <span className={style.left}>
          <Icon
            className={style['title-icon']}
            name="menu"
            onClick={() => setIsShowOutline(!isShowOutline)}
          />
          <span
            className={style['title-icon']}
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={async () => {
              const records = await systemPrompt({ title: '跳转到', records: [{ name: '页码', type: 'number' }] });
              const r = records?.['页码'];
              if (r) {
                const num = parseInt(r);
                if (box.current && num <= pages.length && num > 0) {
                  const scrollTop = calScrollTop(num - 1);
                  box.current.scrollTop = scrollTop;
                }
              }
            }}
          >
            {currentPage + 1}/{pages.length}
          </span>
        </span>
        <span className={style.right}>
          <Icon
            className={style['title-icon']}
            name="dark"
            onClick={() => setInvertColor(!invertColor)}
          />
          <Icon
            className={style['title-icon']}
            name="zoom-in"
            onClick={zoomIn}
          />
          <Icon
            className={style['title-icon']}
            name="zoom-out"
            onClick={zoomOut}
          />
          <Icon
            className={style['title-icon']}
            name="column-width"
            onClick={zoomFit}
          />
          <span
            className={style['title-icon']}
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={async () => {
              const records = await systemPrompt({ title: '设置宽度', records: [{ name: '宽度(%)', type: 'number' }] });
              const r = records?.['宽度(%)'];
              if (r) {
                let num = parseFloat(r);
                if (Number.isNaN(num)) return;
                num = num > 100 ? 100 : num < 20 ? 20 : num;
                zoomPercent(num / 100);
              }
            }}
          >
            {percent}
          </span>
        </span>
      </div>
      <div className={style['main-body']}>
        <VirtualScrollbar observeScrollHeightChange>
          <div className={classNames(style['outline-wrapper'], style['no-scrollbar'], { [style.show]: isShowOutline })}>
            <OutlineBar
              outline={outline?.items}
              onClick={onClickOutline}
            />
          </div>
        </VirtualScrollbar>
        <div
          className={classNames(style['pdf-page'])}
          ref={containerRef}
          style={{ height: '100%', left: isShowOutline ? '200px' : '0' }}
        >
          <VirtualScrollbar
            observeScrollHeightChange
            scroll="vertical"
            forwardedRef={(r: HTMLDivElement) => (box.current = r)}
            scrollbarContainer={containerRef.current || undefined}
          >
            <div
              className={classNames(style['virtual-viewport'], style['no-scrollbar'])}
              onScroll={onScroll}
              style={{ transform: `scale(${viewportScale})`, padding: `0 ${viewportPadding / viewportScale}px`, height: viewportHeight }}
            >
              <div
                className={classNames(style['pdf-viewer'], { [style['invert-color']]: invertColor })}
                ref={canvasRef}
              >
                {Array.from({ length: canvasNum }).map((_, idx) => {
                  return (
                    <canvas
                      key={idx}
                      className={style['pdf-canvas']}
                    ></canvas>
                  );
                })}
                <div className={style['pdf-text-container']}>
                  {Array.from({ length: canvasNum }).map((_, idx) => {
                    return (
                      <div
                        key={'text' + idx}
                        className={style['pdf-text']}
                      ></div>
                    );
                  })}
                </div>
              </div>
            </div>
          </VirtualScrollbar>
        </div>
      </div>
    </div>
  );
}

function OutlineTree(props: { idx: number; outline: Outline; onClick: (ol: Outline) => void; onExpand: (count: number, idx: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [childCount, setChildCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const childCounts = useRef(new Map<number, number>());
  const onExpand = (count: number, idx: number) => {
    childCounts.current.set(idx, count);
    const current = isOpen ? props.outline.items.length : 0;
    const c = [...childCounts.current.values()].reduce((p, n) => p + n, 0);
    setChildCount(c);
    setTotalCount(c + current);
    props.onExpand(count + current, props.idx);
  };
  return (
    <div className={style['outline-tree']}>
      <div className={style['tree-title']}>
        {props.outline?.items?.length ? (
          <Icon
            onClick={() => {
              setIsOpen(!isOpen);
              const current = !isOpen ? props.outline.items.length : 0;
              console.log(current, childCount);
              setTotalCount(current + childCount);
              props.onExpand(current + childCount, props.idx);
            }}
            name="arrow-down"
            className={classNames(style.icon, { [style.open]: isOpen })}
          />
        ) : (
          <span style={{ display: 'inline-block', width: 13 }}></span>
        )}
        <span onClick={() => props.onClick(props.outline)}>{props.outline.title}</span>
      </div>
      <div
        className={style.subtree}
        style={{ height: isOpen ? totalCount * 26 : 0 }}
      >
        {props.outline.items.map((ol, idx) => {
          return (
            <OutlineTree
              idx={idx}
              onExpand={onExpand}
              key={idx}
              outline={ol}
              onClick={props.onClick}
            />
          );
        })}
      </div>
    </div>
  );
}

function OutlineBar(props: { show?: boolean; outline?: Outline[]; onClick: (ol: Outline) => void }) {
  return (
    <div className={classNames(style.outline, style['no-scrollbar'])}>
      {props.outline &&
        props.outline.map((ol, idx) => {
          return (
            <OutlineTree
              idx={0}
              onExpand={() => {}}
              key={idx}
              outline={ol}
              onClick={props.onClick}
            />
          );
        })}
    </div>
  );
}
