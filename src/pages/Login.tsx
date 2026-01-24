import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Lock, Store, ChevronRight, LogOut, Mail, Key, Loader2, ArrowRight, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function Login() {
  const navigate = useNavigate();

  // Mode: 'bind' (Admin Login -> Select Store) or 'pos' (Enter PIN)
  const [storeId, setStoreId] = useState<string | null>(localStorage.getItem('velopos_store_id'));
  const [storeName, setStoreName] = useState<string | null>(localStorage.getItem('velopos_store_name'));
  const [deviceRole, setDeviceRole] = useState<string | null>(localStorage.getItem('velopos_device_role'));

  // Bind Mode State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stores, setStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [tempBoundStore, setTempBoundStore] = useState<any | null>(null); // For mode selection step

  // POS Mode State
  const [pin, setPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  useEffect(() => {
    // If we are in bind mode and logged in as admin, fetch stores
    if (!storeId && isAdminLoggedIn) {
      fetchStores();
    }
  }, [storeId, isAdminLoggedIn]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      if (!user) throw new Error('登入失敗');

      // Check Role: Only Partner or Super Admin can bind devices
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('無法取得權限資訊');
      }

      if (profile.role !== 'partner' && profile.role !== 'super_admin') {
        await supabase.auth.signOut();
        throw new Error('權限不足：此功能僅限品牌總部帳號使用');
      }
      
      setIsAdminLoggedIn(true);
      toast.success('驗證成功，請選擇綁定門市');
    } catch (error: any) {
      toast.error('驗證失敗', { description: error.message || '請確認帳號密碼' });
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchStores = async () => {
    setLoadingStores(true);
    try {
      const { data, error } = await supabase.from('stores').select('*').order('created_at');
      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast.error('無法載入門市列表', { description: error.message });
    } finally {
      setLoadingStores(false);
    }
  };

  const handleSelectStore = async (store: any) => {
    setLoadingStores(true);
    try {
      // Fetch tenant mode
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('mode')
        .eq('id', store.tenant_id)
        .single();
      
      if (error) throw error;

      if (tenant.mode === 'single') {
        // Single mode defaults to POS role
        finalizeBinding(store, 'pos', 'single');
      } else {
        // Multi mode requires role selection
        setTempBoundStore({ ...store, tenant_mode: 'multi' });
      }
    } catch (error: any) {
      toast.error('讀取品牌設定失敗');
    } finally {
      setLoadingStores(false);
    }
  };

  const finalizeBinding = async (store: any, role: string, mode: string) => {
    // 1. Save Binding Info
    localStorage.setItem('velopos_store_id', store.id);
    localStorage.setItem('velopos_store_name', store.name);
    localStorage.setItem('velopos_device_role', role);
    localStorage.setItem('velopos_tenant_mode', mode);
    
    setStoreId(store.id);
    setStoreName(store.name);
    setDeviceRole(role);

    // 2. Logout Admin (Security)
    await supabase.auth.signOut();
    setIsAdminLoggedIn(false);
    setTempBoundStore(null);

    toast.success(`裝置已綁定至：${store.name} (${role === 'pos' ? '點餐機' : '廚房機'})`);
  };

  const handleUnbind = () => {
    if (confirm('確定要解除此裝置的分店綁定嗎？(需要重新登入總部帳號)')) {
      localStorage.removeItem('velopos_store_id');
      localStorage.removeItem('velopos_store_name');
      localStorage.removeItem('velopos_device_role');
      localStorage.removeItem('velopos_tenant_mode');
      setStoreId(null);
      setStoreName(null);
      setDeviceRole(null);
      setPin('');
      setIsAdminLoggedIn(false);
      setTempBoundStore(null);
    }
  };

  // --- PIN Pad Logic ---
  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinLogin = async () => {
    if (!pin) return;
    setVerifyingPin(true);

    try {
      const { data, error } = await supabase.rpc('verify_employee_pin', { 
        p_store_id: storeId, 
        p_pin_code: pin 
      });

      if (error) throw error;
      if (!data) throw new Error('PIN 碼錯誤或員工不存在');

      // Login success
      localStorage.setItem('velopos_employee', JSON.stringify(data));
      toast.success(`歡迎回來，${data.name}`);
      
      // Redirect based on device role
      if (deviceRole === 'kitchen') {
        navigate('/kitchen');
      } else {
        navigate('/pos');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('登入失敗', { description: 'PIN 碼錯誤或系統連線問題' });
      setPin('');
    } finally {
      setVerifyingPin(false);
    }
  };

  // --- Renders ---

  // 1. Bind Store Screen
  if (!storeId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 flex flex-col overflow-hidden relative">
          
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />

          <div className="flex items-center gap-4 mb-8">
            <Logo className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">VELO 裝置綁定</h1>
              <p className="text-slate-500 font-bold text-sm">Terminal Setup</p>
            </div>
          </div>

          {!isAdminLoggedIn ? (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-in slide-in-from-right">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">總部帳號 (Email)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-900 transition-all"
                    placeholder="partner@example.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">密碼</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-900 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loggingIn}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-lg shadow-lg shadow-slate-900/30 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {loggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <>登入並繼續 <ArrowRight className="w-5 h-5" /></>}
              </button>
            </form>
          ) : tempBoundStore ? (
            <div className="space-y-6 animate-in slide-in-from-right">
              <div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">已選擇門市：{tempBoundStore.name}</p>
                <h3 className="text-xl font-bold text-slate-900">請選擇此機台的角色</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => finalizeBinding(tempBoundStore, 'pos', 'multi')}
                  className="w-full p-6 flex items-center gap-4 bg-white border-2 border-slate-100 hover:border-teal-500 hover:bg-teal-50/30 rounded-2xl transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center group-hover:bg-teal-500 transition-colors">
                    <Coffee className="w-6 h-6 text-teal-600 group-hover:text-white" />
                  </div>
                  <div>
                    <p className="font-black text-lg text-slate-900">點餐收銀 (POS)</p>
                    <p className="text-xs text-slate-500 font-bold">負責櫃檯點餐、收款與發票列印</p>
                  </div>
                </button>

                <button
                  onClick={() => finalizeBinding(tempBoundStore, 'kitchen', 'multi')}
                  className="w-full p-6 flex items-center gap-4 bg-white border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50/30 rounded-2xl transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                    <Monitor className="w-6 h-6 text-orange-600 group-hover:text-white" />
                  </div>
                  <div>
                    <p className="font-black text-lg text-slate-900">廚房出單 (KDS)</p>
                    <p className="text-xs text-slate-500 font-bold">負責接收訂單、顯示製作狀態</p>
                  </div>
                </button>
              </div>
              
              <button onClick={() => setTempBoundStore(null)} className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-sm">返回重新選擇門市</button>
            </div>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-right">
              <p className="text-sm font-bold text-slate-500 mb-2">請選擇此裝置所屬分店：</p>
              {loadingStores ? (
                <div className="text-center py-10 text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />載入分店中...</div>
              ) : stores.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 font-bold">找不到分店資料</div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                  {stores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => handleSelectStore(store)}
                      className="w-full p-4 flex items-center justify-between bg-white border-2 border-slate-100 hover:border-teal-500 hover:bg-teal-50/30 rounded-xl transition-all group cursor-pointer text-left"
                    >
                      <div>
                        <p className="font-black text-slate-900 group-hover:text-teal-700">{store.name}</p>
                        <p className="text-xs text-slate-400 font-bold">{store.address || '無地址'}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setIsAdminLoggedIn(false)} className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-sm">取消 / 登出</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. POS Login Screen (PIN)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-10 flex flex-col items-center relative">
        <button 
          onClick={handleUnbind}
          className="absolute top-6 right-6 text-slate-300 hover:text-red-400 transition-colors p-2"
          title="解除綁定 (測試用)"
        >
          <LogOut className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <Logo className="w-20 h-20" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">VELO</h1>
        <div className="flex items-center gap-2 mb-10 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
          <Store className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-slate-600 text-xs font-black uppercase tracking-wider">{storeName}</p>
        </div>

        {/* PIN Display */}
        <div className="flex gap-4 mb-12">
          {[...Array(4)].map((_, i) => ( // Show 4 dots, but allow up to 6
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full transition-all duration-300 border-2",
                pin.length > i 
                  ? "bg-teal-500 border-teal-500 scale-110 shadow-lg shadow-teal-500/30" 
                  : "bg-transparent border-slate-200"
              )}
            />
          ))}
          {pin.length > 4 && <div className="flex items-center justify-center font-bold text-slate-400">+{pin.length - 4}</div>}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-5 w-full max-w-[300px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => (
            <button
              key={key}
              disabled={verifyingPin}
              onClick={() => {
                if (key === 'C') handleDelete();
                else if (key === 'OK') handlePinLogin();
                else handleNumberClick(key);
              }}
              className={cn(
                "h-20 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all active:scale-95 cursor-pointer outline-none select-none",
                key === 'OK' 
                  ? "bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-900/20" 
                  : "bg-white border-2 border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200"
              )}
            >
              {key === 'OK' ? (verifyingPin ? <Loader2 className="w-6 h-6 animate-spin" /> : <Lock className="w-6 h-6" />) : key}
            </button>
          ))}
        </div>
      </div>
      
      <p className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini Solutions</p>
    </div>
  );
}