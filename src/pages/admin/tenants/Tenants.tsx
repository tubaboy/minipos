import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Building2, Trash2, Calendar, Copy, Check, Users, X, Layers, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tenant = {
  id: string;
  name: string;
  mode: 'multi' | 'single';
  created_at: string;
};

type TenantUser = {
  id: string;
  name: string;
  role: string;
};

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Tenant Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantMode, setNewTenantMode] = useState<'multi' | 'single'>('multi');
  const [creating, setCreating] = useState(false);
  
  // Account Modal State
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  
  // UI Helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      toast.error('無法載入合作夥伴列表', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAccountModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowAccountModal(true);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserName('');
    setTenantUsers([]); 
    fetchTenantUsers(tenant.id);
  };

  const fetchTenantUsers = async (tenantId: string) => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('tenant_id', tenantId)
        .eq('role', 'partner');

      if (error) throw error;
      setTenantUsers(data || []);
    } catch (error: any) {
      toast.error('無法載入使用者列表', { description: error.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setCreatingUser(true);
    try {
      const { error } = await supabase.rpc('create_partner_user', {
        new_email: newUserEmail,
        password: newUserPassword,
        name: newUserName,
        tenant_id: selectedTenant.id,
      });

      if (error) throw error;

      toast.success('管理者帳號建立成功');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      fetchTenantUsers(selectedTenant.id);
    } catch (error: any) {
      toast.error('建立失敗', { description: error.message });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .insert([{ 
          name: newTenantName,
          mode: newTenantMode 
        }])
        .select()
        .single();

      if (error) throw error;

      setTenants([data, ...tenants]);
      setShowCreateModal(false);
      setNewTenantName('');
      setNewTenantMode('multi');
      toast.success('合作夥伴建立成功');
    } catch (error: any) {
      toast.error('建立失敗', { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (!confirm('確定要刪除此合作夥伴嗎？這將會刪除該品牌下所有的商店與資料！')) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTenants(tenants.filter(t => t.id !== id));
      toast.success('已刪除合作夥伴');
    } catch (error: any) {
      toast.error('刪除失敗', { description: error.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('ID 已複製');
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            合作夥伴管理
          </h1>
          <p className="text-slate-500 font-bold mt-1">管理所有接入系統的品牌租戶</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          新增品牌
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="group bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    tenant.mode === 'multi' ? "bg-teal-50 text-teal-600 border border-teal-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {tenant.mode === 'multi' ? '多機版 (點餐-廚房)' : '單機版 (點餐)'}
                  </span>
                  <button
                    onClick={() => handleDeleteTenant(tenant.id)}
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">{tenant.name}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-400 text-sm font-medium bg-slate-50 p-2 rounded-lg">
                  <span className="font-mono text-xs truncate flex-1">{tenant.id}</span>
                  <button 
                    onClick={() => copyToClipboard(tenant.id)}
                    className="hover:text-primary transition-colors"
                  >
                    {copiedId === tenant.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                  <Calendar className="w-4 h-4" />
                  <span>建立於 {formatDate(tenant.created_at)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                 <button 
                    onClick={() => handleOpenAccountModal(tenant)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                 >
                    <Users className="w-4 h-4" />
                    管理帳號
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-1">新增合作夥伴</h2>
            <p className="text-slate-500 font-bold text-sm mb-6">建立一個新的品牌租戶空間</p>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">品牌名稱</label>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="例如：星巴克"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 focus:border-primary focus:outline-none transition-all"
                  autoFocus
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">運作模式</label>
                <select
                  value={newTenantMode}
                  onChange={(e) => setNewTenantMode(e.target.value as 'multi' | 'single')}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 focus:border-primary focus:outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="multi">多機版 (點餐-廚房)</option>
                  <option value="single">單機版 (點餐)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">取消</button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold">{creating ? '建立中...' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccountModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
               <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">管理品牌帳號</h2>
                <p className="text-slate-500 font-bold text-sm">{selectedTenant.name} | 管理人員列表</p>
               </div>
               <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                 <X className="w-6 h-6 text-slate-400" />
               </button>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">新增管理員</h3>
                <form onSubmit={handleCreateUser} className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                  <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="姓名" className="w-full px-3 py-2 border rounded-lg font-bold text-sm" required />
                  <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 border rounded-lg font-bold text-sm" required />
                  <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="預設密碼" className="w-full px-3 py-2 border rounded-lg font-bold text-sm" required minLength={6} />
                  <button type="submit" disabled={creatingUser} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">{creatingUser ? '建立中...' : '建立帳號'}</button>
                </form>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">現有帳號 ({tenantUsers.length})</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {loadingUsers ? <div className="text-center py-8 text-slate-400 text-xs font-bold">載入中...</div> : 
                   tenantUsers.length === 0 ? <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed"><p className="text-slate-400 text-xs font-bold">尚無帳號</p></div> :
                   tenantUsers.map(user => (
                    <div key={user.id} className="bg-white border p-3 rounded-xl flex items-center justify-between">
                      <div><p className="font-bold text-slate-900 text-sm">{user.name}</p></div>
                      <div className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md">{user.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}