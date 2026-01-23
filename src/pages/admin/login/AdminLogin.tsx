import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowRight, Store } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in (check for session)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/admin');
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check profile role to ensure it's an admin-level user
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          // If no profile found (rare case if triggered correctly), maybe logout or warn
          console.error('Profile fetch error', profileError);
        }

        const role = profile?.role;
        
        // Allowed roles for Admin Panel
        const allowedRoles = ['super_admin', 'partner', 'store_manager'];
        
        if (!allowedRoles.includes(role)) {
          await supabase.auth.signOut();
          toast.error('權限不足', { description: '此帳號無法存取管理後台' });
        } else {
          toast.success('登入成功');
          navigate('/admin');
        }
      }
    } catch (err: any) {
      toast.error('登入失敗', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-12 relative overflow-hidden">
        {/* Decorative background blob */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="mb-10 text-center relative z-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-6">
            <LayoutDashboard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">MiniPOS Admin</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">後台管理系統</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 focus:border-primary focus:outline-none focus:bg-white transition-all placeholder:text-slate-300"
              placeholder="admin@minipos.com"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 focus:border-primary focus:outline-none focus:bg-white transition-all placeholder:text-slate-300"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-8 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>登入系統</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 text-center">
          <button 
             onClick={() => navigate('/login')}
             className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <Store className="w-3 h-3" />
            切換至 POS 前台模式
          </button>
        </div>
      </div>
    </div>
  );
}
