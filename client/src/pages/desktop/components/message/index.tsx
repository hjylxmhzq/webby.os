import Button from "@components/button"
import style from './index.module.less';
import { CSSTransition, TransitionGroup } from 'react-transition-group' // ES6
import classNames from "classnames";
import { useEffect, useState } from "react";
import { xssFilter } from "src/utils/xss-filter";
import { Progress, SmartImage } from "@webby/components";
import { IdMessage } from "../..";

export default function MessageLine(props: { messages: IdMessage[], onClose: (id: string) => void }) {

  const [padding, setPadding] = useState(false);

  useEffect(() => {
    setPadding(true);
    setTimeout(() => {
      setPadding(false);
    }, 300);
  }, [props.messages]);

  const msgEls = props.messages.map(msg => {
    return <CSSTransition key={msg.id} timeout={{ enter: 300, exit: 300 }}>
      <div className={style.message}>
        {
          msg.isHtml ?
            <>
              <div className={style['msg-top']}>
                <SmartImage className={style['app-icon']} src={msg.app.getAppInfo().iconUrl} />
                <div className={style.title} dangerouslySetInnerHTML={{ __html: xssFilter(msg.title) }}></div>
              </div>
              <div className={style.content} dangerouslySetInnerHTML={{ __html: xssFilter(msg.content) }}></div>
            </>
            :
            <>
              <div className={style['msg-top']}>
                <SmartImage className={style['app-icon']} src={msg.app.getAppInfo().iconUrl} />
                <div className={style.title}>{msg.title}</div>
              </div>
              <div className={style.content}>{msg.content}</div>
            </>
        }
        {
          msg.progress !== undefined && <div className={style.progress}>
            <Progress style={{ height: 2 }} percent={msg.progress} />
          </div>
        }
        <div className={style.control}>
          <Button onClick={() => props.onClose(msg.id)} className={style.btn}>关闭</Button>
        </div>
      </div>
    </CSSTransition >
  });

  return <div className={classNames(style['message-line'], 'scrollbar')} style={{ display: props.messages.length ? 'block' : 'none', paddingBottom: padding ? 50 : 10 }}>
    <TransitionGroup>
      {msgEls}
    </TransitionGroup>
  </div >
}