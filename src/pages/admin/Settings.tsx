import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Settings as SettingsIcon, 
  Smartphone, 
  Store, 
  Building2, 
  LogOut, 
  Save, 
  Loader2,
  Bell,
  CheckCircle2,
  SmartphoneNfc,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [brandDefaults, setBrandDefaults] = useState<any>(null);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    
    // Always start from brand defaults as a base to avoid stale state from previous store
    const base = brandDefaults || {
      service_charge_percent: 0,
      allow_dine_in: true,
      allow_take_out: true
    };

    if (storeId === 'all') {
      setTenantSettings(base);
    } else {
      const selectedStore = stores.find(s => s.id === storeId);
      // If store has specific settings, use them; otherwise, use brand defaults
      setTenantSettings({
        service_charge_percent: selectedStore?.settings?.service_charge_percent ?? base.service_charge_percent,
        currency_symbol: 'NT$',
        allow_dine_in: selectedStore?.settings?.allow_dine_in ?? base.allow_dine_in,
        allow_take_out: selectedStore?.settings?.allow_take_out ?? base.allow_take_out
      });
    }
  };

  // Form States
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [tenantSettings, setTenantSettings] = useState({
    service_charge_percent: 0,
    currency_symbol: 'NT$',
    allow_dine_in: true,
    allow_take_out: true
  });
  const [storeInfo, setStoreInfo] = useState({
    name: '',
    address: '',
    phone: '',
    is_open: true
  });
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [allDevices, setAllDevices] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, tenants(*), stores(*)')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setRole(profileData.role);
        setProfile({ name: profileData.name, email: user.email || '' });
        
        // 1. Load Brand Defaults First
        let bDefaults = {
          service_charge_percent: 0,
          currency_symbol: 'NT$',
          allow_dine_in: true,
          allow_take_out: true
        };

        if (profileData.tenants) {
          bDefaults = profileData.tenants.settings || bDefaults;
          setBrandDefaults(bDefaults);
        }

        // 2. Fetch all stores
        if (profileData.role === 'partner') {
          const { data: storesData } = await supabase
            .from('stores')
            .select('*')
            .eq('tenant_id', profileData.tenant_id)
            .order('name');
          
          setStores(storesData || []);

          // 3. Set form based on current selection
          if (selectedStoreId === 'all') {
            setTenantSettings(bDefaults);
          } else {
            const current = storesData?.find(s => s.id === selectedStoreId);
            setTenantSettings({
              service_charge_percent: current?.settings?.service_charge_percent ?? bDefaults.service_charge_percent,
              currency_symbol: 'NT$',
              allow_dine_in: current?.settings?.allow_dine_in ?? bDefaults.allow_dine_in,
              allow_take_out: current?.settings?.allow_take_out ?? bDefaults.allow_take_out
            });
          }
        }
        
        if (profileData.stores) {
          setStoreInfo({
            name: profileData.stores.name,
            address: profileData.stores.address || '',
            phone: profileData.stores.phone || '',
            is_open: profileData.stores.settings?.is_open ?? true
          });
        }

              // 2. Fetch All Bound Devices
              let deviceQuery = supabase
                .from('pos_devices')
                .select('*, stores(name)');
                
              if (profileData.role === 'store_manager') {
                deviceQuery = deviceQuery.eq('store_id', profileData.store_id);
              } else if (profileData.role === 'partner') {
                deviceQuery = deviceQuery.eq('tenant_id', profileData.tenant_id);
              }
              
              const { data: devices } = await deviceQuery.order('last_active_at', { ascending: false });
              setAllDevices(devices || []);      }

      // 3. Fetch Current Device Info (if on POS)
      const token = localStorage.getItem('velopos_device_token');
      if (token) {
        const { data: dev } = await supabase
          .from('pos_devices')
          .select('*')
          .eq('device_token', token)
          .single();
        if (dev) setDeviceInfo(dev);
      }

    } catch (error) {
      toast.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: profile.name })
        .eq('id', userId);
      if (error) throw error;
      toast.success('個人資料已更新');
    } catch (error) {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.new || !passwords.confirm) return;
    if (passwords.new !== passwords.confirm) {
      toast.error('兩次輸入的新密碼不一致');
      return;
    }
    if (passwords.new.length < 6) {
      toast.error('新密碼長度至少需 6 個字元');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: passwords.new 
      });
      if (error) throw error;
      
      toast.success('密碼更新成功，請使用新密碼重新登入');
      
      // Delay slightly to let user see the message, then sign out
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/admin/login');
      }, 1500);

    } catch (error: any) {
      toast.error('密碼更新失敗', { description: error.message });
      setUpdatingPassword(false);
    }
  };

  const handleSaveTenantSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      if (!prof) throw new Error('找不到所屬品牌');

      const currentTenantId = prof.tenant_id;

      // 1. Update Tenant Global Settings (Brand Defaults)
      if (selectedStoreId === 'all') {
        const { error: tenantError } = await supabase
          .from('tenants')
          .update({ settings: tenantSettings })
          .eq('id', currentTenantId);
        if (tenantError) throw tenantError;
        setBrandDefaults(tenantSettings);
      }

      // 2. Update Target Store(s)
      const { data: targetStores, error: fetchError } = await (selectedStoreId === 'all' 
        ? supabase.from('stores').select('id, settings').eq('tenant_id', currentTenantId)
        : supabase.from('stores').select('id, settings').eq('id', selectedStoreId));

      if (fetchError) throw fetchError;

      if (targetStores && targetStores.length > 0) {
        console.log("Found stores to update:", targetStores.length);
        
        for (const s of targetStores) {
          const newSettings = {
            ...(s.settings || {}),
            allow_dine_in: tenantSettings.allow_dine_in,
            allow_take_out: tenantSettings.allow_take_out,
            service_charge_percent: tenantSettings.service_charge_percent
          };

          const { error: updateError } = await supabase
            .from('stores')
            .update({ settings: newSettings })
            .eq('id', s.id);
          
          if (updateError) throw updateError;
        }

        // Update local stores state to avoid reloading jumps
        setStores(prev => prev.map(s => {
          if (selectedStoreId === 'all' || s.id === selectedStoreId) {
            return {
              ...s,
              settings: {
                ...(s.settings || {}),
                allow_dine_in: tenantSettings.allow_dine_in,
                allow_take_out: tenantSettings.allow_take_out,
                service_charge_percent: tenantSettings.service_charge_percent
              }
            };
          }
          return s;
        }));
      }

      const storeNameLabel = selectedStoreId === 'all' ? '所有門市' : stores.find(s => s.id === selectedStoreId)?.name || '門市';
      toast.success(selectedStoreId === 'all' ? `品牌及所有門市設定已同步` : `[${storeNameLabel}] 門市專屬設定已更新`);
    } catch (error: any) {
      console.error("Save Error Detailed:", error);
      toast.error(`儲存失敗: ${error.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single();
      if (!prof?.store_id) throw new Error('找不到關聯門市 ID');

      const { data: currentStore, error: fetchError } = await supabase.from('stores').select('settings').eq('id', prof.store_id).single();
      if (fetchError) throw fetchError;
      
      const { error: updateError } = await supabase
        .from('stores')
        .update({ 
          address: storeInfo.address,
          phone: storeInfo.phone,
          settings: { 
            ...(currentStore?.settings || {}),
            is_open: storeInfo.is_open 
          }
        })
        .eq('id', prof.store_id);
      
      if (updateError) throw updateError;
      toast.success('門市資訊已更新');
    } catch (error: any) {
      console.error("Store Save Error:", error);
      toast.error(`儲存失敗: ${error.message || '權限不足'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string, isCurrent = false) => {
    const msg = isCurrent 
      ? '確定要解除此裝置綁定嗎？解除後需重新使用配對碼。' 
      : '確定要從遠端解除此裝置的綁定嗎？';
      
    if (!confirm(msg)) return;

    try {
      const { error } = await supabase.rpc('revoke_device', { p_device_id: deviceId });
      if (error) throw error;

      if (isCurrent) {
        localStorage.removeItem('velopos_device_token');
        localStorage.removeItem('velopos_store_id');
        localStorage.removeItem('velopos_store_name');
        localStorage.removeItem('velopos_device_role');
        localStorage.removeItem('velopos_tenant_mode');
        localStorage.removeItem('velopos_employee');
        toast.success('本裝置已解除綁定');
        navigate('/login');
      } else {
        toast.success('裝置已從遠端解除綁定');
        fetchData();
      }
    } catch (error) {
      toast.error('操作失敗');
    }
  };

  const handleUpdateDeviceName = async (newName: string) => {
    if (!deviceInfo) return;
    try {
      const { error } = await supabase
        .from('pos_devices')
        .update({ device_name: newName })
        .eq('id', deviceInfo.id);
      if (error) throw error;
      setDeviceInfo({ ...deviceInfo, device_name: newName });
      toast.success('裝置名稱已更新');
    } catch (error) {
      toast.error('更新失敗');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 1. Profile Section */}
      <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">個人基本資料</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Profile Settings</p>
            </div>
          </div>
          <button 
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存變更
          </button>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">姓名</label>
            <input 
              type="text" 
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">帳號 (Email)</label>
            <input 
              type="text" 
              value={profile.email}
              disabled
              className="w-full px-5 py-3.5 bg-slate-100 border-2 border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      {/* 1.1 Security Section */}
      <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">帳號安全設定</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Security Settings</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">設定新密碼</label>
              <input 
                type="password" 
                placeholder="請輸入新密碼 (至少 6 碼)"
                value={passwords.new}
                onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-rose-500 outline-none transition-all"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">確認新密碼</label>
              <input 
                type="password" 
                placeholder="再次輸入新密碼"
                value={passwords.confirm}
                onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-rose-500 outline-none transition-all"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={updatingPassword || !passwords.new || !passwords.confirm}
              className="bg-rose-500 text-white px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              更新登入密碼
            </button>
          </div>
        </form>
      </section>

      {/* 2. Tenant Settings (Partner Only) */}
      {role === 'partner' && (
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-teal-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">品牌營運參數</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-teal-600/60 font-bold text-xs uppercase tracking-widest">Brand Global Settings</p>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                    selectedStoreId === 'all' ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"
                  )}>
                    {selectedStoreId === 'all' 
                      ? "編輯全品牌預設" 
                      : `正在編輯門市: ${stores.find(s => s.id === selectedStoreId)?.name}${
                          !stores.find(s => s.id === selectedStoreId)?.settings?.service_charge_percent && 
                          stores.find(s => s.id === selectedStoreId)?.settings?.service_charge_percent !== 0 
                          ? " (目前使用品牌預設)" : ""
                        }`}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={handleSaveTenantSettings}
              disabled={saving}
              className={cn(
                "px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all active:scale-95",
                selectedStoreId === 'all' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"
              )}
            >
              <Save className="w-4 h-4" /> 
              {selectedStoreId === 'all' ? '同步至所有門市' : '儲存門市設定'}
            </button>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-teal-500" /> 套用門市
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">選擇設定對象</label>
                  <select 
                    value={selectedStoreId}
                    onChange={e => handleStoreChange(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-teal-500 outline-none transition-all appearance-none"
                  >
                    <option value="all">所有門市 (同步套用)</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" /> 費用計算
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">內用服務費 (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={tenantSettings.service_charge_percent}
                      onChange={e => setTenantSettings({ ...tenantSettings, service_charge_percent: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900 focus:border-teal-500 outline-none transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300">%</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-teal-500" /> 點餐模組控制
                </h4>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setTenantSettings({ ...tenantSettings, allow_dine_in: !tenantSettings.allow_dine_in })}
                    className={cn(
                      "flex-1 p-4 rounded-2xl border-2 font-black text-sm transition-all",
                      tenantSettings.allow_dine_in ? "bg-teal-50 border-teal-500 text-teal-700" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >內用功能</button>
                  <button 
                    onClick={() => setTenantSettings({ ...tenantSettings, allow_take_out: !tenantSettings.allow_take_out })}
                    className={cn(
                      "flex-1 p-4 rounded-2xl border-2 font-black text-sm transition-all",
                      tenantSettings.allow_take_out ? "bg-teal-50 border-teal-500 text-teal-700" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >外帶功能</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Store Info (Manager Only) */}
      {role === 'store_manager' && (
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-amber-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">門市營運設定</h3>
                <p className="text-amber-600/60 font-bold text-xs uppercase tracking-widest">Local Store Settings</p>
              </div>
            </div>
            <button 
              onClick={handleSaveStoreInfo}
              className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-amber-700 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" /> 更新門市資料
            </button>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="font-black text-slate-900">營業狀態</p>
                <p className="text-xs text-slate-400 font-bold">關閉後 POS 端將無法進行點餐</p>
              </div>
              <button 
                onClick={() => setStoreInfo({ ...storeInfo, is_open: !storeInfo.is_open })}
                className={cn(
                  "px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all",
                  storeInfo.is_open ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-300 text-white"
                )}
              >
                {storeInfo.is_open ? '營業中' : '暫停營業'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">門市電話</label>
                <input 
                  type="text" 
                  value={storeInfo.phone}
                  onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">門市地址</label>
                <input 
                  type="text" 
                  value={storeInfo.address}
                  onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-amber-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Bound Devices Management (Admin/Manager) */}
      {(role === 'partner' || role === 'store_manager') && (
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <SmartphoneNfc className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">品牌裝置管理</h3>
                <p className="text-indigo-600/60 font-bold text-xs uppercase tracking-widest">
                  {role === 'partner' ? '全品牌已綁定裝置' : '本門市已綁定裝置'}
                </p>
              </div>
            </div>
          </div>
          <div className="p-8">
            {allDevices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-3xl">
                目前尚無任何已綁定的裝置
              </div>
            ) : (
              <div className="grid gap-4">
                {allDevices.map(dev => {
                  // 恢復精確判斷：10 分鐘內有心跳皆視為在線
                  const lastActive = new Date(dev.last_active_at).getTime();
                  const isOnline = lastActive > Date.now() - 10 * 60 * 1000;
                  return (
                    <div key={dev.id} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            dev.role === 'pos' ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {dev.role === 'pos' ? <Smartphone className="w-5 h-5" /> : <SettingsIcon className="w-5 h-5" />}
                          </div>
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                            isOnline ? "bg-emerald-500" : "bg-slate-300"
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900">{dev.device_name || '未命名裝置'}</p>
                            {dev.device_token === localStorage.getItem('velopos_device_token') && (
                              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">本機</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-bold">
                            {dev.stores?.name} • {dev.role === 'pos' ? '點餐機' : '廚房機'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            最後上線: {new Date(dev.last_active_at).toLocaleString()} 
                            <span className="ml-2 text-indigo-500">
                              ({Math.floor((Date.now() - new Date(dev.last_active_at).getTime()) / 60000)} 分鐘前)
                            </span>
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRevokeDevice(dev.id, dev.device_token === localStorage.getItem('velopos_device_token'))}
                        className="opacity-0 group-hover:opacity-100 p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 font-bold text-xs"
                      >
                        <LogOut className="w-4 h-4" /> 解除綁定
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Current Device Quick Info (If not admin, but on bound device) */}
      {deviceInfo && role !== 'partner' && role !== 'store_manager' && (
        <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                <SmartphoneNfc className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black">當前裝置設定</h3>
                <p className="text-white/40 font-bold text-xs uppercase tracking-widest">This Terminal Settings</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-white/40 uppercase tracking-wider ml-1">裝置自定義名稱</label>
                  <input 
                    type="text" 
                    defaultValue={deviceInfo.device_name}
                    onBlur={(e) => handleUpdateDeviceName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border-2 border-white/10 rounded-2xl font-black text-white focus:border-white/30 outline-none transition-all"
                    placeholder="例如：櫃檯 iPad 01"
                  />
                </div>
                <div className="flex items-center gap-6 text-xs font-bold text-white/40 px-1">
                  <span className="flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> 角色: {deviceInfo.role === 'pos' ? '點餐機' : '廚房機'}</span>
                  <span>最後活動: {new Date(deviceInfo.last_active_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  onClick={() => handleRevokeDevice(deviceInfo.id, true)}
                  className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 border border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  解除此裝置綁定
                </button>
                <p className="text-[10px] text-white/20 text-center font-bold">解除綁定後，這台裝置將會登出並回到初始化畫面。</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="text-center text-slate-300 font-bold text-xs tracking-[0.3em] uppercase">
        Velo POS System v1.0.4-beta
      </div>
    </div>
  );
}
