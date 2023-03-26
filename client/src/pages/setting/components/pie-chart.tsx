/**
 * A recreation of this demo: https://nivo.rocks/pie/
 */
import { Chart, Util } from '@antv/g2';
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@components/button';
import { useTheme } from '@hooks/common';
import { formatFileSize } from '@utils/formatter';


interface IProps {
  items: {
    size: number,
    name: string,
  }[];
}
export default function StoragePieChart(props: IProps) {
  const container = useRef<HTMLDivElement>(null);
  const [showType, setShowType] = useState(1);
  const total = useMemo(() => props.items.reduce((prev, item) => prev + item.size, 0), [props.items]);
  const totalSize = formatFileSize(total);
  const [theme] = useTheme();

  useEffect(() => {
    if (!container.current) return;


    let items: typeof props.items = [];
    if (showType === 0) {
      let t: Record<string, number> = {};
      for (let item of props.items) {
        let mainType = item.name.split('/')[0] || 'unknown';
        t[mainType] = (t[mainType] || 0) + item.size;
      }
      items = Object.keys(t).map(tt => ({
        name: tt,
        size: t[tt],
      }));
    } else {
      items = props.items;
    }

    const data = items.map((item) => {
      return {
        type: item.name,
        value: item.size / total,
        size: formatFileSize(item.size),
      }
    });
    const chart = new Chart({
      container: container.current,
      autoFit: true,
    });
    chart.data(data);

    chart.coordinate('theta', {
      radius: 0.70
    });
    chart.tooltip({
      showMarkers: false
    });

    chart
      .interval()
      .adjust('stack')
      .position('value')
      .color('type')
      .tooltip({
        fields: ['type', 'size'],
      })
      .state({
        active: {
          style: (element) => {
            const shape = element.shape;
            return {
              matrix: Util.zoom(shape, 1.1),
            }
          }
        }
      })
      .label('type', (val) => {
        return {
          offset: 20,
          style: {
            opacity: 1,
            fill: theme === 'dark' ? 'white' : 'black',
            fontSize: 10,
            shadowBlur: 3,
            shadowColor:  theme === 'dark' ? 'black' : 'white',
          },
          content: (obj) => {
            return obj.type + ' (' + obj.size + ')';
          },
        };
      });

    chart.interaction('element-single-selected');

    chart.render();

    return () => {
      chart.destroy();
    }
    // eslint-disable-next-line
  }, [props.items, showType, theme]);

  return <span style={{ display: 'inline-block' }}>
    <span>存储占用: {totalSize}</span>
    <Button onClick={() => setShowType((showType + 1) % 2)}>{showType === 0 ? '切换为细分类型(subtype)' : '切换为主要类型'}</Button>
    <div style={{ height: 350, width: 700 }} ref={container}></div>
  </span>
}