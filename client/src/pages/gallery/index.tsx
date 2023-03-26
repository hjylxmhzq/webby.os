import { useEffect, useRef, useState } from "react"
import { create_download_link_from_file_path } from "@apis/file";
import { get_job_status, list_all_images, update_index } from "@apis/gallery";
import Button from "@components/button";
import style from './index.module.less';

function load_img_src(el: HTMLImageElement) {
  return new Promise((resolve, reject) => {
    el.onload = function () {
      resolve(undefined);
      el.onload = null;
    }
    el.onerror = function (err) {
      reject(err);
      el.onerror = null;
    }
    let src = el.dataset['src'];
    if (src) {
      el.src = src;
    } else {
      reject(undefined);
    }
  });
}

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const container = useRef<HTMLDivElement>(null);
  const [indexingStatus, setIndexingStatus] = useState(0);

  async function loadImages() {
    let images = await list_all_images();
    setImages(images.data);
  }

  useEffect(() => {
    loadImages();
  }, []);

  useEffect(() => {
    if (!container.current) return;
    let el = container.current;
    let imgs: HTMLImageElement[] = Array.from(el.querySelectorAll('[data-src]'));
    let shouldStop = false;
    (async () => {
      for (let i = 0; i < imgs.length; i++) {
        if (shouldStop) {
          break;
        }
        let img = imgs[i];
        await load_img_src(img);
      }
    })();
    return () => {
      shouldStop = true;
    };
  }, [images]);

  async function update() {
    let status = await get_job_status();
    if (status.data.Running !== undefined) {
      setIndexingStatus(status.data.Running);
      setTimeout(update, 1000);
    } else {
      loadImages();
    }
  }

  const updateIndex = async () => {
    await update_index();
    update();
  };

  return <div>
    <div className={style.header}>
      <Button onClick={updateIndex}>更新索引</Button>
      {
        !!indexingStatus && <span className={style['header-item']}>已索引：{indexingStatus}个文件</span>
      }
    </div>
    <div className={style.container} ref={container}>
      {
        images.map((img) => {
          return <div className={style['img-wrapper']} key={img['file_path']}>
            <img className={style.img} data-src={create_download_link_from_file_path(img['file_path'])} src="" alt=""></img>
          </div>
        })
      }
    </div>
  </div>
}
