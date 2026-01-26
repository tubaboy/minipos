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
  SmartphoneNfc
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

  // Form States
  const [profile, setProfile] = useState({ name: '', email: '' });
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
        
        if (profileData.tenants) {
          setTenantSettings(profileData.tenants.settings || tenantSettings);
        }
        
        if (profileData.stores) {
          setStoreInfo({
            name: profileData.stores.name,
            address: profileData.stores.address || '',
            phone: profileData.stores.phone || '',
            is_open: profileData.stores.settings?.is_open ?? true
          });
        }

        // 2. Fetch Online Devices (Active in last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        let deviceQuery = supabase
          .from('pos_devices')
          .select('*, stores(name)')
          .gt('last_active_at', tenMinutesAgo);
          
        if (profileData.role === 'store_manager') {
          deviceQuery = deviceQuery.eq('store_id', profileData.store_id);
        } else if (profileData.role === 'partner') {
          deviceQuery = deviceQuery.eq('tenant_id', profileData.tenant_id);
        }
        
        const { data: devices } = await deviceQuery.order('last_active_at', { ascending: false });
        setAllDevices(devices || []);
      }

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

  const handleSaveTenantSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      const { error } = await supabase
        .from('tenants')
        .update({ settings: tenantSettings })
        .eq('id', prof?.tenant_id);
      if (error) throw error;
      toast.success('品牌設定已儲存');
    } catch (error) {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single();
      
      const { error } = await supabase
        .from('stores')
        .update({ 
          address: storeInfo.address,
          phone: storeInfo.phone,
          settings: { ...storeInfo, is_open: storeInfo.is_open }
        })
        .eq('id', prof?.store_id);
      if (error) throw error;
      toast.success('門市資訊已更新');
    } catch (error) {
      toast.error('儲存失敗');
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
          <div className="md:col-span-2">
            <p className="text-xs text-slate-400 font-bold ml-1 italic">* 密碼變更功能目前尚未開放，如需重設請洽總部管理員。</p>
          </div>
        </div>
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
                <p className="text-teal-600/60 font-bold text-xs uppercase tracking-widest">Brand Global Settings</p>
              </div>
            </div>
            <button 
              onClick={handleSaveTenantSettings}
              disabled={saving}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-teal-700 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" /> 儲存品牌設定
            </button>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                {allDevices.map(dev => (
                  <div key={dev.id} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        dev.role === 'pos' ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {dev.role === 'pos' ? <Smartphone className="w-5 h-5" /> : <SettingsIcon className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900">{dev.device_name || '未命名裝置'}</p>
                          {dev.device_token === localStorage.getItem('velopos_device_token') && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">本機</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-bold">
                          {dev.stores?.name} • {dev.role === 'pos' ? '點餐機' : '廚房機'} • 最後上線: {new Date(dev.last_active_at).toLocaleString()}
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
                ))}
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
