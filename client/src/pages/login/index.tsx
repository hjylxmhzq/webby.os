import React, { useState } from 'react';
import { login } from '@apis/auth';
import style from './index.module.less';

const LoginPage: React.FC = () => {

  const [username, setUserName] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      const url = new URL(window.location.href);
      const redirect = url.searchParams.get('redirect');
      if (redirect) {
        window.location.href = redirect;
      } else {
        window.location.href = '/';
      }
    }
  }

  return <div className={style.container}>
    <form className={style.login} onSubmit={onSubmit}>
      <input name='username' type="text" placeholder="Username" value={username} onChange={e => setUserName(e.target.value)} />
      <input name='password' type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button>Login</button>
    </form>
  </div>
}

export default LoginPage;