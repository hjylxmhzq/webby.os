import style from './video-player.module.less';

export default function VideoPreview({ src }: { src: string }) {
  return <div className={style.player}>
    <video controls src={src}></video>
  </div>
}