import style from './index.module.less'

export interface Props {
  record: RecordRec,
}

export interface RecordRec {
  [key: string | number]: string | number | RecordRec;
}

export default function RecordBlock(props: Props) {
  return <div>
    <Rec record={props.record} />
  </div>
}

function Rec(props: { record: RecordRec }) {
  const list = Object.entries(props.record);
  if (list.length === 0) return null;
  return <div className={style['record-rec']}>
    {
      list.map(([key, val]) => {
        const isRow = typeof val !== 'object' || val === null;
        if (!isRow && Object.keys(val).length === 0) return null;
        return isRow ?
          <div className={style['row']}>
            <span className={style.key}>{key}:</span>
            <span>{val}</span>
          </div>
          : <div>
            <div className={style.title}>{key}</div>
            <div className={style.block}>
              <Rec record={val} />
            </div>
          </div>
      })
    }
  </div>
}