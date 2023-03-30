import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { useEffect, useRef, useState } from "react";
import style from './pdf-viewer.module.less';
import { create_download_link_from_file_path } from '@webby/core/fs';

export default function PdfViewer(props: { onFileOpen: (cb: (file: string) => void) => void }) {
  GlobalWorkerOptions.workerSrc = '/apps/pdf-viewer/pdf.worker.min.js';
  const CMAP_URL = '/apps/pdf-viewer/cmaps/';

  const canvasRef = useRef<HTMLDivElement>(null);
  const lastFile = useRef('');
  const [file, setFile] = useState('');

  useEffect(() => {
    props.onFileOpen((f: string) => {
      setFile(f);
    });
  }, []);

  useEffect(() => {
    const f = file;
    if (f === lastFile.current) return;
    lastFile.current = f;
    (async () => {
      if (!canvasRef.current) return;
      const container = canvasRef.current;

      const filePath = create_download_link_from_file_path(f);
      const loadingTask = getDocument({
        url: filePath,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      for (let i = 0; i < numPages; i++) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        const page = await pdf.getPage(i + 1);
        const scale = 1.5;
        const viewport = page.getViewport({ scale: scale, });
        // Support HiDPI-screens.
        const outputScale = window.devicePixelRatio || 1;

        container.appendChild(canvas);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.border = '1px solid #eee';
        canvas.classList.add(style['pdf-canvas']);

        const transform = outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : undefined;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport
        };
        page.render(renderContext);
      }

    })();

    const container = canvasRef.current;
    return () => {
      if (!container) return;
      container.innerHTML = '';
    }
  }, [file]);

  return <div className={style['pdf-viewer']} ref={canvasRef}>
  </div>
}