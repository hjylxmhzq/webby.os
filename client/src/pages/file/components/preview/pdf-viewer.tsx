import { create_download_link, FileStat } from "@apis/file";
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { useEffect, useRef } from "react";
import style from './pdf-viewer.module.less';
import path from "path-browserify";

export default function PdfViewer({ dir, file }: { dir: string, file: FileStat }) {
  GlobalWorkerOptions.workerSrc = '/static/js/pdf.worker.min.js';
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastFile = useRef('');
  useEffect(() => {
    const f = path.join(dir, file.name);
    if (f === lastFile.current) return;
    lastFile.current = f;
    (async () => {
      if (!canvasRef.current) return;
      const container = canvasRef.current;

      const filePath = create_download_link(dir, file.name);
      const loadingTask = getDocument(filePath);
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
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
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
  }, [dir, file]);

  return <div className={style['pdf-viewer']} ref={canvasRef}>
  </div>
}