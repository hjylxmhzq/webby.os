import Plyr, { PlyrSource } from "plyr-react"
import "plyr-react/plyr.css"
import style from './video-viewer.module.less';

export default function VideoPreview({ src }: { src: string }) {

  const plyrProps = {
    source: { type: 'video', sources: [{ src }] } as PlyrSource, // https://github.com/sampotts/plyr#the-source-setter
    options: { enabled: true }, // https://github.com/sampotts/plyr#options
    // Direct props for inner video tag (mdn.io/video)
  }
  return <div className={style.player}><Plyr {...plyrProps} /></div>;
}