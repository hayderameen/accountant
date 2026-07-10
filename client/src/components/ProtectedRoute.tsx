import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppLoadingScreen } from './Skeleton';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <AppLoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
