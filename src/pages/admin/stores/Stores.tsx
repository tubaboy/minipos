import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Store, MapPin, Trash2, Edit2, X, ClipboardList, Check, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StoreType = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string;
};

type StoreProduct = {
  product_id: string;
  price: number | null;
  is_active: boolean;
};

export default function Stores() {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Store Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Menu Config Modal State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [storeProducts, setStoreProducts] = useState<Record<string, StoreProduct>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast.error('無法載入門市列表', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMenuModal = async (store: StoreType) => {
    setSelectedStore(store);
    setShowMenuModal(true);
    setLoadingMenu(true);

    try {
      // 1. Fetch all brand products
      const { data: products } = await supabase.from('products').select('*').order('name');
      setAllProducts(products || []);

      // 2. Fetch current store menu assignments
      const { data: currentMenu } = await supabase
        .from('store_products')
        .select('*')
        .eq('store_id', store.id);

      const menuMap: Record<string, StoreProduct> = {};
      currentMenu?.forEach(item => {
        menuMap[item.product_id] = {
          product_id: item.product_id,
          price: item.price,
          is_active: item.is_active
        };
      });
      setStoreProducts(menuMap);
    } catch (error: any) {
      toast.error('載入菜單失敗');
    } finally {
      setLoadingMenu(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setStoreProducts(prev => {
      const existing = prev[productId];
      if (existing) {
        return {
          ...prev,
          [productId]: { ...existing, is_active: !existing.is_active }
        };
      } else {
        return {
          ...prev,
          [productId]: { product_id: productId, price: null, is_active: true }
        };
      }
    });
  };

  const updateStorePrice = (productId: string, price: string) => {
    const numPrice = price === '' ? null : Number(price);
    setStoreProducts(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || { product_id: productId, is_active: true }), price: numPrice }
    }));
  };

  const handleSaveMenu = async () => {
    if (!selectedStore) return;
    setSavingMenu(true);

    try {
      const assignments = Object.values(storeProducts);
      
      // We use a simple strategy: delete current and insert new (or use upsert if we want to be fancy)
      // Since store_products has a unique constraint on (store_id, product_id)
      const dataToUpsert = assignments.map(item => ({
        store_id: selectedStore.id,
        product_id: item.product_id,
        price: item.price,
        is_active: item.is_active
      }));

      const { error } = await supabase
        .from('store_products')
        .upsert(dataToUpsert, { onConflict: 'store_id,product_id' });

      if (error) throw error;
      toast.success('菜單配置已儲存');
      setShowMenuModal(false);
    } catch (error: any) {
      toast.error('儲存失敗', { description: error.message });
    } finally {
      setSavingMenu(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').single();
      if (isEditing && currentStoreId) {
        const { error } = await supabase.from('stores').update({ name, address }).eq('id', currentStoreId);
        if (error) throw error;
        toast.success('門市更新成功');
      } else {
        const { error } = await supabase.from('stores').insert([{ name, address, tenant_id: profile?.tenant_id }]);
        if (error) throw error;
        toast.success('門市建立成功');
      }
      setShowModal(false);
      resetForm();
      fetchStores();
    } catch (error: any) {
      toast.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentStoreId(null);
    setName('');
    setAddress('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Store className="w-8 h-8 text-primary" />門市管理</h1>
          <p className="text-slate-500 font-bold mt-1">管理您品牌旗下的分店資料與菜單配置</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all">
          <Plus className="w-5 h-5" />新增門市
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center text-slate-400 font-bold">尚無門市資料</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 hover:border-primary/50 transition-all group">
              <div className="flex justify-between mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors"><Store /></div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setIsEditing(true); setCurrentStoreId(store.id); setName(store.name); setAddress(store.address || ''); setShowModal(true); }} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { if(confirm('刪除？')) { await supabase.from('stores').delete().eq('id', store.id); fetchStores(); } }} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{store.name}</h3>
              <p className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-6"><MapPin className="w-4 h-4" />{store.address || '未設定地址'}</p>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenMenuModal(store)}
                  className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  配置菜單
                </button>
                <button className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-sm font-black hover:bg-slate-100 transition-colors">
                  管理員工
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Store Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{isEditing ? '編輯門市' : '新增門市'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="門市名稱" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" required />
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="門市地址" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black">{submitting ? '儲存中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Menu Config Modal */}
      {showMenuModal && selectedStore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-8 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">配置門市菜單</h2>
                <p className="text-slate-500 font-bold">{selectedStore.name} | 勾選要販售的商品</p>
              </div>
              <button onClick={() => setShowMenuModal(false)} className="p-2 hover:bg-slate-50 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {loadingMenu ? (
                <div className="text-center py-20 text-slate-400 font-bold">載入商品中...</div>
              ) : allProducts.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">請先在「商品管理」建立品牌商品</div>
              ) : (
                <div className="grid gap-3">
                  {allProducts.map(product => {
                    const isAssigned = storeProducts[product.id]?.is_active;
                    const storePrice = storeProducts[product.id]?.price;
                    
                    return (
                      <div 
                        key={product.id} 
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                          isAssigned ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <button 
                          onClick={() => toggleProduct(product.id)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            isAssigned ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-slate-100 text-slate-300"
                          )}
                        >
                          {isAssigned ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </button>
                        
                        <div className="flex-1">
                          <p className="font-black text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">總部價格: NT$ {product.price}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">門市專屬價格</label>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300 font-bold text-sm">NT$</span>
                              <input 
                                type="number" 
                                placeholder={product.price.toString()}
                                value={storePrice ?? ''}
                                onChange={(e) => updateStorePrice(product.id, e.target.value)}
                                className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-900 outline-none focus:border-primary text-right"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex gap-4">
              <button onClick={() => setShowMenuModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black hover:bg-slate-100 transition-colors">取消</button>
              <button 
                onClick={handleSaveMenu}
                disabled={savingMenu}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                {savingMenu ? '儲存中...' : '確認上架'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
