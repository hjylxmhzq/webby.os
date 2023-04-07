import React, { useEffect, useRef, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, SelectFileOptions } from '@webby/core/web-app';
import style from './index.module.less';
import iconUrl from './icon.svg';
import { MessageQueue } from '@webby/core/message-queue';

let mq: MessageQueue;
let reactRoot: ReactDom.Root;
export async function mount(ctx: AppContext) {
  mq = new MessageQueue('video-call');
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />)

  mq.on_participant((p) => {
    ctx.systemMessage({ type: 'info', title: 'new participant', content: `${p.count}`, timeout: 5000 });
  });

  function Index() {

    const vFormat = 'video/webm;codecs=vp8';
    let recorder: MediaRecorder;
    async function getMediaStream() {
      const constraints = {
        // audio: true,
        video: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!videoRef.current) return;
      recorder = new MediaRecorder(stream, { mimeType: vFormat });
      recorder.ondataavailable = async (e) => {
        const ab = await e.data.arrayBuffer();
        mq.send(ab);
      };

      recorder.start(200);
      recorder.onstart = console.log;

      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('click', () => {
        recorder.stop();
        recorder.state
      });

    }

    function subscribeRemote() {
      const mediaSource = new MediaSource();
      if (!remoteVideoRef.current) return;
      remoteVideoRef.current.src = URL.createObjectURL(mediaSource);
      mediaSource.addEventListener('sourceopen', () => {
        let sourceBuffer = mediaSource.addSourceBuffer(vFormat);
        sourceBuffer.addEventListener('error', (ev) => {
          console.log('source buffer error', ev);
          sourceBuffer = mediaSource.addSourceBuffer(vFormat);
        });
        mq.subscribe(async msg => {
          if (msg instanceof Blob) {
            try {
              sourceBuffer.appendBuffer(await msg.arrayBuffer());
            } catch (e) {
              console.error(e);
              sourceBuffer = mediaSource.addSourceBuffer(vFormat);
            }
          }
        });
      });
    }
    useEffect(() => {

      (async () => {

        await getMediaStream();
        await subscribeRemote();

      })();

      return () => {
        if (recorder) {
          recorder.stop();
        }
      }
    }, []);

    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    return <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <video autoPlay ref={videoRef}></video>
      <video autoPlay ref={remoteVideoRef}></video>
    </div>
  }
}

export async function unmount(ctx: AppContext) {
  if (mq) {
    mq.close();
  }
  reactRoot.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Image',
    iconUrl,
    width: 500,
    height: 500,
    supportExts: [],
  }
}
