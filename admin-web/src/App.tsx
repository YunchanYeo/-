import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/Login';
import Shell from './pages/Shell';

const ProductsPage = lazy(() => import('./pages/Products'));
const ProductFormPage = lazy(() => import('./pages/ProductFormPage'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const SupportChatPage = lazy(() => import('./pages/SupportChat'));
const CouponsPage = lazy(() => import('./pages/Coupons'));
const PromotionsPage = lazy(() => import('./pages/Promotions'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Shell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="support" element={<SupportChatPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
