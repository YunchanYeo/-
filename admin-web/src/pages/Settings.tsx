import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { createAdminAccount, fetchAdminMe, updateAdminPassword, updateAdminUsername } from '../api/admin';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { token, logout } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createCurrentPassword, setCreateCurrentPassword] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const me = await fetchAdminMe(token);
      setUsername(me.username || '');
      setNewUsername(me.username || '');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function forceRelogin(message: string) {
    setOk(message);
    logout();
    nav('/login', { replace: true });
  }

  async function onSubmitUsername(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const next = newUsername.trim();
    if (!currentPassword || !next) {
      setErr('请输入当前密码和新ID');
      setOk('');
      return;
    }
    setSaving(true);
    setErr('');
    setOk('');
    try {
      const me = await updateAdminUsername(token, {
        currentPassword,
        newUsername: next,
      });
      setUsername(me.username || next);
      setNewUsername(me.username || next);
      setCurrentPassword('');
      await forceRelogin('ID已更新，请重新登录');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '修改ID失败');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!currentPassword || !newPassword) {
      setErr('请输入当前密码和新密码');
      setOk('');
      return;
    }
    setSaving(true);
    setErr('');
    setOk('');
    try {
      await updateAdminPassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      await forceRelogin('密码已更新，请重新登录');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '修改密码失败');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitCreateAdmin(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const nextUsername = createUsername.trim();
    if (!createCurrentPassword || !nextUsername || !createPassword) {
      setErr('请填写当前密码、新管理员用户名与初始密码');
      setOk('');
      return;
    }
    setSaving(true);
    setErr('');
    setOk('');
    try {
      const created = await createAdminAccount(token, {
        currentPassword: createCurrentPassword,
        username: nextUsername,
        password: createPassword,
      });
      setCreateUsername('');
      setCreatePassword('');
      setCreateCurrentPassword('');
      setOk(`管理员账号已创建：${created.username}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建管理员失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.25rem' }}>账号设置</h2>
      {err ? <div className="err-banner">{err}</div> : null}
      {ok ? <div style={{ color: '#128a42', fontSize: '0.875rem' }}>{ok}</div> : null}
      <form className="card" onSubmit={onSubmitUsername} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>修改ID</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>当前ID：{username || '—'}</div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>当前密码</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>新ID</span>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <button className="btn btn-ghost" type="submit" disabled={loading || saving}>
          {saving ? '保存中…' : '修改ID（会重新登录）'}
        </button>
      </form>
      <form className="card" onSubmit={onSubmitPassword} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>修改密码</h3>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>当前密码</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>新密码</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading || saving}>
          {saving ? '保存中…' : '修改密码（会重新登录）'}
        </button>
      </form>
      <form className="card" onSubmit={onSubmitCreateAdmin} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>创建管理员账号</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
          使用当前登录管理员的密码验证是否具备创建权限。
        </div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>当前密码（权限验证）</span>
          <input
            type="password"
            value={createCurrentPassword}
            onChange={(e) => setCreateCurrentPassword(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>新管理员用户名</span>
          <input
            type="text"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>初始密码</span>
          <input
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            disabled={loading || saving}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading || saving}>
          {saving ? '创建中…' : '创建管理员'}
        </button>
      </form>
    </div>
  );
}
