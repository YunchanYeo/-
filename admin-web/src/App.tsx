import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/Login';
import Shell from './pages/Shell';
import ProductsPage from './pages/Products';
import ProductFormPage from './pages/ProductFormPage';
import OrdersPage from './pages/Orders';
import CategoriesPage from './pages/Categories';
import SupportChatPage from './pages/SupportChat';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
