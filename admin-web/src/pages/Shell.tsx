import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { fetchAdminMe, type AdminMe } from '../api/admin';

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

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `shell-nav-link${isActive ? ' shell-nav-link--active' : ''}`;

  return (
    <div className="shell-root">
      <header className="shell-header">
        <div className="shell-header-inner">
          <strong className="shell-brand">管理员后台</strong>
          <nav className="shell-nav" aria-label="主导航">
            <NavLink to="/products" className={navCls} end={false}>
              商品与库存
            </NavLink>
            <NavLink to="/orders" className={navCls}>
              订单发货
            </NavLink>
            <NavLink to="/categories" className={navCls}>
              分类
            </NavLink>
            <NavLink to="/coupons" className={navCls}>
              优惠券
            </NavLink>
            <NavLink to="/settings" className={navCls}>
              账号设置
            </NavLink>
            <NavLink to="/support" className={navCls}>
              客服会话
            </NavLink>
          </nav>
          <div className="shell-user">
            <span style={{ color: 'var(--muted)' }} title={me?.username ?? ''}>
              {me?.username ?? '…'}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
