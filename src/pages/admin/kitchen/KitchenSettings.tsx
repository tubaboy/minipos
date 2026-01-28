import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChefHat, 
  Clock, 
  Filter,
  Save,
  AlertCircle,
  Monitor,
  CheckCircle2,
  Utensils,
  ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface KDSSettings {
  overdue_minutes: number;
  show_dine_in: boolean;
  show_take_out: boolean;
  auto_clear_completed_minutes: number;
}

export default function KitchenSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<KDSSettings>({
    overdue_minutes: 15,
    show_dine_in: true,
    show_take_out: true,
    auto_clear_completed_minutes: 10
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.store_id) return;
      setStoreId(profile.store_id);

      const { data: store } = await supabase
        .from('stores')
        .select('settings')
        .eq('id', profile.store_id)
        .single();

      if (store?.settings?.kds_settings) {
        setSettings({
          ...settings,
          ...store.settings.kds_settings
        });
      }
    } catch (error) {
      console.error('Error fetching KDS settings:', error);
      toast.error('無法載入設定');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      // Get current settings first to preserve other keys like is_open
      const { data: store } = await supabase
        .from('stores')
        .select('settings')
        .eq('id', storeId)
        .single();

      const newSettings = {
        ...(store?.settings || {}),
        kds_settings: settings
      };

      const { error } = await supabase
        .from('stores')
        .update({ settings: newSettings })
        .eq('id', storeId);

      if (error) throw error;
      toast.success('KDS 設定已儲存');
    } catch (e) {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        <span className="text-slate-400 font-bold">載入中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Monitor className="w-8 h-8 text-primary" />
            廚房顯示器 (KDS) 設定
          </h3>
          <p className="text-slate-400 font-medium mt-1">自定義門市 KDS 的顯示邏輯與警示規則</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
        >
          <Save className="w-5 h-5" />
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Overdue Alerts */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-xl">
              <Clock className="w-6 h-6 text-red-500" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">逾期示警設定</h4>
          </div>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">
                警示門檻 (分鐘)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={settings.overdue_minutes}
                  onChange={(e) => setSettings({...settings, overdue_minutes: parseInt(e.target.value) || 0})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <span className="text-lg font-bold text-slate-400">分鐘</span>
              </div>
              <p className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">
                當訂單從下單起超過此時間未完成，KDS 畫面將會以紅色背景閃爍提醒。
              </p>
            </div>
          </div>
        </div>

        {/* Display Filters */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Filter className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">顯示過濾</h4>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => setSettings({...settings, show_dine_in: !settings.show_dine_in})}
              className={cn(
                "w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all",
                settings.show_dine_in 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-slate-100 text-slate-400 grayscale"
              )}
            >
              <div className="flex items-center gap-4">
                <Utensils className="w-6 h-6" />
                <span className="font-bold text-lg">顯示「內用」訂單</span>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                settings.show_dine_in ? "border-primary bg-primary" : "border-slate-200"
              )}>
                {settings.show_dine_in && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            </button>

            <button 
              onClick={() => setSettings({...settings, show_take_out: !settings.show_take_out})}
              className={cn(
                "w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all",
                settings.show_take_out 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-slate-100 text-slate-400 grayscale"
              )}
            >
              <div className="flex items-center gap-4">
                <ShoppingBag className="w-6 h-6" />
                <span className="font-bold text-lg">顯示「外帶」訂單</span>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                settings.show_take_out ? "border-primary bg-primary" : "border-slate-200"
              )}>
                {settings.show_take_out && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            </button>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <AlertCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">自動化管理</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">
                自動隱藏已完成訂單
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={settings.auto_clear_completed_minutes}
                  onChange={(e) => setSettings({...settings, auto_clear_completed_minutes: parseInt(e.target.value) || 0})}
                  className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <span className="text-sm font-bold text-slate-400">分鐘後</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-medium">
                訂單標記為「已完成」後，將於指定時間後從 KDS 列表隱藏，以保持廚房畫面整潔。此操作<span className="text-primary">僅為顯示過濾</span>，不影響結帳與資料完整性。
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}