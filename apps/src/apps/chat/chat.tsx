export interface IProps {
  msgs: string[];
  onInput(msg: string): void;
}

export default function Chat(props: IProps) {
  return <div>
    <div>
      {
        props.msgs.map(msg => {
          return <div>{msg}</div>
        })
      }
    </div>
    <div>
      <input></input>
    </div>
  </div>
}