import { getDocument, GlobalWorkerOptions, PDFPageProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from "react";
import style from './pdf-viewer.module.less';
import { create_download_link_from_file_path } from '@webby/core/fs';
import { debounceThrottle } from './utils';

const MORE_PAGE = 10;

export default function PdfViewer(props: { onScroll: (st: number) => void, onLoaded: (el: HTMLDivElement) => void, width: number, file: string, pageIdx: number }) {
  GlobalWorkerOptions.workerSrc = '/apps/pdf-viewer/pdf.worker.min.js';
  const CMAP_URL = '/apps/pdf-viewer/cmaps/';

  const canvasRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const [totalHeight, setTotalHeight] = useState<number>(0);
  const [canvasNum, setCanvasNum] = useState<number>(0);
  const [canvasList, setCanvasList] = useState<HTMLCanvasElement[]>([]);
  const cacheCanvasList = useRef<HTMLCanvasElement[]>([]);
  const currentPageIdx = useRef(0);
  const isWaiting = useRef(false);

  useEffect(() => {
    if (!props.file) return;
    const filePath = create_download_link_from_file_path(props.file);
    const loadingTask = getDocument({
      url: filePath,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
    });

    const pages: PDFPageProxy[] = [];

    (async () => {
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      for (let i = 0; i < numPages; i++) {
        const page = await pdf.getPage(i + 1);
        pages.push(page);
      }
      setPages(pages);
    })();
  }, [props.file]);

  useEffect(() => {
    const heights: number[] = [];
    let totalHeight = 0;
    for (let page of pages) {
      const viewport = page.getViewport({ scale: 1 });
      const ratio = viewport.height / viewport.width;
      const height = (props.width * ratio);
      heights.push(height);
      totalHeight += height;
    }
    setTotalHeight(totalHeight);
    setHeights(heights);
    const c = canvasRef.current;
    if (!c) return;
    const count = Math.ceil(c.clientHeight / heights[0]) + MORE_PAGE;
    const cvsNum = heights.length >= count ? count : heights.length;
    setCanvasNum(cvsNum);
  }, [pages, props.width]);

  useEffect(() => {
    if (canvasRef.current) {
      const cvss = canvasRef.current.children;
      cacheCanvasList.current = [];
      for (let i = 0; i < cvss.length; i++) {
        cacheCanvasList.current.push(document.createElement('canvas'));
      }
      setCanvasList(Array.from(cvss) as HTMLCanvasElement[]);
      currentPageIdx.current = -1;
      canvasRef.current.scrollTop = 0;
    }
  }, [heights, canvasNum]);

  useEffect(() => {
    _onScroll(true).then(() => {
      if (box.current) {
        props.onLoaded(box.current!);
      }
    });
  }, [canvasList]);

  const _onScroll = async (force = false) => {
    const cvsEl = canvasRef.current;
    if (!cvsEl) return;
    if (!force && box.current) {
      props.onScroll(box.current.scrollTop);
    }
    const cvsList = canvasList;
    const cvsCount = cvsList.length;
    let st = box.current?.scrollTop || 0;
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
      startPageIdx = i;
      sumHeight += h;
    }
    const lastPageIdx = currentPageIdx.current;
    if (!force && lastPageIdx !== -1
      && (
        startPageIdx === lastPageIdx
        || (startPageIdx >= lastPageIdx && startPageIdx < lastPageIdx + (MORE_PAGE / 2 >> 0))
      )
    ) return;
    currentPageIdx.current = startPageIdx;

    endPageIdx = startPageIdx + (cvsCount - 1);

    let startHeight = paddingTop;
    for (let i = startPageIdx; i <= endPageIdx; i++) {
      startHeight += heights[i];
    }

    paddingBottom = totalHeight - startHeight;
    // console.log(`idx: ${startPageIdx}-${endPageIdx}\npadding: ${paddingTop}-${paddingBottom}\nsumHeight: ${sumHeight}`);

    let renderTasks: Promise<void>[] = [];
    for (let i = startPageIdx; i <= endPageIdx; i++) {
      const cacheCanvas = cacheCanvasList.current[i - startPageIdx];

      if (!cacheCanvas) return;
      const context = cacheCanvas.getContext('2d');
      if (!context) return;

      const page = pages[i]; // 需要渲染的页面索引
      if (!page) return;

      const viewport = page.getViewport({ scale: 1 });
      // Support HiDPI-screens.
      const outputScale = window.devicePixelRatio || 1;

      cacheCanvas.width = Math.floor(viewport.width * outputScale);
      cacheCanvas.height = Math.floor(viewport.height * outputScale);

      cacheCanvas.style.width = props.width + 'px';
      cacheCanvas.style.height = heights[i] + 'px';

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : undefined;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };
      isWaiting.current = true;
      let task = page.render(renderContext);
      renderTasks.push(task.promise);
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
    cvsEl.style.paddingTop = paddingTop + 'px';
    cvsEl.style.paddingBottom = paddingBottom + 'px';

  };
  const onScroll = useCallback(debounceThrottle(() => _onScroll(false), 500), [heights, canvasList]);

  const box = useRef<HTMLDivElement>(null);

  return <div ref={box} style={{ overflow: 'auto', height: '100%' }} onScroll={onScroll}>
    <div className={style['pdf-viewer']} ref={canvasRef}>
      {
        Array.from({ length: canvasNum }).map((_, idx) => {
          return <canvas key={idx} className={style['pdf-canvas']}></canvas>;
        })
      }
    </div>
  </div>
}