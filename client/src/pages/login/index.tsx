import React, { useState } from 'react';
import { LoginStatus, login } from '@apis/auth';
import style from './index.module.less';

const LoginPage: React.FC = () => {

  const [username, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [needOtp, setNeedOtp] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const status = await login(username, password, otpCode);
    if (status === LoginStatus.Success) {
      const url = new URL(window.location.href);
      const redirect = url.searchParams.get('redirect');
      if (redirect) {
        window.location.href = redirect;
      } else {
        window.location.href = '/';
      }
    } else if (status === LoginStatus.NeedOTPCode) {
      setNeedOtp(true);
    } else {
      window.alert('用户名不存在或密码错误');
    }
  }

  return <div className={style.container}>
    <form className={style.login} onSubmit={onSubmit}>
      <input name='username' type="text" placeholder="用户名" value={username} onChange={e => setUserName(e.target.value)} />
      <input name='password' type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
      {
        needOtp &&
        <input name='otpcode' type="text" placeholder="需要TOTP验证码" value={otpCode} onChange={e => setOtpCode(e.target.value)} />
      }
      <button>Login</button>
    </form>
  </div>
}

export default LoginPage;