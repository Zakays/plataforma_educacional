import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ROUTE_PATHS } from "@/lib/index";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import MateriaDetail from "@/pages/MateriaDetail";
import AulaDetail from "@/pages/AulaDetail";
import AdminUpload from "@/pages/AdminUpload";
import AdminLogs from "@/pages/AdminLogs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTE_PATHS.HOME}
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.LOGIN}
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.REGISTER}
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.DASHBOARD}
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.MATERIA}
        element={
          <ProtectedRoute>
            <MateriaDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.AULA}
        element={
          <ProtectedRoute>
            <AulaDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_UPLOAD}
        element={
          <ProtectedRoute requireAdmin>
            <AdminUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_LOGS}
        element={
          <ProtectedRoute requireAdmin>
            <AdminLogs />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={ROUTE_PATHS.HOME} replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
