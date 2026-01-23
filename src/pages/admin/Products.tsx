import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
  Search,
  Filter,
  Image as ImageIcon,
  XCircle,
  LayoutGrid,
  List,
  Trash2,
  Check,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Category = {
  id: string;
  name: string;
};

type ModifierGroup = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string;
  is_available: boolean;
  image_url: string | null;
  description: string | null;
};

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, modifiersRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('modifier_groups').select('*').order('name')
      ]);

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setModifierGroups(modifiersRes.data || []);
    } catch (error: any) {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (product: Product) => {
    setCurrentProduct(product);
    setIsEditing(true);
    setShowModal(true);
    setSelectedModifierIds([]);
    setLoadingModifiers(true);
    
    try {
      const { data } = await supabase
        .from('product_modifier_groups')
        .select('modifier_group_id')
        .eq('product_id', product.id);
      setSelectedModifierIds(data?.map(d => d.modifier_group_id) || []);
    } finally {
      setLoadingModifiers(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct?.name || !currentProduct?.price || !currentProduct?.category_id) return;

    setSaving(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').single();
      const productData = {
        name: currentProduct.name,
        price: currentProduct.price,
        category_id: currentProduct.category_id,
        image_url: currentProduct.image_url || null,
        tenant_id: profile?.tenant_id,
        is_available: currentProduct.is_available ?? true
      };

      let productId = currentProduct.id;
      if (isEditing && productId) {
        await supabase.from('products').update(productData).eq('id', productId);
      } else {
        const { data, error } = await supabase.from('products').insert([productData]).select().single();
        if (error) throw error;
        productId = data.id;
      }

      if (productId) {
        await supabase.from('product_modifier_groups').delete().eq('product_id', productId);
        if (selectedModifierIds.length > 0) {
          const relations = selectedModifierIds.map(mgId => ({
            product_id: productId,
            modifier_group_id: mgId
          }));
          await supabase.from('product_modifier_groups').insert(relations);
        }
      }

      toast.success('儲存成功');
      setShowModal(false);
      fetchInitialData();
    } catch (error: any) {
      toast.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (product: Product) => {
    const newStatus = !product.is_available;
    try {
      await supabase.from('products').update({ is_available: newStatus }).eq('id', product.id);
      setProducts(products.map(p => p.id === product.id ? { ...p, is_available: newStatus } : p));
      toast.success(`商品已${newStatus ? '上架' : '下架'}`);
    } catch (error) {
      toast.error('操作失敗');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryId === 'all' || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Coffee className="w-8 h-8 text-primary" />
            商品管理
          </h1>
          <p className="text-slate-500 font-bold mt-1">管理品牌統一的商品清單與分類</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/categories')} className="bg-white border-2 border-slate-100 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:border-primary/50 transition-all shadow-sm active:scale-95 text-slate-600">
            <Tag className="w-5 h-5 text-slate-400" />分類管理
          </button>
          <button onClick={() => { setIsEditing(false); setCurrentProduct({ name: '', price: 0, category_id: categories[0]?.id, is_available: true }); setSelectedModifierIds([]); setShowModal(true); }} className="bg-primary text-white px-6 py-2 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <Plus className="w-5 h-5" />新增商品
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
          <input type="text" placeholder="搜尋商品名稱..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-primary border-2 rounded-xl font-bold transition-all outline-none" />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="appearance-none pl-10 pr-10 py-2 bg-slate-50 rounded-xl font-bold text-slate-600 outline-none border-2 border-transparent hover:border-slate-200 cursor-pointer transition-all">
              <option value="all">所有分類</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('card')} className={cn("p-2 rounded-lg transition-all", viewMode === 'card' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600")}><LayoutGrid className="w-5 h-5" /></button>
            <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600")}><List className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{[1,2,3,4].map(i => <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />)}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 font-bold">找不到商品資料</div>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden hover:border-primary/50 transition-all group relative">
               <div className="aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-slate-200" />
                  )}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(product)} className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-600 hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={async () => { if(confirm('刪除商品？')) { await supabase.from('products').delete().eq('id', product.id); fetchInitialData(); } }} className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
               </div>
               <div className="p-5">
                  <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest block mb-1">{categories.find(c => c.id === product.category_id)?.name || '未分類'}</span>
                  <h3 className="text-lg font-black text-slate-900 mb-3">{product.name}</h3>
                  <div className="flex justify-between items-center">
                    <p className="text-xl font-black text-primary">NT$ {product.price}</p>
                    <button onClick={() => toggleStatus(product)} className={cn("px-2 py-1 rounded-md text-[10px] font-black uppercase transition-all", product.is_available ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {product.is_available ? '銷售中' : '已停售'}
                    </button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View (Real Table) */
        <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-left">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">商品資訊</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">分類</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">價格</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">狀態</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-slate-300" />}
                      </div>
                      <span className="font-black text-slate-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-500">{categories.find(c => c.id === product.category_id)?.name || '未分類'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-black text-primary">NT$ {product.price}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleStatus(product)} className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all", product.is_available ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", product.is_available ? "bg-emerald-500" : "bg-red-500")} />
                      {product.is_available ? '銷售中' : '已停售'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg border border-transparent hover:border-slate-100"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={async () => { if(confirm('刪除？')) { await supabase.from('products').delete().eq('id', product.id); fetchInitialData(); } }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-slate-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">{isEditing ? '編輯商品' : '新增商品'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">商品名稱 *</label>
                  <input type="text" value={currentProduct?.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary outline-none transition-all" required />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">價格 *</label>
                  <input type="number" value={currentProduct?.price || 0} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary outline-none transition-all" required />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">分類 *</label>
                  <select value={currentProduct?.category_id || ''} onChange={e => setCurrentProduct({...currentProduct, category_id: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-primary outline-none appearance-none transition-all" required>
                    <option value="">請選擇分類</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">適用自定義選項</label>
                {modifierGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold italic">尚無自定義選項群組</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {modifierGroups.map(group => {
                      const isSelected = selectedModifierIds.includes(group.id);
                      return (
                        <button key={group.id} type="button" onClick={() => setSelectedModifierIds(prev => prev.includes(group.id) ? prev.filter(i => i !== group.id) : [...prev, group.id])} className={cn("px-4 py-3 rounded-xl border-2 font-bold text-sm flex items-center justify-between transition-all", isSelected ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-400")}>
                          {group.name} {isSelected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-50">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">商品狀態</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCurrentProduct({...currentProduct, is_available: true})} className={cn("flex-1 py-3 rounded-2xl font-bold border-2 transition-all", currentProduct?.is_available ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-100 bg-slate-50 text-slate-400")}>銷售中</button>
                  <button type="button" onClick={() => setCurrentProduct({...currentProduct, is_available: false})} className={cn("flex-1 py-3 rounded-2xl font-bold border-2 transition-all", currentProduct?.is_available === false ? "border-red-500 bg-red-50 text-red-600" : "border-slate-100 bg-slate-50 text-slate-400")}>已停售</button>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={saving} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-5 h-5 animate-spin" />} 儲存商品
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
