import { Link, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger } from "@/components/ui/sidebar";
import { Users, LayoutDashboard, Fingerprint } from "lucide-react";
import { NavUser } from "@/components/nav-user";
import { ROUTES_FRONTEND } from "@/constant";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { title: "Dashboard", id: "dashboard", icon: LayoutDashboard, path: ROUTES_FRONTEND.DASHBOARD },
  { title: "Team", id: "team", icon: Users, path: ROUTES_FRONTEND.TEAM },
];

function AppSidebar() {
  const location = useLocation();
  return (
    <Sidebar className="bg-white text-foreground border-r border-border">
      {/* Header */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Fingerprint className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <span className="block text-lg font-semibold text-foreground">
              BergFlow
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground">
              by BergAI
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

    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      'manager': { label: 'Manager', variant: 'default' },
      'admin': { label: 'Admin', variant: 'destructive' },
      'annotator': { label: 'Annotator', variant: 'secondary' },
      'reviewer': { label: 'Reviewer', variant: 'outline' }
    };
    
    const config = roleMap[role] || { label: role, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AppSidebar />
        <main className="flex-1 bg-background">
          {/* Top nav bar */}
            <div className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
              <div className="flex h-14 w-full items-center justify-between px-6">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  {userRole ? getRoleBadge(userRole) : <Badge variant="outline" className="mx-3 text-lg">Guest</Badge>}
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
