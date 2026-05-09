import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function PasswordChangeGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, profile, isLoading } = useAuth();

  if (isLoading || !user || !profile) {
    return <>{children}</>;
  }

  const isAllowedPath = location.pathname === '/auth' || location.pathname === '/change-password';

  if (profile.must_change_password && !isAllowedPath) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
