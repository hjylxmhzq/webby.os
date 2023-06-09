import { useEffect, useRef, useState } from "react";
import Button from "src/components/button";
import ReactDOM from 'react-dom';
import style from './index.module.less';
import classNames from "classnames";

export interface PromptContent {
  title: string;
  records?: {
    name: string,
    type?: 'text' | 'number',
    pattern?: RegExp,
  }[];
}

export interface PromptResult {
  [key: string]: string,
}

export type PromptDefaultResult = string;

export interface PromptProps {
  prompt: PromptContent;
  onComfirm(result: PromptResult): void;
  onCancel(): void;
}

export function SystemPrompt(props: PromptProps) {

  const ref = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<PromptResult>({});
  const records = props.prompt.records;
  useEffect(() => {
    if (ref.current) {
      const input = ref.current.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }, []);
  const el = <div className={style.container}>
    <form onSubmit={e => e.preventDefault()}>
      <div className={style.mask}></div>
      <div className={classNames(style['prompt-container'], 'scrollbar')}>
        <div className={style.title}>{props.prompt.title}</div>
        <div ref={ref} className={style.content}>
          {
            !!records?.length ?
              records.map((record, idx) => {
                return <div key={record.name + idx} className={style.item}>
                  <span className={style.label}>{record.name}</span>
                  <input
                    className={style.input}
                    type={record.type || 'text'} value={form[record.name] || ''}
                    onChange={e => setForm({ ...form, [record.name]: e.target.value })}>
                  </input>
                </div>
              })
              : <div className={style.item}>
                <input
                  className={style.input}
                  type="text" value={form.default || ''}
                  onChange={e => setForm({ default: e.target.value })}>
                </input>
              </div>
          }
        </div>
        <div className={style.btn}>
          <Button submit onClick={() => {
            props.onComfirm(form);
          }}>确定</Button>
          <Button onClick={() => {
            props.onCancel();
          }}>取消</Button>
        </div>
      </div>
    </form>
  </div>;

  return ReactDOM.createPortal(el, document.body);
}
