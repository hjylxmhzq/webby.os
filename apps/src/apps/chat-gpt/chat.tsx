import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { MsgLineItem, Role } from ".";
import style from './chat.module.less';
import classNames from 'classnames';
import { marked } from 'marked';
import 'highlight.js/styles/monokai-sublime.css';
import { Popover } from "../../components/popover";
import Button from "../../components/button";
const hljs = require('highlight.js');
import renderMathInElement from 'katex/contrib/auto-render';

export interface IProps {
  msgLine: MsgLineItem[];
  onInput(msg: string): void;
  loading: boolean,
  error: string,
  partialMsg: string,
  onChange(idx: number, newMsg: string): void,
  onChangeMeta(temp: number, maxTokens: number): void,
  meta: {
    temperature: number,
    maxTokens: number,
  }
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
      {
        !!props.partialMsg && <div className={classNames(style['msg-item-wrapper'], style['left'])}>
          <MessageContent role={'assistant'} content={props.partialMsg} partial />
        </div>
      }
    </div>
    <div className={style['msg-input-wrapper']}>
      <div className={style.error}>{props.error}</div>
      <Popover position="top" inline auto content={
        <div style={{ lineHeight: '35px', fontSize: 12, padding: '0 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>temperature</span>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                onChange={e => props.onChangeMeta(+e.target.value, props.meta.maxTokens)}
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={props.meta.temperature}
              ></input>
              <span style={{ width: 40 }}>{props.meta.temperature.toFixed(2)}</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>max tokens</span>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                onChange={e => props.onChangeMeta(props.meta.temperature, +e.target.value)}
                type="range"
                min={1}
                max={4096}
                step={1}
                value={props.meta.maxTokens}
              ></input>
              <span style={{ width: 40 }}>{props.meta.maxTokens}</span>
            </span>
          </label>
        </div>
      }>
        <Button className={style['setting-btn']}>设置</Button>
      </Popover>
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
  content: string, role: Role, onChange?: (newMsg: string) => void, partial?: boolean
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
    const md = marked.parse(props.content, {
      highlight(code, lang) {
        if (!lang || props.partial) {
          return code;
        }
        try {
          const hl = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          return hl;
        } catch (e) {
          console.error(e);
          return code;
        }
      }
    });
    textRef.current.innerHTML = md;
    renderMathInElement(textRef.current, {
      // customised options
      // • auto-render specific keys, e.g.:
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      // • rendering keys, e.g.:
      throwOnError: false
    });
    return () => {
      if (textRef.current) {
        textRef.current.innerHTML = ''
      }
    }
  }, [props.content, editing]);

  return <div className={classNames(style['msg-item'], props.role === 'assistant' ? style['left'] : style['right'], { [style.editing]: editing })}>
    <div
      className={classNames(style['msg-content'], { [style.editing]: editing })}
      onDoubleClick={() => {
        if (props.partial) return;
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
            if (props)
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                props.onChange?.(editContent);
                setEditing(false);
              }
          }}
          placeholder="input you question, and press Ctrl+Enter(Cmd+Enter) to submit"
          ref={editor}
          onBlur={() => {
            props.onChange?.(editContent);
            setEditing(false);
          }} className={classNames(style.editor)} value={editContent} onChange={e => setEditContent(e.target.value)}></textarea>
          : <div ref={textRef} className={classNames({ [style.processing]: props.partial })}></div>
      }
    </div>
  </div>
}
