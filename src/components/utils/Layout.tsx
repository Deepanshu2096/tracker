import { Link, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger } from "@/components/ui/sidebar";
import { Users, LayoutDashboard, Clock, List, Calendar, Activity, History } from "lucide-react";
import { NavUser } from "@/components/nav-user";
import { ROUTES_FRONTEND } from "@/constant";
import { useAuth } from "@/hooks/useAuth";

type SidebarProps = {
  userRole: string | null
}

function AppSidebar({ userRole }: SidebarProps) {
  const location = useLocation();

  console.log("userRole", userRole)
  // Build menu items based on user role
  const menuItems = [
    { title: "Dashboard", id: "dashboard", icon: LayoutDashboard, path: ROUTES_FRONTEND.DASHBOARD },
    ...(userRole === 'admin' || userRole === 'manager'
      ? [
          { title: "Team", id: "team", icon: Users, path: ROUTES_FRONTEND.TEAM },
          { title: "Active Sessions", id: "active-sessions", icon: Activity, path: ROUTES_FRONTEND.TIME_TRACKING },
          { title: "Attendance", id: "attendance", icon: Calendar, path: ROUTES_FRONTEND.ATTENDANCE },
          { title: "Activity Logs", id: "activity-logs", icon: List, path: ROUTES_FRONTEND.ACTIVITY_LOGS },
        ]
      : []),
    { title: "Time Tracking", id: "time-tracking", icon: Clock, path: ROUTES_FRONTEND.TIME_TRACKING },
    { title: "Session History", id: "session-history", icon: History, path: ROUTES_FRONTEND.SESSION_HISTORY },
  ];
  return (
    <Sidebar className="text-foreground border-r border-border" style={{ backgroundColor: 'oklch(98.5% 0 0)' }}>
      {/* Header */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <img src="/B-logo.svg" alt="BergFlow Logo" className="h-10 mt-2 w-auto text-primary my-auto rotate-y-180" /> 
          </div>
          <div className="leading-tight">
            <span className="block text-lg font-semibold text-foreground">
              Anvesana
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground">
              by BergAi
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Menu */}
      <SidebarContent>
        <SidebarGroup>
         
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className={isActive ? 'text-foreground' : ''}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/50 px-4 py-4">
        <NavUser />
      </SidebarFooter>

    </Sidebar>
  );
}

const Dashboard = () => {
  const { userRole } = useAuth()
  
  // Function to get role badge styling
  const getRoleBadge = (role: string | null) => {
    if (!role) return null

    const roleStyles: Record<string, { label: string; classes: string }> = {
      admin: {
        label: 'Admin',
        classes: 'bg-rose-100 text-rose-600 border border-rose-200',
      },
      manager: {
        label: 'Manager',
        classes: 'bg-sky-100 text-sky-600 border border-sky-200',
      },
      reviewer: {
        label: 'Reviewer',
        classes: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
      },
      annotator: {
        label: 'Annotator',
        classes: 'bg-amber-100 text-amber-600 border border-amber-200',
      },
    }

    const { label, classes } = roleStyles[role] || {
      label: role,
      classes: 'bg-slate-100 text-slate-600 border border-slate-200',
    }

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${classes}`}
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
        {label}
      </span>
    )
  }
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-white">
        <AppSidebar userRole={userRole} />
        <main className="flex-1 bg-white">
          {/* Top nav bar */}
            <div className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
              <div className="flex h-14 w-full items-center justify-between px-6">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  {userRole ? (
                    getRoleBadge(userRole)
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Guest
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Routed page */}
            <div className="p-7">
              <Outlet />
            </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
