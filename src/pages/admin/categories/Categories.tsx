import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Tag, Trash2, Edit2, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type Category = {
  id: string;
  name: string;
  created_at: string;
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error('無法載入分類', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').single();
      
      if (isEditing && currentId) {
        const { error } = await supabase
          .from('categories')
          .update({ name })
          .eq('id', currentId);
        if (error) throw error;
        toast.success('分類更新成功');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([{ name, tenant_id: profile?.tenant_id }]);
        if (error) throw error;
        toast.success('分類建立成功');
      }

      setShowModal(false);
      setName('');
      setIsEditing(false);
      fetchCategories();
    } catch (error: any) {
      toast.error('儲存失敗', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此分類嗎？這可能會導致該分類下的商品變為未分類。')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(categories.filter(c => c.id !== id));
      toast.success('分類已刪除');
    } catch (error: any) {
      toast.error('刪除失敗', { description: '請確認該分類下是否還有商品' });
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
          <p className="text-slate-500 font-bold mt-1">定義商品的類別，方便 POS 端快速查找</p>
        </div>
        <button
          onClick={() => { setName(''); setIsEditing(false); setShowModal(true); }}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          新增分類
        </button>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
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
                  <span className="text-lg font-black text-slate-900">{category.name}</span>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setIsEditing(true);
                      setCurrentId(category.id);
                      setName(category.name);
                      setShowModal(true);
                    }}
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
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">{isEditing ? '編輯分類' : '新增分類'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">分類名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：熱咖啡、季節限定"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary focus:outline-none focus:bg-white transition-all"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20">
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
