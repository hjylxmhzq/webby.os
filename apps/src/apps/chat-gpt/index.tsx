import React, { useEffect, useRef, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo } from '@webby/core/web-app';
import Chat from './chat';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';
import { http } from '@webby/core/tunnel';
import { CachedEventEmitter } from '../../utils/events';

let reactRoot: ReactDom.Root;

const store = new Collection('built_in_app_chat');

export async function mount(ctx: AppContext) {
  let token = '';
  ctx.systemMenu = [
    {
      name: '对话',
      children: [
        {
          name: '清空对话',
          onClick() {
            eventBus.emit('clear');
          }
        },
        {
          name: '自定义Prompt',
          onClick() {
            const p = prompt('请输入自定义prompt');
            if (p) {
              eventBus.emit('prompt', p);
            }
          }
        },
      ]
    },
    {
      name: '设置',
      children: [
        {
          name: '配置API Token',
          onClick() {
            const _token = prompt('设置openapi API Token');
            if (_token) {
              token = _token;
              store.set('api_token', token);
            }
          }
        },
        {
          name: '清除API Token',
          onClick() {
            store.remove('api_token');
          }
        },
        {
          name: '显示当前API Token',
          onClick() {
            ctx.systemMessage({ type: 'info', title: 'API Token', content: token ? token : '未设置', timeout: 5000 });
          }
        }
      ]
    }];
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />);

  const eventBus = new CachedEventEmitter();


  function Index() {
    const [apiToken, setApiToken] = useState('');
    const [isLoading, setLoading] = useState(false);
    const [isError, setError] = useState('');
    const abort = useRef<AbortController>()
    const [msgLine, setMsgLine] = useState<MsgLineItem[]>([
      {
        usage: {
          token: 0,
        },
        msg: {
          role: 'system',
          content: 'You are a helpful assistant.',
        }
      }
    ]);
    const onInput = async (msg: string) => {
      if (!apiToken) {
        ctx.systemMessage({
          type: 'error',
          title: '错误',
          content: token ? token : '未设置API Token，请选择顶部菜单设置API Token',
          timeout: 5000
        });
        return;
      }
      const newMsg: ChatMessage = {
        role: 'user',
        content: msg,
      };
      msgLine.push({ msg: newMsg, usage: { token: 0 } });
      setMsgLine(msgLine.slice());
      await ask(msgLine);
    };

    async function ask(msgLine: MsgLineItem[]) {
      const body: RequestBody = {
        model: 'gpt-3.5-turbo',
        messages: msgLine.map(m => m.msg),
      };
      if (isLoading) {
        if (abort.current) {
          abort.current.abort();
        }
      }
      setLoading(true);
      try {
        setError('');
        const ac = new AbortController();
        abort.current = ac;
        const resp = await http.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'post',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        const respBody: RespBody = await resp.json();
        if (respBody.choices.length) {
          const ans = respBody.choices[0].message;
          const tokens = respBody.usage.total_tokens;
          msgLine.push({
            msg: ans,
            usage: {
              token: tokens,
            }
          });
          setMsgLine([...msgLine]);
          store.set('messages', msgLine);
        }
      } catch (e: any) {
        setError(e.toString());
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      store.get<string>('api_token').then(v => {
        if (v) {
          token = v;
          setApiToken(v);
        }
      });
      store.subscribe('api_token', (t) => {
        token = t;
        setApiToken(t);
        if (t) {
          ctx.systemMessage({
            type: 'info',
            title: '已配置API Token',
            content: t,
            timeout: 5000
          });
        }
      });
      store.get<MsgLineItem[]>('messages').then(msgs => {
        if (msgs) {
          setMsgLine(msgs);
        }
      })
      const clear = () => setMsgLine(msgLine.slice(0, 1));
      const setPrompt = (prompt: string) => {
        console.log('pppp', prompt);
        msgLine[0].msg.content = prompt;
        setMsgLine(msgLine.slice());
      };
      eventBus.on('clear', clear);
      eventBus.on('prompt', setPrompt);
      return () => {
        eventBus.off('clear', clear);
        eventBus.off('prompt', setPrompt);
      }
    }, []);

    const onChangeMsg = async (idx: number, msg: string) => {
      msgLine[idx].msg.content = msg;
      const newMsgLine = msgLine.slice(0, idx + 1);
      setMsgLine(newMsgLine);
      await ask(newMsgLine);
    };

    return <div style={{ position: 'absolute', inset: 0 }}>
      <Chat onChange={onChangeMsg} error={isError} loading={isLoading} msgLine={msgLine} onInput={onInput} />
    </div>
  }

}

export type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: Role,
  content: string,
}

export interface MsgLineItem {
  usage: {
    token: number,
  },
  msg: ChatMessage,
}

interface RequestBody {
  model: "gpt-3.5-turbo";
  messages: ChatMessage[];
}

interface RespBody {
  "id": string,
  "object": string,
  "created": number,
  "model": string,
  "usage": {
    "prompt_tokens": number,
    "completion_tokens": number,
    "total_tokens": number
  },
  "choices": {
    "message": {
      "role": Role,
      "content": string
    },
    "finish_reason": string,
    "index": number
  }[]
}


export async function unmount(ctx: AppContext) {
  reactRoot.unmount();
}

export function getAppInfo(): AppInfo {
  return {
    name: 'Chat',
    iconUrl,
    width: 800,
    height: 500,
    supportExts: [],
  }
}
