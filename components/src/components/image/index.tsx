import React, { ImgHTMLAttributes, useEffect, useRef } from "react";
import defaultImg from './image.svg';

export interface Props {
  src: string;
  downloadQueueId?: string;
}

type imgProps = ImgHTMLAttributes<HTMLImageElement>;

let _queueId = Math.random().toString().substring(2);

export function SmartImage(props: Props & imgProps) {
  const queueId = props.downloadQueueId || _queueId;
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (imgRef.current) {
      const queue = getQueueById(queueId);
      queue.enqueue(imgRef.current);
      return () => queue.destroy();
    }
  }, [props.src]);
  return <img {...props} ref={imgRef} src={defaultImg} data-src={props.src}></img>
}

class DownloadQueue {
  waitingPromise = Promise.resolve();
  public queue: HTMLImageElement[] = [];
  constructor(public id: string, public parallelNum: number = 2) { }
  destroy() {
    for (let el of this.queue) {
      el.src = defaultImg;
    }
    this.queue.length = 0;
  }
  enqueue(el: HTMLImageElement) {
    const run = async () => {
      const tasks = [];
      for (let i = 0; i < this.parallelNum; i++) {
        const el = this.queue[i];
        if (!el) break;
        tasks.push(el);
      }
      const promises = tasks.map((el) => {
        return new Promise((resolve, reject) => {
          el.src = el.dataset['src'] || '';
          el.onload = function () {
            resolve(undefined);
          };
          el.onerror = function (err) {
            console.error(err);
            resolve(undefined);
          }
        });
      });
      await Promise.all(promises);
      this.queue.splice(0, tasks.length);
      if (this.queue.length) {
        await run();
      }
    }
    this.queue.push(el);
    if (this.queue.length === 1) {
      run();
    }
  }
}

const queueMap = new Map<string, DownloadQueue>();

function getQueueById(id: string) {
  const queue = queueMap.get(id);
  if (queue) return queue;
  else {
    const queue = new DownloadQueue(id);
    queueMap.set(id, queue);
    return queue;
  }
}