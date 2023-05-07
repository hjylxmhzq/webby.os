import { useState } from "react";
import style from './index.module.less';

export interface Props {
  onChange(digits: (number | undefined)[]): void;
  length: number;
}

export default function DigitInput(props: Props) {
  let [digits, setDigits] = useState<string[]>(Array.from({ length: props.length }).map(() => ''));
  return <div style={{ display: 'inline-flex' }}>
    {
      Array.from({ length: props.length }).map((_, idx) => {
        return <div tabIndex={0} className={style.digit} onKeyDown={e => {
          const el = e.target as HTMLDivElement;
          const nextEl = el.nextElementSibling as HTMLInputElement | null;
          const key = e.key;
          if (key.length === 1 && !Number.isNaN(Number(key))) {
            if (nextEl) {
              nextEl.focus();
            }
            digits[idx] = key;
            setDigits([...digits]);
            props.onChange(digits.map(d => d.length ? Number(d) : undefined));
          }
          if (key === 'Backspace') {
            digits[idx] = '';
            const prevEl = el.previousElementSibling as HTMLInputElement | null;
            if (prevEl) {
              prevEl.focus();
            }
            setDigits([...digits]);
            props.onChange(digits.map(d => d.length ? Number(d) : undefined));
          }
        }}>{digits[idx]}</div>
      })
    }
  </div>
}
