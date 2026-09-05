import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/store';
import type { Role } from '../lib/db';

import Login from '../pages/Login';
import Shell from '../components/Shell';
import PatientDashboard from '../pages/patient/PatientDashboard';
import Booking from '../pages/patient/Booking';
import Payment from '../pages/patient/Payment';
import MyQueue from '../pages/patient/MyQueue';
import MedicalQueue from '../pages/medical/MedicalQueue';
import Activities from '../pages/medical/Activities';
import Stats from '../pages/medical/Stats';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Accounts from '../pages/admin/Accounts';
import Services from '../pages/admin/Services';
import GlobalQueue from '../pages/admin/GlobalQueue';
import WaitingRoom from '../pages/WaitingRoom';

function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'medical') return <Navigate to="/medical" replace />;
    return <Navigate to="/patient" replace />;
  }
  return <Outlet />;
}

function RedirectByRole() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'medical') return <Navigate to="/medical" replace />;
  return <Navigate to="/patient" replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <RedirectByRole /> },
  { path: '/login', element: <Login /> },
  { path: '/waiting-room', element: <WaitingRoom /> },
  {
    element: <RequireAuth roles={['patient']} />,
    children: [{
      path: '/patient',
      element: <Shell />,
      children: [
        { index: true, element: <PatientDashboard /> },
        { path: 'discover', element: <PatientDashboard /> },
        { path: 'booking/:serviceId', element: <Booking /> },
        { path: 'payment/:ticketId', element: <Payment /> },
        { path: 'queue', element: <MyQueue /> },
      ],
    }],
  },
  {
    element: <RequireAuth roles={['medical']} />,
    children: [{
      path: '/medical',
      element: <Shell />,
      children: [
        { index: true, element: <MedicalQueue /> },
        { path: 'activities', element: <Activities /> },
        { path: 'stats', element: <Stats /> },
      ],
    }],
  },
  {
    element: <RequireAuth roles={['admin']} />,
    children: [{
      path: '/admin',
      element: <Shell />,
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: 'accounts', element: <Accounts /> },
        { path: 'services', element: <Services /> },
        { path: 'global-queue', element: <GlobalQueue /> },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
