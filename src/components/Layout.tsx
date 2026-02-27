import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';
import { Menu, X, LogOut, Home, BookOpen, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate(ROUTE_PATHS.LOGIN);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const navItems = [
    { to: ROUTE_PATHS.DASHBOARD, icon: Home, label: 'Dashboard' },
    ...(isAdmin()
      ? [
          { to: ROUTE_PATHS.ADMIN_UPLOAD, icon: Upload, label: 'Upload' },
          { to: ROUTE_PATHS.ADMIN_LOGS, icon: FileText, label: 'Logs' },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-sidebar-primary" />
              <span className="text-lg font-semibold text-sidebar-foreground">Plataforma</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3 rounded-lg bg-sidebar-accent/30 px-3 py-2">
              <p className="text-xs font-medium text-sidebar-foreground/70">Usuário</p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {profile?.nome || user?.email}
              </p>
              {isAdmin() && (
                <span className="mt-1 inline-block rounded bg-sidebar-primary px-2 py-0.5 text-xs font-medium text-sidebar-primary-foreground">
                  Admin
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 lg:p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
