import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Plus, Trash2, User, KeyRound, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Employee = {
  id: string;
  name: string;
  pin_code: string;
  role: 'store_manager' | 'staff';
  is_active: boolean;
};

type Props = {
  storeId: string;
  storeName: string;
  onClose: () => void;
};

export default function EmployeesModal({ storeId, storeName, onClose }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<'store_manager' | 'staff'>('staff');

  useEffect(() => {
    fetchEmployees();
  }, [storeId]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error('無法載入員工列表', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPin.trim()) return;
    if (newPin.length < 4 || newPin.length > 6) {
      toast.error('PIN 碼長度需為 4-6 碼');
      return;
    }

    setSubmitting(true);
    try {
      // Get tenant_id from current user profile to be safe (or it can be inferred by backend triggers if set up, but let's be explicit if RLS allows)
      // Actually, RLS usually requires tenant_id to be set. 
      // We can query the store to get tenant_id or user profile.
      // Let's get it from the store (since we have storeId)
      const { data: storeData } = await supabase.from('stores').select('tenant_id').eq('id', storeId).single();
      
      if (!storeData) throw new Error('無法確認門市歸屬');

      const { error } = await supabase.from('employees').insert({
        tenant_id: storeData.tenant_id,
        store_id: storeId,
        name: newName,
        pin_code: newPin,
        role: newRole,
        is_active: true
      });

      if (error) throw error;

      toast.success('員工新增成功');
      setNewName('');
      setNewPin('');
      setNewRole('staff');
      setIsAdding(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error('新增失敗', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此員工帳號嗎？')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      toast.success('員工已刪除');
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (error: any) {
      toast.error('刪除失敗', { description: error.message });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 pb-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              員工管理
            </h2>
            <p className="text-slate-500 font-bold mt-1">{storeName} | 設定 POS 登入 PIN 碼</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* Add Form */}
          {isAdding ? (
            <form onSubmit={handleCreate} className="bg-slate-50 border-2 border-primary/10 rounded-3xl p-6 animate-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-lg text-slate-900">新增員工</h3>
                <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">取消</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">姓名</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    placeholder="員工姓名"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PIN 碼 (4-6碼)</label>
                  <input 
                    type="text" 
                    value={newPin} 
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0,6))}
                    placeholder="設定登入密碼"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
              <div className="mb-6">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">角色權限</label>
                 <div className="flex gap-4">
                   <button 
                     type="button"
                     onClick={() => setNewRole('staff')}
                     className={cn(
                       "flex-1 py-3 rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2",
                       newRole === 'staff' ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                     )}
                   >
                     <User className="w-4 h-4" /> 員工 (僅點餐)
                   </button>
                   <button 
                     type="button"
                     onClick={() => setNewRole('store_manager')}
                     className={cn(
                       "flex-1 py-3 rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2",
                       newRole === 'store_manager' ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                     )}
                   >
                     <Shield className="w-4 h-4" /> 店長 (可退款/報表)
                   </button>
                 </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                確認新增
              </button>
            </form>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 font-black hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              新增員工帳號
            </button>
          )}

          {/* List */}
          {loading ? (
             <div className="space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
             </div>
          ) : employees.length === 0 && !isAdding ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-bold">此門市尚未建立員工帳號</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {employees.map(emp => (
                <div key={emp.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg",
                      emp.role === 'store_manager' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{emp.name}</h4>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> PIN: {emp.pin_code}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] uppercase tracking-wider",
                          emp.role === 'store_manager' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {emp.role === 'store_manager' ? 'Store Manager' : 'Staff'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(emp.id)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="刪除帳號"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
