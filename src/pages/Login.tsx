import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Lock, Store, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [pin, setPin] = useState('');
  const [storeId, setStoreId] = useState<string | null>(localStorage.getItem('minipos_store_id'));
  const [storeName, setStoreName] = useState<string | null>(localStorage.getItem('minipos_store_name'));
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!storeId) {
      fetchStores();
    }
  }, [storeId]);

  const fetchStores = async () => {
    const { data, error } = await supabase.from('stores').select('*');
    if (data) setStores(data);
    if (error) toast.error('無法載入分店資料');
  };

  const handleBindStore = (store: any) => {
    localStorage.setItem('minipos_store_id', store.id);
    localStorage.setItem('minipos_store_name', store.name);
    setStoreId(store.id);
    setStoreName(store.name);
    toast.success(`裝置已綁定至：${store.name}`);
  };

  const handleUnbind = () => {
    if (confirm('確定要解除此裝置的分店綁定嗎？')) {
      localStorage.removeItem('minipos_store_id');
      localStorage.removeItem('minipos_store_name');
      setStoreId(null);
      setStoreName(null);
      setPin('');
      fetchStores();
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (!pin) return;
    setLoading(true);

    try {
      // Authenticate against employees table
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('store_id', storeId)
        .eq('pin_code', pin)
        .single();

      if (error || !data) {
        throw new Error('員工 PIN 碼錯誤');
      }

      // Login success
      localStorage.setItem('minipos_employee', JSON.stringify(data));
      toast.success(`歡迎回來，${data.name}`);
      navigate('/pos');
    } catch (err: any) {
      toast.error(err.message || '登入失敗', {
        description: '請確認您輸入的是正確的分店員工 PIN 碼',
      });
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  if (!storeId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8 flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center border border-teal-100">
              <Store className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">裝置綁定</h1>
              <p className="text-slate-500 text-sm">請選擇此裝置所屬的分店</p>
            </div>
          </div>

          <div className="space-y-3">
            {stores.map(store => (
              <button
                key={store.id}
                onClick={() => handleBindStore(store)}
                className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-white border border-slate-200 hover:border-teal-500 rounded-xl transition-all group cursor-pointer text-left"
              >
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-teal-700">{store.name}</p>
                  <p className="text-xs text-slate-500">{store.address}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500" />
              </button>
            ))}
            {stores.length === 0 && (
              <p className="text-center text-slate-400 py-8">找不到分店資料</p>
            )}
          </div>
        </div>
        <p className="mt-8 text-xs font-medium text-slate-400">系統初始設定模式</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      {/* Clean SaaS Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8 flex flex-col items-center relative">
        <button 
          onClick={handleUnbind}
          className="absolute top-4 right-4 text-slate-300 hover:text-red-400 transition-colors p-2"
          title="解除綁定 (測試用)"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 bg-teal-50 rounded-xl flex items-center justify-center mb-6 border border-teal-100">
          <Coffee className="w-8 h-8 text-teal-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">MiniPOS 點餐系統</h1>
        <div className="flex items-center gap-2 mb-8 bg-slate-100 px-3 py-1 rounded-full">
          <Store className="w-3 h-3 text-slate-500" />
          <p className="text-slate-600 text-xs font-bold">{storeName}</p>
        </div>

        {/* PIN Display */}
        <div className="flex gap-4 mb-10">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-3.5 h-3.5 rounded-full transition-all duration-300",
                pin.length > i 
                  ? "bg-teal-600 scale-110 shadow-sm shadow-teal-600/30" 
                  : "bg-slate-200"
              )}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => (
            <button
              key={key}
              disabled={loading}
              onClick={() => {
                if (key === 'C') handleDelete();
                else if (key === 'OK') handleLogin();
                else handleNumberClick(key);
              }}
              className={cn(
                "h-16 rounded-xl flex items-center justify-center text-lg font-semibold transition-all active:scale-95 cursor-pointer outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 disabled:pointer-events-none",
                key === 'OK' 
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/20" 
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
              )}
            >
              {key === 'OK' ? (loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-5 h-5" />) : key}
            </button>
          ))}
        </div>
      </div>
      
      <p className="mt-8 text-xs font-medium text-slate-400">© 2026 MiniPOS SaaS Solution</p>
    </div>
  );
}
