import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Store, MapPin, Trash2, Edit2, X, ClipboardList, Check, ShoppingBag, Loader2 } from 'lucide-react';
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

type Category = {
  id: string;
  name: string;
};

import EmployeesModal from './EmployeesModal';

export default function Stores() {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [managers, setManagers] = useState<Record<string, { name: string }>>({});
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
  const [menuCategories, setMenuCategories] = useState<Category[]>([]);
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState<string>('all');
  const [subscribedCategoryIds, setSubscribedCategoryIds] = useState<string[]>([]);
  const [storeProducts, setStoreProducts] = useState<Record<string, StoreProduct>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);

  // Employees Modal State (PIN Staff)
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);

  // Manager Account Modal State (Email/Pwd)
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerName, setManagerName] = useState('');
  const [creatingManager, setCreatingManager] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data: storesData, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStores(storesData || []);

      if (storesData && storesData.length > 0) {
         const { data: profiles } = await supabase
           .from('profiles')
           .select('store_id, name')
           .eq('role', 'store_manager')
           .in('store_id', storesData.map(s => s.id));
         
         const managerMap: Record<string, { name: string }> = {};
         profiles?.forEach(p => {
            if(p.store_id) managerMap[p.store_id] = { name: p.name };
         });
         setManagers(managerMap);
      }
    } catch (error: any) {
      toast.error('無法載入門市列表', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    setCreatingManager(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (managerEmail.toLowerCase() === currentUser?.email?.toLowerCase()) {
        throw new Error('店長 Email 不可與總部帳號相同，請使用不同的電子郵件。');
      }

      const { data, error } = await supabase.functions.invoke('create-partner-user', {
        body: {
          action: 'create',
          email: managerEmail,
          password: managerPassword,
          name: managerName,
          role: 'store_manager',
          storeId: selectedStore.id
        }
      });

      if (error) throw error;
      if (data?.error) {
        // Humanize common errors
        if (data.error.includes('already registered')) {
          throw new Error('此 Email 已被註冊使用，請換一個 Email 或使用 boss+store1@gmail.com 格式。');
        }
        throw new Error(data.error);
      }

      toast.success('店長帳號建立成功');
      setShowManagerModal(false);
      setManagerEmail('');
      setManagerPassword('');
      setManagerName('');
      fetchStores();
    } catch (error: any) {
      toast.error('建立失敗', { description: error.message });
    } finally {
      setCreatingManager(false);
    }
  };

  const handleOpenMenuModal = async (store: StoreType) => {
    setSelectedStore(store);
    setShowMenuModal(true);
    setLoadingMenu(true);
    setSelectedMenuCategoryId('all');

    try {
      const [{ data: products }, { data: cats }, { data: subs }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('store_categories').select('category_id').eq('store_id', store.id)
      ]);
      
      setAllProducts(products || []);
      setMenuCategories(cats || []);
      setSubscribedCategoryIds(subs?.map(s => s.category_id) || []);

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
        return { ...prev, [productId]: { ...existing, is_active: !existing.is_active } };
      } else {
        return { ...prev, [productId]: { product_id: productId, price: null, is_active: true } };
      }
    });
  };

  const toggleCategory = (catId: string) => {
    if (catId === 'all') return;
    
    const productsInCat = allProducts.filter(p => p.category_id === catId);
    const isCurrentlySubscribed = subscribedCategoryIds.includes(catId);
    
    setSubscribedCategoryIds(prev => 
      isCurrentlySubscribed ? prev.filter(id => id !== catId) : [...prev, catId]
    );

    setStoreProducts(prev => {
      const next = { ...prev };
      productsInCat.forEach(p => {
        next[p.id] = { 
          ...(prev[p.id] || { product_id: p.id, price: null }), 
          is_active: !isCurrentlySubscribed 
        };
      });
      return next;
    });
    
    toast.info(!isCurrentlySubscribed ? '已訂閱分類，未來新商品將自動上架' : '已取消分類訂閱');
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
      await supabase.from('store_categories').delete().eq('store_id', selectedStore.id);
      if (subscribedCategoryIds.length > 0) {
        const subData = subscribedCategoryIds.map(cid => ({
          store_id: selectedStore.id,
          category_id: cid
        }));
        await supabase.from('store_categories').insert(subData);
      }

      const assignments = Object.values(storeProducts);
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
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      if (isEditing && currentStoreId) {
        await supabase.from('stores').update({ name, address }).eq('id', currentStoreId);
        toast.success('門市更新成功');
      } else {
        await supabase.from('stores').insert([{ name, address, tenant_id: profile?.tenant_id }]);
        toast.success('門市建立成功');
      }
      setShowModal(false);
      setName(''); setAddress(''); setCurrentStoreId(null);
      fetchStores();
    } catch (error: any) {
      toast.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProductsForMenu = allProducts.filter(p => 
    selectedMenuCategoryId === 'all' || p.category_id === selectedMenuCategoryId
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Store className="w-8 h-8 text-primary" />門市管理</h1>
          <p className="text-slate-500 font-bold mt-1">管理品牌分店與自動化菜單配置</p>
        </div>
        <button onClick={() => { setIsEditing(false); setName(''); setAddress(''); setShowModal(true); }} className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all">
          <Plus className="w-5 h-5" />新增門市
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 hover:border-primary/50 transition-all group">
              <div className="flex justify-between mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors"><Store /></div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setIsEditing(true); setCurrentStoreId(store.id); setName(store.name); setAddress(store.address || ''); setShowModal(true); }} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { if(confirm('刪除門市？')) { await supabase.from('stores').delete().eq('id', store.id); fetchStores(); } }} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{store.name}</h3>
              <p className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-2"><MapPin className="w-4 h-4" />{store.address || '未設定地址'}</p>
              
              {managers[store.id] ? (
                <div className="mb-6 bg-purple-50 text-purple-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-purple-100">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  店長: {managers[store.id].name}
                </div>
              ) : (
                <div className="mb-6 h-9" />
              )}
              
              <div className="flex gap-2">
                <button onClick={() => handleOpenMenuModal(store)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                  <ClipboardList className="w-4 h-4" />配置菜單
                </button>
                <button onClick={() => { setSelectedStore(store); setShowEmployeesModal(true); }} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-sm font-black hover:bg-slate-100 transition-colors">
                  前台員工 PIN
                </button>
              </div>
              <button onClick={() => { setSelectedStore(store); setShowManagerModal(true); }} className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl text-sm font-bold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all">
                + 建立店長後台帳號
              </button>
            </div>
          ))}
        </div>
      )}

      {showEmployeesModal && selectedStore && (
        <EmployeesModal storeId={selectedStore.id} storeName={selectedStore.name} onClose={() => setShowEmployeesModal(false)} />
      )}

      {showManagerModal && selectedStore && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-1">建立店長帳號</h2>
            <p className="text-slate-500 font-bold mb-6 text-sm">為 {selectedStore.name} 建立後台管理權限</p>
            <form onSubmit={handleCreateManager} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">店長姓名</label>
                <input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">登入 Email</label>
                <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" required />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">* 必須與總部帳號不同。可用 boss+store1@gmail.com 格式。</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">登入密碼</label>
                <input type="password" value={managerPassword} onChange={e => setManagerPassword(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowManagerModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={creatingManager} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black">
                  {creatingManager ? '建立中...' : '確認建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{isEditing ? '編輯門市' : '新增門市'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="門市名稱" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" required />
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="門市地址" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-primary" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black">取消</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black">{submitting ? '儲存中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2 no-scrollbar">
              <button onClick={() => setSelectedMenuCategoryId('all')} className={cn("px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all", selectedMenuCategoryId === 'all' ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-500 hover:bg-slate-100")}>所有商品</button>
              {menuCategories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedMenuCategoryId(cat.id)} className={cn("px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all", selectedMenuCategoryId === cat.id ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-500 hover:bg-slate-100")}>{cat.name}</button>
              ))}
            </div>

            {selectedMenuCategoryId !== 'all' && (
              <div className="mb-4 px-1">
                <button onClick={() => toggleCategory(selectedMenuCategoryId)} className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                  {subscribedCategoryIds.includes(selectedMenuCategoryId) ? '取消分類訂閱 (停止自動上架新商品)' : '訂閱此分類 (未來新商品將自動在此店上架)'}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {loadingMenu ? (
                <div className="text-center py-20 text-slate-400 font-bold">載入商品中...</div>
              ) : filteredProductsForMenu.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">此分類尚無商品</div>
              ) : (
                <div className="grid gap-3">
                  {filteredProductsForMenu.map(product => {
                    const isAssigned = storeProducts[product.id]?.is_active;
                    const storePrice = storeProducts[product.id]?.price;
                    return (
                      <div key={product.id} className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 transition-all", isAssigned ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 hover:border-slate-200")}>
                        <button onClick={() => toggleProduct(product.id)} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", isAssigned ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-slate-100 text-slate-300")}>{isAssigned ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}</button>
                        <div className="flex-1">
                          <p className="font-black text-slate-900">{product.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">總部價格: NT$ {product.price} | {menuCategories.find(c => c.id === product.category_id)?.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">門市專屬價格</label>
                            <div className="flex items-center gap-2"><span className="text-slate-300 font-bold text-sm">NT$</span><input type="number" placeholder={product.price.toString()} value={storePrice ?? ''} onChange={e => updateStorePrice(product.id, e.target.value)} className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-900 outline-none focus:border-primary text-right" /></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex gap-4">
              <button onClick={() => setShowMenuModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black">取消</button>
              <button onClick={handleSaveMenu} disabled={savingMenu} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2">
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