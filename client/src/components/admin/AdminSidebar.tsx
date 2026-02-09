import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut,
  Shield,
  UserCog,
  Building2,
  UserCheck
} from "lucide-react";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Organizadores",
    url: "/admin/organizadores",
    icon: Building2,
    roles: ["superadmin", "admin"],
  },
  {
    title: "Eventos",
    url: "/admin/eventos",
    icon: Calendar,
  },
  {
    title: "Atletas",
    url: "/admin/atletas",
    icon: UserCheck,
    roles: ["superadmin", "admin"],
  },
  {
    title: "Usuários",
    url: "/admin/usuarios",
    icon: UserCog,
    roles: ["superadmin"],
  },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">KitRunner</span>
            <span className="text-xs text-muted-foreground">Painel Admin</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))
                .map((item) => {
                  const isActive = location === item.url || 
                    (item.url !== "/admin" && location.startsWith(item.url));
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        data-testid={`nav-${item.title.toLowerCase()}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium">{user?.nome}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="w-full"
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
