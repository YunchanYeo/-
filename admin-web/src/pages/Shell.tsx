import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { fetchAdminMe, type AdminMe } from '../api/admin';

const navStyle: CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  padding: '0.45rem 0.85rem',
  borderRadius: 8,
  textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--muted)',
  background: isActive ? 'var(--accent)' : 'transparent',
  fontSize: '0.875rem',
  fontWeight: isActive ? 600 : 400,
});

export default function Shell() {
  const { token, logout } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAdminMe(token)
      .then(setMe)
      .catch(() => {
        logout();
        nav('/login', { replace: true });
      });
  }, [token, logout, nav]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={navStyle}>
          <strong style={{ marginRight: '0.75rem', fontSize: '0.95rem' }}>管理员后台 · PC</strong>
          <NavLink to="/products" style={linkStyle}>
            商品与库存
          </NavLink>
          <NavLink to="/orders" style={linkStyle}>
            订单发货
          </NavLink>
          <NavLink to="/categories" style={linkStyle}>
            分类
          </NavLink>
          <NavLink to="/coupons" style={linkStyle}>
            优惠券
          </NavLink>
          <NavLink to="/settings" style={linkStyle}>
            账号设置
          </NavLink>
          <NavLink to="/support" style={linkStyle}>
            客服会话
          </NavLink>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--muted)' }}>{me?.username ?? '…'}</span>
          <button type="button" className="btn btn-ghost" onClick={() => { logout(); nav('/login'); }}>
            退出
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '1.25rem', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
