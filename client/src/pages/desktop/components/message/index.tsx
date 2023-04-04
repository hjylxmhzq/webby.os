import Button from "@components/button"
import { SystemMessage } from "@webby/core/web-app"
import style from './index.module.less';
import { CSSTransition, TransitionGroup } from 'react-transition-group' // ES6
import classNames from "classnames";

type Message = { id: string } & SystemMessage;

export default function MessageLine(props: { messages: Message[], onClose: (id: string) => void }) {
  const msgEls = props.messages.map(msg => {
    return <CSSTransition key={msg.id} timeout={{ enter: 300, exit: 300 }}>
      <div className={style.message}>
        <div className={style.title}>{msg.title}</div>
        <div className={style.content}>{msg.content}</div>
        <div className={style.control}>
          <Button onClick={() => props.onClose(msg.id)} className={style.btn}>关闭</Button>
        </div>
      </div>
    </CSSTransition>
  });

  return <div className={classNames(style['message-line'], 'scrollbar')} style={{ display: props.messages.length ? 'block' : 'none' }}>
    <TransitionGroup>
      {msgEls}
    </TransitionGroup>
  </div>
}