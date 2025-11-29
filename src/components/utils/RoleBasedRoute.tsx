import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES_FRONTEND } from '@/constant';

type RoleBasedRouteProps = {
  allowedRoles: string[];
  redirectTo?: string;
};

/**
 * RoleBasedRoute component that restricts access to routes based on user roles
 * @param allowedRoles - Array of roles that are allowed to access this route
 * @param redirectTo - Optional redirect path if user doesn't have access (defaults to dashboard)
 */
export function RoleBasedRoute({ allowedRoles, redirectTo = ROUTES_FRONTEND.DASHBOARD }: RoleBasedRouteProps) {
  const { user, userRole, loading } = useAuth();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to={ROUTES_FRONTEND.LOGIN} replace />;
  }

  // If user has a role and it's in allowed roles, grant access
  if (userRole && allowedRoles.includes(userRole)) {
    return <Outlet />;
  }

  // If user doesn't have required role, redirect
  return <Navigate to={redirectTo} replace />;
}


