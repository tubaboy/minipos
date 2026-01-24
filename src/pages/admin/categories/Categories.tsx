import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Tag, Trash2, Edit2, X, Check, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Category = {
  id: string;
  name: string;
  created_at: string;
};

type ModifierGroup = {
  id: string;
  name: string;
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (catError) throw catError;
      setCategories(catData || []);

      // 2. Fetch All Available Modifiers
      const { data: modData } = await supabase
        .from('modifier_groups')
        .select('id, name')
        .order('name');
      setModifierGroups(modData || []);

    } catch (error: any) {
      toast.error('無法載入資料', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (category?: Category) => {
    if (category) {
      setIsEditing(true);
      setCurrentId(category.id);
      setName(category.name);
      
      // Fetch currently linked modifiers for this category
      const { data } = await supabase
        .from('category_modifier_groups')
        .select('modifier_group_id')
        .eq('category_id', category.id);
      
      setSelectedModifiers(data?.map(d => d.modifier_group_id) || []);
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setName('');
      setSelectedModifiers([]);
    }
    setShowModal(true);
  };

  const toggleModifier = (id: string) => {
    setSelectedModifiers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      let categoryId = currentId;

      if (isEditing && currentId) {
        await supabase.from('categories').update({ name }).eq('id', currentId);
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert([{ name, tenant_id: profile?.tenant_id }])
          .select()
          .single();
        if (error) throw error;
        categoryId = data.id;
      }

      // Sync Modifiers
      if (categoryId) {
        // 1. Delete existing links
        await supabase.from('category_modifier_groups').delete().eq('category_id', categoryId);
        
        // 2. Insert new links
        if (selectedModifiers.length > 0) {
          const links = selectedModifiers.map(mid => ({
            category_id: categoryId,
            modifier_group_id: mid
          }));
          await supabase.from('category_modifier_groups').insert(links);
        }
      }

      toast.success(isEditing ? '分類已更新' : '分類已建立');
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      toast.error('儲存失敗', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此分類嗎？這將會移除與所有商品的關聯。')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(categories.filter(c => c.id !== id));
      toast.success('分類已刪除');
    } catch (error: any) {
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary" />
            分類管理
          </h1>
          <p className="text-slate-500 font-bold mt-1">定義商品類別，並統一配置加料/自定義選項</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          新增分類
        </button>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="p-20 text-center text-slate-400 font-bold">尚無分類資料</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-slate-900">{category.name}</span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenModal(category)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{isEditing ? '編輯分類' : '新增分類'}</h2>
                <p className="text-sm text-slate-500 font-bold">設定名稱與預設客製化選項</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">分類名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：熱咖啡、精選甜點"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary focus:outline-none focus:bg-white transition-all"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  <Settings2 className="w-3 h-3" />
                  預設套用客製化選項
                </div>
                
                {modifierGroups.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                    請先在「自定義選項」建立群組
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {modifierGroups.map(group => {
                      const isSelected = selectedModifiers.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleModifier(group.id)}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                            isSelected 
                              ? "bg-primary/5 border-primary text-primary shadow-sm" 
                              : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary text-white" : "bg-slate-100"
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-sm font-black truncate">{group.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  * 勾選後，系統會自動將這些選項套用至此分類下的「所有現有商品」，且未來新增至此分類的商品也會自動繼承。
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all">
                  {submitting ? '儲存中...' : '確認儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}