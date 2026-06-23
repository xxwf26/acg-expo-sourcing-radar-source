import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import RadarDashboardPage from '@/pages/RadarDashboardPage';
import LoginPage from '@/pages/LoginPage';

export default function AppRoutes() {
  const { isLoggedIn } = useAuth();

  // 未登录：所有路由都进登录页
  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route index element={<RadarDashboardPage />} />
      <Route path="*" element={<RadarDashboardPage />} />
    </Routes>
  );
}
