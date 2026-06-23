import { Routes, Route } from 'react-router-dom';
import RadarDashboardPage from '@/pages/RadarDashboardPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<RadarDashboardPage />} />
      <Route path="*" element={<RadarDashboardPage />} />
    </Routes>
  );
}
