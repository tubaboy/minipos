import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import POS from './pages/POS';
import Kitchen from './pages/Kitchen';
import Admin from './pages/Admin';
import AdminLogin from './pages/admin/login/AdminLogin';

const queryClient = new QueryClient();

// Simple Protected Route Component
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null; // Or a spinner
  if (!session) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" richColors />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route 
            path="/admin/*" 
            element={
              <ProtectedAdminRoute>
                <Admin />
              </ProtectedAdminRoute>
            } 
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
