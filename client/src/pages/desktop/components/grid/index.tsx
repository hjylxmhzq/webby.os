import React, { HTMLAttributes, useEffect, useRef, useState } from "react";
import style from './index.module.less';
import { ContextMenu, SmartImage } from "@webby/components";
import { Motion, spring } from 'react-motion';
import { useCallback } from "react";
import { commonCollection } from "@webby/core/kv-storage";
import { debounce } from "src/utils/common";

interface Props {
  itemSize: number,
  apps: {
    name: string,
    icon: string,
    text: string,
  }[];
  onStartApp: (app: string, newWindow?: boolean) => void;
}

interface AppItem {
  x: number,
  y: number,
  name: string,
  icon: string,
  text: string,
}

const springSetting = { stiffness: 120, damping: 15 };

type InnerAppItem = AppItem & { moving?: { offsetX: number, offsetY: number } };

const store = commonCollection.desktop;

export function DesktopIconGrid(props: Props) {
  const itemSize = props.itemSize;

  const container = useRef<HTMLDivElement>(null);
  const preventClick = useRef(false);
  const [appItems, setAppItems] = useState<InnerAppItem[]>([]);
  const [pressedApp, setPressedApp] = useState<InnerAppItem>();
  const insertedIdx = useRef(-1);
  const [grid, setGrid] = useState<{ rows: number, cols: number }>({ rows: 0, cols: 0 });
  const [appOrder, setAppOrder] = useState<{ [id: string]: number }>({});

  const placeApps = useCallback(() => {
    const { rows } = grid;
    if (!rows) return;
    const _appItems: AppItem[] = [];
    const apps = props.apps.slice().sort((a1, a2) => {
      const i1 = appOrder[a1.name];
      const i2 = appOrder[a2.name];
      if (i1 !== undefined && i1 !== undefined) {
        return i1 - i2;
      }
      return 0;
    });
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const row = i % rows;
      const col = i / rows >> 0;
      const x = col * itemSize;
      const y = row * itemSize;
      _appItems.push({
        ...app,
        x, y,
      });
    }
    setAppItems(_appItems);
  }, [props.apps, grid, appOrder, itemSize]);

  useEffect(() => {

    const calOrder = () => {
      const order = props.apps.reduce((o: any, next, idx) => {
        o[next.name] = idx;
        return o;
      }, {});
      return order;
    };

    (async () => {
      let order = await store.get('appOrder');
      if (!order) {
        order = calOrder();
        setAppOrder(order);
        store.set('appOrder', order);
      } else {
        setAppOrder(order);
      }
    })();
  }, [props.apps]);


  useEffect(() => {
    const calGrid = () => {
      let el = container.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const rows = height / itemSize >> 0;
      const cols = width / itemSize >> 0;
      setGrid({ cols, rows });
    };
    calGrid();
    const debounced = debounce(calGrid, 100);
    window.addEventListener('resize', debounced);
    return () => {
      window.removeEventListener('resize', debounced);
    };
  }, [itemSize]);

  useEffect(() => {
    placeApps();
  }, [grid, placeApps, appOrder]);

  useEffect(() => {
    if (!pressedApp) return;

    const mouseUp = (e: MouseEvent) => {
      if (!pressedApp) return;
      if (insertedIdx.current !== -1) {
        const idx = insertedIdx.current;
        if (idx < appItems.length) {
          const oIdx = appItems.indexOf(pressedApp);
          appItems.splice(oIdx, 1);
          appItems.splice(idx, 0, pressedApp);
        }
        for (let i = 0; i < appItems.length; i++) {
          const app = appItems[i];
          appOrder[app.name] = i;
        }
      }
      store.set('appOrder', appOrder);
      setAppOrder({ ...appOrder });
      setPressedApp(undefined);
      placeApps();
    };

    const repositionApps = (apps: InnerAppItem[]) => {
      let i = 0;
      const { rows } = grid;
      if (pressedApp) {
        const row = (pressedApp.y + itemSize / 2) / itemSize >> 0;
        const col = (pressedApp.x + itemSize / 2) / itemSize >> 0;
        insertedIdx.current = col * rows + row;
      }
      for (let appIdx = 0; appIdx < apps.length; appIdx++) {
        if (insertedIdx.current === i) {
          appIdx -= 1;
          i += 1;
          continue;
        }
        const app = apps[appIdx];
        if (app === pressedApp) continue;
        const row = i % rows;
        const col = i / rows >> 0;
        const x = col * itemSize;
        const y = row * itemSize;
        i += 1;
        app.x = x;
        app.y = y;
      }
      return apps;
    };
    const mouseMove = (e: MouseEvent) => {
      if (pressedApp) {
        preventClick.current = true;
        setAppItems((apps) => {
          if (pressedApp?.moving) {
            const { offsetX, offsetY } = pressedApp.moving;
            pressedApp.x = e.screenX + offsetX;
            pressedApp.y = e.screenY + offsetY;
          }
          repositionApps(apps);
          return [...apps];
        });
      }
    };

    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('mousemove', mouseMove);

    return () => {
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('mousemove', mouseMove);
    }
  }, [pressedApp, placeApps, grid, appOrder, appItems, itemSize]);

  return <div ref={container} className={style['grid-container']}>
    {
      appItems.map(app => {
        const onMouseDown = (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          insertedIdx.current = -1;
          const { screenX, screenY } = e;
          const offsetX = app.x - screenX;
          const offsetY = app.y - screenY;
          app.moving = {
            offsetX,
            offsetY,
          };
          setPressedApp(app);
        }
        let style;
        if (pressedApp === app) {
          style = {
            translateX: app.x,
            translateY: app.y,
          }
        } else {
          style = {
            translateX: spring(app.x, springSetting),
            translateY: spring(app.y, springSetting),
          }
        }
        return <Motion key={app.text} style={style}>
          {
            ({ translateX, translateY }) => {
              return <GridItem
                onStartInNewWindow={() => {
                  props.onStartApp(app.name, true)
                }}
                onStartApp={() => {
                  props.onStartApp(app.name)
                }}
                onMouseDown={onMouseDown}
                onClick={() => {
                  if (preventClick.current) {
                    preventClick.current = false;
                    return;
                  }
                  props.onStartApp(app.name)
                }}
                name={app.name}
                size={itemSize}
                x={translateX}
                y={translateY}
                icon={app.icon}
                text={app.text}
              />
            }
          }
        </Motion>
      })
    }
  </div>
}

type GridItemProps = {
  size: number;
  onStartApp(): void;
  onStartInNewWindow(): void;
} & AppItem & HTMLAttributes<HTMLDivElement>;

function GridItem(props: GridItemProps) {
  return <ContextMenu
    menu={[{
      name: '打开应用',
      icon: 'play',
      onClick() {
        props.onStartApp();
      },
    }, {
      name: '在独立窗口中打开',
      icon: 'windows',
      onClick() {
        props.onStartInNewWindow();
      }
    }]}
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: props.size, height: props.size, transform: `translate(${props.x}px,${props.y}px)`
    }}>
    <div
      {...props}
      draggable="false"
      tabIndex={0}
      className={style['grid-item']}
      style={{ width: '100%', height: '100%' }}
    >
      <div className={style['grid-item-img']} style={{ height: props.size - 20 }}>
        <SmartImage
          style={{ width: props.size * 0.6, height: props.size * 0.6 }}
          draggable="false"
          src={props.icon}>
        </SmartImage>
      </div>
      <div className={style['grid-item-text']}>{props.text}</div>
    </div>
  </ContextMenu>
}