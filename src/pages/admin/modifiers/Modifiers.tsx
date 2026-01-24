import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Settings2, Trash2, Edit2, X, PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ModifierOption = {
  id: string;
  group_id: string;
  name: string;
  extra_price: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  options?: ModifierOption[];
};

export default function Modifiers() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  // Group Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [submittingGroup, setSubmittingGroup] = useState(false);

  // Option Modal
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [optionName, setOptionName] = useState('');
  const [extraPrice, setExtraPrice] = useState('0');
  const [submittingOption, setSubmittingOption] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setTenantId(profile.tenant_id);
      fetchData(profile.tenant_id);
    } catch (error: any) {
      console.error('Init error:', error);
      toast.error('無法讀取權限資訊');
    }
  };

  const fetchData = async (tid?: string) => {
    const currentTid = tid || tenantId;
    if (!currentTid) return;

    setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('modifier_groups')
        .select(`
          *,
          options: modifier_options(*)
        `)
        .eq('tenant_id', currentTid)
        .order('created_at');

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);
    } catch (error: any) {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      toast.error('尚未取得權限資訊，請重新整理頁面');
      return;
    }

    setSubmittingGroup(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('modifier_groups')
          .update({ name: groupName })
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('modifier_groups')
          .insert([{ name: groupName, tenant_id: tenantId }]);
        if (error) throw error;
      }
      
      setShowGroupModal(false);
      setGroupName('');
      fetchData();
      toast.success('儲存成功');
    } catch (error: any) {
      console.error('Save group error:', error);
      toast.error('儲存失敗', { description: error.message });
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupId) return;
    
    setSubmittingOption(true);
    try {
      const { error } = await supabase.from('modifier_options').insert([{
        group_id: targetGroupId,
        name: optionName,
        extra_price: Number(extraPrice)
      }]);
      
      if (error) throw error;

      setShowOptionModal(false);
      setOptionName('');
      setExtraPrice('0');
      fetchData();
      toast.success('選項已新增');
    } catch (error: any) {
      console.error('Save option error:', error);
      toast.error('新增失敗', { description: error.message });
    } finally {
      setSubmittingOption(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('確定刪除此群組及其所有選項？')) return;
    try {
      const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      toast.success('已刪除群組');
    } catch (error: any) {
      toast.error('刪除失敗');
    }
  };

  const deleteOption = async (id: string) => {
    try {
      const { error } = await supabase.from('modifier_options').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      toast.success('已刪除選項');
    } catch (error: any) {
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            自定義選項 (Modifiers)
          </h1>
          <p className="text-slate-500 font-bold mt-1">管理加料、甜度、冰塊等客製化需求</p>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setGroupName(''); setShowGroupModal(true); }}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          新增群組
        </button>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2].map(i => <div key={i} className="h-40 bg-slate-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
          <Settings2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">尚未建立任何客製化群組</p>
        </div>
      ) : (
        <div className="grid gap-8">
          {groups.map((group) => (
            <div key={group.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:border-primary/20 transition-all group/card">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary font-black text-xl border border-slate-100">
                    {group.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{group.name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{group.options?.length || 0} 個選項</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingGroup(group); setGroupName(group.name); setShowGroupModal(true); }}
                    className="p-3 text-slate-400 hover:text-primary hover:bg-white rounded-xl transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => deleteGroup(group.id)}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.options?.map((opt) => (
                    <div key={opt.id} className="group bg-slate-50 border-2 border-transparent hover:border-primary/20 p-4 rounded-2xl flex items-center justify-between transition-all">
                      <div>
                        <p className="font-black text-slate-900">{opt.name}</p>
                        <p className="text-[10px] font-black text-primary uppercase">
                          {opt.extra_price > 0 ? `+ NT$ ${opt.extra_price}` : '免費'}
                        </p>
                      </div>
                      <button 
                        onClick={() => deleteOption(opt.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => { setTargetGroupId(group.id); setShowOptionModal(true); }}
                    className="border-2 border-dashed border-slate-200 p-4 rounded-2xl flex items-center justify-center gap-2 text-slate-400 font-black hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <PlusCircle className="w-5 h-5" />
                    新增選項
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{editingGroup ? '編輯群組' : '新增加料群組'}</h2>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <input 
                type="text" 
                value={groupName} 
                onChange={e => setGroupName(e.target.value)} 
                placeholder="例如：甜度、冰塊、加料" 
                className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary"
                autoFocus
                required 
              />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowGroupModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-600">取消</button>
                <button type="submit" disabled={submittingGroup} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2">
                  {submittingGroup && <Loader2 className="w-5 h-5 animate-spin" />}
                  儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Option Modal */}
      {showOptionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">新增選項</h2>
            <form onSubmit={handleSaveOption} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">選項名稱</label>
                <input 
                  type="text" 
                  value={optionName} 
                  onChange={e => setOptionName(e.target.value)} 
                  placeholder="例如：半糖、珍珠" 
                  className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary"
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">加價金額</label>
                <input 
                  type="number" 
                  value={extraPrice} 
                  onChange={e => setExtraPrice(e.target.value)} 
                  className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary"
                  required 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowOptionModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-600">取消</button>
                <button type="submit" disabled={submittingOption} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2">
                  {submittingOption && <Loader2 className="w-5 h-5 animate-spin" />}
                  確認新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}