import React, { useEffect, useRef, useState } from 'react';
import ReactDom from 'react-dom/client';
import { AppContext, AppInfo, AppInstallContext, defineApp } from '@webby/core/web-app';
import Chat from './chat';
import iconUrl from './icon.svg';
import { Collection } from '@webby/core/kv-storage';
import { http } from '@webby/core/tunnel';
import { CachedEventEmitter } from '../../utils/events';
import { openFileBy, systemMessage } from '@webby/core/system';

let reactRoot: ReactDom.Root;

const store = new Collection('built_in_app_chat');

let enabledGlobalSearch = false;
async function mount(ctx: AppContext) {
  let token = '';
  const systemMenu = [
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
            systemMessage({ type: 'info', title: 'API Token', content: token ? token : '未设置', timeout: 5000 });
          }
        }
      ]
    }];

  ctx.systemMenu.set(systemMenu);

  store.get('enable_global_search').then(v => {
    enabledGlobalSearch = !!v;
  });
  const root = ctx.appRootEl;
  root.style.position = 'absolute';
  root.style.inset = '0';

  reactRoot = ReactDom.createRoot(root);
  reactRoot.render(<Index />);

  const eventBus = new CachedEventEmitter();
  ctx.onOpenFile(question => {
    eventBus.emit('ask', question);
  });

  function Index() {
    const [apiToken, setApiToken] = useState('');
    const [isLoading, setLoading] = useState(false);
    const [isError, setError] = useState('');
    const [partialMsg, setPartialMsg] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
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
    const apiTokenRef = useRef(apiToken);
    apiTokenRef.current = apiToken;
    const onInput = async (msg: string) => {
      const apiToken = apiTokenRef.current;
      if (!apiToken) {
        systemMessage({
          type: 'error',
          title: '错误',
          content: '未设置API Token，请选择顶部菜单设置API Token',
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
      const apiToken = apiTokenRef.current;
      const body: RequestBody = {
        model: 'gpt-3.5-turbo',
        messages: msgLine.map(m => m.msg),
        stream: true,
        temperature: meta.temperature,
      };
      if (meta.maxTokens > 0) {
        body.max_tokens = meta.maxTokens;
      }
      if (isLoading || isStreaming) {
        setPartialMsg('');
      }
      if (abort.current) {
        abort.current.abort();
      }
      setLoading(true);
      setIsStreaming(true);
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
        const reader = resp.body?.pipeThrough(new TextDecoderStream()).getReader();

        const chunks: DeltaResp[] = [];
        let text = '';
        let role: Role = 'user';
        function read() {
          reader?.read().then(v => {
            const value = v.value?.trim();
            if (value) {
              text += value;
              while (true) {
                const dataIdx = text.indexOf('data: ');
                if (dataIdx === -1) break;
                if (dataIdx === 0) {
                  text = text.substring(dataIdx + 6);
                  continue;
                }
                const data = text.substring(0, dataIdx).trim();
                if (data) {
                  text = text.substring(dataIdx + 6);
                  const json = JSON.parse(data) as DeltaResp;
                  const _role = json.choices[0]?.delta.role
                  if (_role) {
                    role = _role;
                  } else {
                    chunks.push(json);
                  }
                }
              }
            }
            const msg = chunks.map(msg => {
              return msg.choices[0]?.delta.content || '';
            }).join('');
            if (!v.done) {
              setPartialMsg(msg);
              read();
            } else {
              msgLine.push({
                msg: {
                  role,
                  content: msg
                },
                usage: {
                  token: 0,
                },
              });
              abort.current = undefined;
              setPartialMsg('');
              setMsgLine(msgLine.slice());
              setIsStreaming(false);
              store.set('messages', msgLine);
            }
          });
        }

        read();

      } catch (e: any) {
        console.error(e);
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
          setTimeout(() => {
            eventBus.on('ask', onAsk);
          });
        }
      });
      store.subscribe('api_token', (t) => {
        token = t;
        setApiToken(t);
        if (t) {
          systemMessage({
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
        msgLine[0].msg.content = prompt;
        setMsgLine(msgLine.slice());
      };
      const onAsk = (question: string) => {
        onInput(question);
      }
      eventBus.on('clear', clear);
      eventBus.on('prompt', setPrompt);
      return () => {
        eventBus.off('ask', onAsk);
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

    const [meta, setMeta] = useState({ temperature: 1, maxTokens: 0 });

    return <div style={{ position: 'absolute', inset: 0 }}>
      <Chat
        meta={meta}
        onChangeMeta={(temp, tokens) => setMeta({ temperature: temp, maxTokens: tokens })}
        partialMsg={partialMsg}
        onChange={onChangeMsg}
        error={isError}
        loading={isLoading}
        msgLine={msgLine}
        onInput={onInput} />
    </div>
  }
}

async function installed(ctx: AppInstallContext) {
  ctx.hooks.globalSearch.register(async ({ keyword: search, cb }) => {
    cb([{
      title: '发送以下问题',
      pre: search,
      onClick() {
        openFileBy('ChatGPT', search);
      }
    }]);
  });
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
  stream: boolean,
  temperature: number,
  max_tokens?: number,
}

interface DeltaChoice {
  "delta": {
    content?: string,
    role?: Role,
  },
  "index": number,
  "finish_reason": string | null
}

interface DeltaResp {
  id: string,
  object: string,
  created: number,
  model: string,
  choices: DeltaChoice[],
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


async function unmount(ctx: AppContext) {
  reactRoot.unmount();
}

function getAppInfo(): AppInfo {
  return {
    name: 'Chat',
    iconUrl,
    width: 800,
    height: 500,
    supportExts: [],
  }
}

defineApp({
  mount,
  unmount,
  installed,
  getAppInfo
})