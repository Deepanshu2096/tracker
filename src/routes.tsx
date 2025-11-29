import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES_FRONTEND } from './constant';

import Login from './components/pages/Login';
import Signup from './components/pages/Signup';
import Invite from './components/pages/Invite';
import Layout from './components/utils/Layout';

import Dashboard from './components/pages/Dashboard'
import Team from './components/pages/Team';
import TimeTracking from './components/pages/TimeTracking';
import ActivityLogs from './components/pages/ActivityLogs';
import Attendance from './components/pages/Attendance';
import SessionHistory from './components/pages/SessionHistory';

import { PrivateRoute } from './components/utils/PrivateRoute';
import { RoleBasedRoute } from './components/utils/RoleBasedRoute';

export const router = createBrowserRouter([
  {
    path: ROUTES_FRONTEND.LOGIN,
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/invite/:token",
    element: <Invite />,
  },
  {
    path: "/",
    element: <PrivateRoute />,
    children: [
      {
        path: "/",
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          {
            path: ROUTES_FRONTEND.DASHBOARD,
            element: <Dashboard />,
          },
          {
            path: ROUTES_FRONTEND.TIME_TRACKING,
            element: <TimeTracking />,
          },
          {
            path: ROUTES_FRONTEND.SESSION_HISTORY,
            element: <SessionHistory />,
          },
          // Admin/Manager only routes
          {
            element: <RoleBasedRoute allowedRoles={['admin', 'manager']} />,
            children: [
              {
                path: ROUTES_FRONTEND.TEAM,
                element: <Team />,
          },
          {
            path: ROUTES_FRONTEND.ACTIVITY_LOGS,
            element: <ActivityLogs />,
              },
              {
                path: ROUTES_FRONTEND.ATTENDANCE,
                element: <Attendance />,
              },
            ],
          },
          {
            path: "*",
            element: <Navigate to={ROUTES_FRONTEND.DASHBOARD} replace />,
          },
        ],
      },
    ],
  },
]);