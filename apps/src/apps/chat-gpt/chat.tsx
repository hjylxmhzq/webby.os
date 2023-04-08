import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { MsgLineItem, Role } from ".";
import style from './chat.module.less';
import classNames from 'classnames';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';
// @ts-ignore
import hljs from 'highlight.js';

export interface IProps {
  msgLine: MsgLineItem[];
  onInput(msg: string): void;
  loading: boolean,
  error: string,
  onChange(idx: number, newMsg: string): void,
}

export default function Chat(props: IProps) {
  const [input, setInput] = useState('');
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      props.onInput(input);
      setInput('');
    }
  }
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [props.msgLine]);
  return <div className={style.container}>
    <div className={style['msg-list']} ref={listRef}>
      {
        props.msgLine.filter(msg => !!msg).map((msg, idx) => {
          return <div key={idx} className={classNames(style['msg-item-wrapper'], msg.msg.role === 'assistant' ? style['left'] : style['right'])}>
            <MessageContent role={msg.msg.role} onChange={msg => props.onChange(idx, msg)} content={msg.msg.content} />
          </div>
        })
      }
      {
        props.loading && <div className={classNames(style['msg-item-wrapper'], style['left'])}>
          <div className={classNames(style['msg-item'], style.left)}>
            <div className={style['msg-content']}>
              <div className={style.loading}></div>
            </div>
          </div>
        </div>
      }
    </div>
    <div className={style['msg-input-wrapper']}>
      <div className={style.error}>{props.error}</div>
      <textarea
        className={style['msg-input']}
        onChange={e => setInput(e.target.value)}
        value={input}
        placeholder="input you question, and press Ctrl+Enter(Cmd+Enter) to submit"
        onKeyDown={onKeyDown}></textarea>
    </div>
  </div>
}

function MessageContent(props: {
  content: string, role: Role, onChange: (newMsg: string) => void
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const editor = useRef<HTMLTextAreaElement>(null)
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && editor.current) {
      editor.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.innerHTML = marked.parse(props.content, {
      highlight(code, lang) {
        const hl = hljs.highlight(lang, code).value;
        return hl;
      }
    });
  }, [props.content, editing]);

  return <div className={classNames(style['msg-item'], props.role === 'assistant' ? style['left'] : style['right'], { [style.editing]: editing })}>
    <div
      className={classNames(style['msg-content'], { [style.editing]: editing })}
      onDoubleClick={() => {
        if (props.role === 'user') {
          setEditing(true);
          setEditContent(props.content);
        }
      }}>
      {
        props.role === 'system' && <span style={{ opacity: 0.5 }}>Prompt</span>
      }
      {
        editing ? <textarea
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              props.onChange(editContent);
              setEditing(false);
            }
          }}
          placeholder="input you question, and press Ctrl+Enter(Cmd+Enter) to submit"
          ref={editor}
          onBlur={() => {
            props.onChange(editContent);
            setEditing(false);
          }} className={classNames(style.editor)} value={editContent} onChange={e => setEditContent(e.target.value)}></textarea>
          : <div ref={textRef}></div>
      }
    </div>
  </div>
}