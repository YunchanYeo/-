import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { fetchAdminMe, fetchSupportConversations, type AdminMe } from '../api/admin';

const NAV: { to: string; label: string; short: string }[] = [
  { to: '/products', label: '商品与库存', short: '商品' },
  { to: '/orders', label: '订单发货', short: '订单' },
  { to: '/categories', label: '分类', short: '分类' },
  { to: '/coupons', label: '优惠券', short: '券' },
  { to: '/promotions', label: '活动管理', short: '活动' },
  { to: '/settings', label: '账号设置', short: '设置' },
  { to: '/support', label: '客服会话', short: '客服' },
];

export default function Shell() {
  const { token, logout } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [supportUnreadTotal, setSupportUnreadTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchAdminMe(token)
      .then(setMe)
      .catch(() => {
        logout();
        nav('/login', { replace: true });
      });
  }, [token, logout, nav]);

  useEffect(() => {
    if (!token) {
      setSupportUnreadTotal(0);
      return;
    }
    let cancelled = false;
    const tick = () => {
      fetchSupportConversations(token)
        .then((rows) => {
          if (cancelled) return;
          const n = rows.reduce((s, r) => s + (Number(r.unreadCount) || 0), 0);
          setSupportUnreadTotal(n);
        })
        .catch(() => {
          if (!cancelled) setSupportUnreadTotal(0);
        });
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `shell-erp-navlink${isActive ? ' shell-erp-navlink--active' : ''}`;

  return (
    <div className="shell-erp shell-root">
      <aside className="shell-erp-sidebar" aria-label="侧栏导航">
        <div className="shell-erp-sidebar-brand">管理后台</div>
        <nav className="shell-erp-sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navCls}>
              <span className="shell-erp-navlink__short">{item.short}</span>
              <span className="shell-erp-navlink__label">{item.label}</span>
              {item.to === '/support' && supportUnreadTotal > 0 ? (
                <span className="shell-erp-nav-badge" title="用户未读消息">
                  {supportUnreadTotal > 99 ? '99+' : supportUnreadTotal}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="shell-erp-maincol">
        <header className="shell-erp-topbar">
          <div className="shell-erp-topbar-left">
            <span className="shell-erp-topbar-title">批发 / 订单中心</span>
            <span className="shell-erp-topbar-sub">订单查询 · 发货 · 导出</span>
          </div>
          <div className="shell-user">
            <span className="shell-erp-user-name" title={me?.username ?? ''}>
              {me?.username ?? '…'}
            </span>
            <button
              type="button"
              className="btn btn-ghost shell-erp-exit"
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              退出
            </button>
          </div>
        </header>
        <main className="shell-erp-main shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
