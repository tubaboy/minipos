import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, LogOut, Lock, Smartphone, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function Login() {
  const navigate = useNavigate();

  // State
  const [storeId, setStoreId] = useState<string | null>(localStorage.getItem('velopos_store_id'));
  const [storeName, setStoreName] = useState<string | null>(localStorage.getItem('velopos_store_name'));
  const [deviceRole, setDeviceRole] = useState<string | null>(localStorage.getItem('velopos_device_role'));
  const [deviceToken, setDeviceToken] = useState<string | null>(localStorage.getItem('velopos_device_token'));

  // Binding Mode State (Pairing Code)
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  // POS Mode State (PIN)
  const [pin, setPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    // If we have a token but no storeId (e.g. page refresh), verify token
    if (deviceToken && !storeId) {
      verifyDeviceSession();
    }
  }, [deviceToken]);

  const verifyDeviceSession = async () => {
    if (!deviceToken) return;
    setLoadingSession(true);
    try {
      const { data, error } = await supabase.rpc('get_device_session', { p_device_token: deviceToken });
      
      if (error) throw error;
      
      // Update local storage just in case
      localStorage.setItem('velopos_store_id', data.store_id);
      localStorage.setItem('velopos_store_name', data.store_name);
      localStorage.setItem('velopos_device_role', data.role);
      localStorage.setItem('velopos_tenant_mode', data.tenant_mode);

      setStoreId(data.store_id);
      setStoreName(data.store_name);
      setDeviceRole(data.role);

    } catch (error) {
      // Invalid token (revoked?)
      toast.error('裝置憑證失效，請重新配對');
      handleUnbind(false); // Silent unbind
    } finally {
      setLoadingSession(false);
    }
  };

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pairingCode.length !== 6) {
      toast.error('請輸入6位數配對碼');
      return;
    }
    
    setIsPairing(true);
    try {
      // Get device name (User Agent / OS)
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;

      const { data, error } = await supabase.rpc('verify_pairing_code', {
        p_code: pairingCode,
        p_device_name: deviceName
      });

      if (error) throw error;

      // Success
      const { device_token, store_id, store_name, role, tenant_mode } = data;

      localStorage.setItem('velopos_device_token', device_token);
      localStorage.setItem('velopos_store_id', store_id);
      localStorage.setItem('velopos_store_name', store_name);
      localStorage.setItem('velopos_device_role', role);
      localStorage.setItem('velopos_tenant_mode', tenant_mode);

      setDeviceToken(device_token);
      setStoreId(store_id);
      setStoreName(store_name);
      setDeviceRole(role);

      toast.success('配對成功！');
    } catch (error: any) {
      toast.error('配對失敗', { description: error.message || '請確認配對碼是否正確或已過期' });
    } finally {
      setIsPairing(false);
    }
  };

  const handleUnbind = (confirmAction = true) => {
    if (confirmAction && !confirm('確定要解除此裝置綁定嗎？')) return;

    localStorage.removeItem('velopos_device_token');
    localStorage.removeItem('velopos_store_id');
    localStorage.removeItem('velopos_store_name');
    localStorage.removeItem('velopos_device_role');
    localStorage.removeItem('velopos_tenant_mode');
    localStorage.removeItem('velopos_employee'); // Also clear employee session
    
    setDeviceToken(null);
    setStoreId(null);
    setStoreName(null);
    setDeviceRole(null);
    setPin('');
  };

  // --- PIN Pad Logic ---
  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        handlePinLogin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinLogin = async (overridePin?: string) => {
    const pinToVerify = overridePin || pin;
    if (!pinToVerify || pinToVerify.length !== 4) return;
    setVerifyingPin(true);

    try {
      const { data, error } = await supabase.rpc('verify_employee_pin', { 
        p_store_id: storeId, 
        p_pin_code: pinToVerify 
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
      toast.error('登入失敗', { description: 'PIN 碼錯誤' });
      setPin('');
    } finally {
      setVerifyingPin(false);
    }
  };

  // --- Renders ---

  // 1. Loading State
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 2. Pairing Screen (No Store Bound)
  if (!storeId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 flex flex-col overflow-hidden relative">
          
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-blue-500" />

          <div className="flex items-center gap-4 mb-8">
            <Logo className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">裝置初始化</h1>
              <p className="text-slate-500 font-bold text-sm">Device Setup</p>
            </div>
          </div>

          <form onSubmit={handlePairing} className="space-y-6 animate-in slide-in-from-right">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 mb-2 block">
                請輸入 6 位數配對碼
              </label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                <input 
                  type="text" 
                  value={pairingCode}
                  onChange={e => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-3xl tracking-[0.5em] text-center text-slate-900 outline-none focus:border-slate-900 transition-all placeholder:text-slate-200"
                  placeholder="000000"
                  inputMode="numeric"
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-bold text-center">
                請由店長或總部後台產生配對碼
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={isPairing || pairingCode.length !== 6}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-lg shadow-lg shadow-slate-900/30 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPairing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>開始配對 <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button onClick={() => navigate('/admin/login')} className="text-xs font-bold text-slate-300 hover:text-slate-500 transition-colors">
              我是管理員 (前往後台)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. POS Login Screen (PIN)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-10 flex flex-col items-center relative">
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
          {[...Array(4)].map((_, i) => (
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