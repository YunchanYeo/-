import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { loginAdmin } from '../api/admin';

export default function LoginPage() {
  const { token, setToken } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/products" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = await loginAdmin({ username: username.trim(), password });
      setToken(data.token);
      nav('/products', { replace: true });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
        background:
          'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(61,139,253,0.25), transparent), var(--bg)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 'clamp(1.1rem, 4vw, 1.35rem)' }}>管理员登录</h1>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
          请输入管理员账号与密码登录。
        </p>
        {err ? <div className="err-banner">{err}</div> : null}
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>账号</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.25rem' }}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
