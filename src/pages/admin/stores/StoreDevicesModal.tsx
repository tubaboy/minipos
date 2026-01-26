import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Smartphone, Monitor, Trash2, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StoreDevicesModalProps {
  storeId: string;
  storeName: string;
  onClose: () => void;
}

interface Device {
  id: string;
  device_name: string;
  role: 'pos' | 'kitchen';
  last_active_at: string;
}

interface PairingCode {
  code: string;
  role: 'pos' | 'kitchen';
  expires_at: string;
}

export default function StoreDevicesModal({ storeId, storeName, onClose }: StoreDevicesModalProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeCode, setActiveCode] = useState<PairingCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isSingleMode, setIsSingleMode] = useState(false);

  useEffect(() => {
    fetchDevicesAndTenantInfo();
  }, [storeId]);

  const fetchDevicesAndTenantInfo = async () => {
    try {
      setLoading(true);
      const [devicesRes, storeRes] = await Promise.all([
        supabase
          .from('pos_devices')
          .select('*')
          .eq('store_id', storeId)
          .order('last_active_at', { ascending: false }),
        supabase
          .from('stores')
          .select('tenant_id')
          .eq('id', storeId)
          .single()
      ]);

      if (devicesRes.error) throw devicesRes.error;
      setDevices(devicesRes.data || []);

      if (storeRes.data) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('mode')
          .eq('id', storeRes.data.tenant_id)
          .single();
        setIsSingleMode(tenant?.mode === 'single');
      }

    } catch (error: any) {
      toast.error('無法載入裝置列表');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (role: 'pos' | 'kitchen') => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_pairing_code', {
        p_store_id: storeId,
        p_role: role
      });

      if (error) throw error;

      // Set expiry to 10 mins from now (local estimation)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      setActiveCode({ code: data, role, expires_at: expiresAt });
    } catch (error: any) {
      toast.error('產生配對碼失敗', { description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('確定要移除此裝置嗎？移除後該裝置需重新配對才能使用。')) return;

    try {
      const { error } = await supabase.rpc('revoke_device', { p_device_id: deviceId });
      if (error) throw error;
      
      toast.success('裝置已移除');
      fetchDevicesAndTenantInfo();
    } catch (error: any) {
      toast.error('移除失敗');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">裝置管理</h2>
            <p className="text-slate-500 font-bold">{storeName} | POS 與廚房顯示器</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full cursor-pointer">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* Active Pairing Code Banner */}
          {activeCode && (
            <div className="mb-8 bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/20 relative overflow-hidden animate-in slide-in-from-top-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">
                  {activeCode.role === 'pos' ? '點餐機' : '廚房機'} 配對碼 (10分鐘內有效)
                </p>
                <div className="text-6xl font-black tracking-[0.2em] font-mono mb-4 text-teal-400">
                  {activeCode.code.slice(0, 3)} {activeCode.code.slice(3)}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>請在裝置上輸入此代碼</span>
                </div>
              </div>
              
              <button 
                onClick={() => setActiveCode(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Generate Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => handleGenerateCode('pos')}
              disabled={generating}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-slate-100 hover:border-teal-500 hover:bg-teal-50 group transition-all disabled:opacity-50 cursor-pointer",
                isSingleMode ? "col-span-2" : ""
              )}
            >
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center group-hover:bg-teal-500 transition-colors">
                <Smartphone className="w-5 h-5 text-teal-700 group-hover:text-white" />
              </div>
              <div className="text-left">
                <p className="font-black text-slate-900 group-hover:text-teal-700">新增 POS 機</p>
                <p className="text-xs text-slate-400 font-bold">產生配對碼</p>
              </div>
            </button>

            {!isSingleMode && (
              <button
                onClick={() => handleGenerateCode('kitchen')}
                disabled={generating}
                className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 group transition-all disabled:opacity-50 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                  <Monitor className="w-5 h-5 text-orange-700 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-900 group-hover:text-orange-700">新增廚房 KDS</p>
                  <p className="text-xs text-slate-400 font-bold">產生配對碼</p>
                </div>
              </button>
            )}
          </div>

          {/* Device List */}
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">已連線裝置</h3>
            {loading ? (
              <div className="text-center py-8 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />載入中...</div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 font-bold">
                尚無已綁定的裝置
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map(device => (
                  <div key={device.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        device.role === 'pos' ? "bg-teal-50 text-teal-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {device.role === 'pos' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{device.device_name || '未命名裝置'}</p>
                        <p className="text-xs text-slate-400 font-bold">
                          最後上線: {new Date(device.last_active_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeDevice(device.id)}
                      className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                      title="移除裝置"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
