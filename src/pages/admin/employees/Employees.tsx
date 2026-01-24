import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, KeyRound, Shield, AlertCircle, Loader2, Store, Mail, Trash2, Users, Plus, Edit2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Employee = {
  id: string;
  name: string;
  pin_code: string;
  role: 'store_manager' | 'staff';
  store_id: string;
  store_name?: string;
};

type ManagerAccount = {
  id: string;
  name: string;
  role: string;
  store_id: string | null;
  store_name?: string;
  created_at: string;
};

type StoreType = {
  id: string;
  name: string;
};

export default function Employees() {
  const [activeTab, setActiveTab] = useState<'manager' | 'staff'>('manager');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreType[]>([]);
  
  // Data Lists
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [staffs, setStaffs] = useState<Employee[]>([]);

  // Filter
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  // Staff Modal State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Employee | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffRole, setStaffRole] = useState<'store_manager' | 'staff'>('staff');
  const [staffStoreId, setStaffStoreId] = useState('');
  const [submittingStaff, setSubmittingStaff] = useState(false);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (userRole && tenantId) {
      fetchData();
    }
  }, [activeTab, selectedStoreId, userRole, tenantId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('role, tenant_id, store_id').eq('id', user.id).single();
    if (profile) {
      setUserRole(profile.role);
      setTenantId(profile.tenant_id);
      setUserStoreId(profile.store_id);

      if (profile.role === 'store_manager') {
        setActiveTab('staff');
        setSelectedStoreId(profile.store_id || 'all');
        setStaffStoreId(profile.store_id || '');
      }
      
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .order('name');
      setStores(storesData || []);
    }
  };

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      if (activeTab === 'manager') {
        if (userRole !== 'partner') return;
        let query = supabase
          .from('profiles')
          .select('*, stores(name)')
          .eq('tenant_id', tenantId)
          .eq('role', 'store_manager');
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        setManagers(data?.map(m => ({ ...m, store_name: m.stores?.name })) || []);
      } else {
        let query = supabase
          .from('employees')
          .select('*, stores(name)')
          .eq('tenant_id', tenantId);
        
        if (userRole === 'store_manager') {
          query = query.eq('store_id', userStoreId);
        } else if (selectedStoreId !== 'all') {
          query = query.eq('store_id', selectedStoreId);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        setStaffs(data?.map(s => ({ ...s, store_name: s.stores?.name })) || []);
      }
    } catch (error) {
      toast.error('讀取資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStaffModal = (staff?: Employee) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffName(staff.name);
      setStaffPin(staff.pin_code);
      setStaffRole(staff.role);
      setStaffStoreId(staff.store_id);
    } else {
      setEditingStaff(null);
      setStaffName('');
      setStaffPin('');
      setStaffRole('staff');
      setStaffStoreId(userRole === 'store_manager' ? (userStoreId || '') : (selectedStoreId !== 'all' ? selectedStoreId : ''));
    }
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffPin.trim() || !staffStoreId) {
      toast.error('請填寫完整資料');
      return;
    }
    if (staffPin.length < 4 || staffPin.length > 6) {
      toast.error('PIN 碼需為 4-6 碼');
      return;
    }

    setSubmittingStaff(true);
    try {
      const payload = {
        name: staffName,
        pin_code: staffPin,
        role: staffRole,
        store_id: staffStoreId,
        tenant_id: tenantId,
        is_active: true
      };

      if (editingStaff) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingStaff.id);
        if (error) throw error;
        toast.success('員工資料已更新');
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        toast.success('員工已新增');
      }

      setShowStaffModal(false);
      fetchData();
    } catch (error: any) {
      toast.error('儲存失敗', { description: error.message });
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleDeleteManager = async (userId: string) => {
    if (!confirm('確定要刪除此店長帳號嗎？這將會使其無法登入後台。')) return;
    try {
      const { data, error } = await supabase.functions.invoke('create-partner-user', {
        body: { action: 'delete', userId }
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success('店長帳號已刪除');
      fetchData();
    } catch (error: any) {
      toast.error('刪除失敗', { description: error.message });
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('確定要刪除此 POS 員工嗎？')) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) toast.error('刪除失敗');
    else {
      toast.success('員工已刪除');
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            人員管理
          </h1>
          <p className="text-slate-500 font-bold mt-1">
            {userRole === 'partner' ? '管理品牌旗下所有分店的後台管理員與前台員工' : '管理本店 POS 點餐人員'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {userRole === 'partner' && (
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <Store className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                value={selectedStoreId} 
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none pr-8 py-2 cursor-pointer"
              >
                <option value="all">所有門市</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          
          {activeTab === 'staff' && (
            <button 
              onClick={() => handleOpenStaffModal()}
              className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              新增員工
            </button>
          )}
        </div>
      </div>

      {userRole === 'partner' ? (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('manager')}
            className={cn(
              "px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              activeTab === 'manager' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Shield className="w-4 h-4" />
            後台店長帳號
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={cn(
              "px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              activeTab === 'staff' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <KeyRound className="w-4 h-4" />
            前台員工 PIN
          </button>
        </div>
      ) : (
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-center justify-between">
          <p className="text-primary font-black text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            前台員工 PIN 碼管理
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : activeTab === 'manager' ? (
        <div className="grid gap-4">
          {managers.map(m => (
            <div key={m.id} className="bg-white border border-slate-100 p-6 rounded-3xl flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center font-black text-xl">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg flex items-center gap-3">
                    {m.name}
                    <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-wider">
                      後台管理
                    </span>
                  </h4>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-1">
                    <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> {m.store_name || '未綁定門市'}</span>
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> (Email 登入)</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteManager(m.id)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="刪除店長"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {managers.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-20 text-center text-slate-400 font-bold">
              尚未建立店長帳號。
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {staffs.map(s => (
            <div key={s.id} className="bg-white border border-slate-100 p-6 rounded-3xl flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl",
                  s.role === 'store_manager' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                )}>
                  {s.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg flex items-center gap-3">
                    {s.name}
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider",
                      s.role === 'store_manager' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {s.role === 'store_manager' ? 'POS 值班主管' : 'POS 一般員工'}
                    </span>
                  </h4>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-1">
                    <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> {s.store_name}</span>
                    <span className="flex items-center gap-1.5 bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-100">
                      <KeyRound className="w-3 h-3" /> PIN: {s.pin_code}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenStaffModal(s)}
                  className="p-3 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
                  title="編輯員工"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDeleteStaff(s.id)}
                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="刪除員工"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {staffs.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-20 text-center text-slate-400 font-bold">
              尚未建立 POS 員工。
            </div>
          )}
        </div>
      )}

      {/* Staff Add/Edit Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{editingStaff ? '編輯員工資料' : '新增 POS 員工'}</h2>
                <p className="text-sm text-slate-500 font-bold">設定姓名與 4-6 位數登入 PIN 碼</p>
              </div>
              <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-6">
              {userRole === 'partner' && !editingStaff && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">所屬門市</label>
                  <select 
                    value={staffStoreId}
                    onChange={e => setStaffStoreId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary focus:outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="">請選擇門市...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">員工姓名</label>
                <input 
                  type="text" 
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  placeholder="例如：王小明"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">登入 PIN 碼 (4-6 碼)</label>
                <input 
                  type="text" 
                  value={staffPin}
                  onChange={e => setStaffPin(e.target.value.replace(/\D/g, '').slice(0,6))}
                  placeholder="請輸入數字密碼"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">POS 權限</label>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setStaffRole('staff')}
                    className={cn(
                      "flex-1 py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-1",
                      staffRole === 'staff' ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"
                    )}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-xs">一般員工</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStaffRole('store_manager')}
                    className={cn(
                      "flex-1 py-4 rounded-2xl font-bold border-2 transition-all flex flex-col items-center gap-1",
                      staffRole === 'store_manager' ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"
                    )}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="text-xs">值班主管</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowStaffModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={submittingStaff} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  {submittingStaff && <Loader2 className="w-5 h-5 animate-spin" />}
                  {editingStaff ? '更新資料' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}