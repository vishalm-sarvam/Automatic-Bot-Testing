import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import {
  FlaskConical,
  LayoutDashboard,
  Settings,
  FileJson,
  Play,
  LogOut,
  User,
  BarChart3,
  ScrollText,
  Volume2
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { googleLogout } from '@react-oauth/google';

function RootLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    googleLogout();
    logout();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Neubrutalist */}
      <aside className="w-64 bg-card flex flex-col border-r-2 border-foreground">
        <div className="p-4 border-b-2 border-foreground bg-secondary">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Bot Tester</span>
          </div>
        </div>

        <nav className="flex-1 py-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            to="/config"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <FileJson className="h-4 w-4" />
            Bot Config
          </Link>
          <Link
            to="/scenarios"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <Play className="h-4 w-4" />
            Test Scenarios
          </Link>
          <Link
            to="/voice-test"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <Volume2 className="h-4 w-4" />
            Voice Testing
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
          <Link
            to="/logs"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground border-b border-foreground/10"
          >
            <ScrollText className="h-4 w-4" />
            Log Analyzer
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>

        {/* User section */}
        <div className="p-4 border-t-2 border-foreground bg-muted">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 border-2 border-foreground"
              />
            ) : (
              <div className="h-8 w-8 bg-primary flex items-center justify-center border-2 border-foreground">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-outline w-full justify-center gap-2 text-sm h-9"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Dev tools */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
