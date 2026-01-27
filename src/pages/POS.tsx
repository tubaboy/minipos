import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { 
  ShoppingCart, User, LogOut, ChevronRight, Plus, Minus, Trash2, Send, 
  CheckCircle2, PlayCircle, Clock, X, RefreshCw 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ModifierOption {
  id: string;
  name: string;
  extra_price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  modifier_groups?: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
}

interface SelectedModifier {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
}

interface CartItem extends Product {
  quantity: number;
  selectedModifiers: SelectedModifier[];
  uuid: string; // Unique ID for cart item (product + modifiers)
}

export default function POS() {
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'take_out'>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  
  // Brand/Store Names
  const [tenantName, setTenantName] = useState('VELO');
  const [storeName, setStoreName] = useState('');
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [tenantSettings, setTenantSettings] = useState({
    allow_dine_in: true,
    allow_take_out: true,
    service_charge_percent: 0
  });
  
  // Modifier Modal State
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [tempModifiers, setTempModifiers] = useState<SelectedModifier[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  const navigate = useNavigate();

  // Load employee session
  const employeeData = localStorage.getItem('velopos_employee');
  const employee = employeeData ? JSON.parse(employeeData) : null;
  
  // Use real tenant_id from employee, or fallback
  const tenantId = employee?.tenant_id;
  const storeId = employee?.store_id;
  const tenantMode = localStorage.getItem('velopos_tenant_mode') || 'multi';

  useEffect(() => {
    if (!employee) {
      navigate('/login');
      return;
    }

    // Set local store name as fallback
    setStoreName(localStorage.getItem('velopos_store_name') || '');

    fetchData();
    if (activeTab === 'history') {
      fetchOrders();
    }

    // 1. Order Listener (Tab sensitive)
    const orderChannel = supabase
      .channel('pos_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [activeTab, tenantId]);

  // 2. Global Status Listeners (Store Settings & Device Status)
  useEffect(() => {
    if (!storeId) return;

    const deviceToken = localStorage.getItem('velopos_device_token');

    const statusChannel = supabase
      .channel('global_status')
      // Monitor Device Revocation
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pos_devices' }, (payload) => {
        if (payload.old && payload.old.device_token === deviceToken) handleKick();
      })
      // Monitor Store Settings (Realtime Sync)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` }, (payload) => {
        console.log("POS: Store update received!", payload.new);
        if (payload.new && payload.new.settings) {
          const s = payload.new.settings;
          setIsStoreOpen(s.is_open ?? true);
          setTenantSettings(prev => ({
            ...prev,
            allow_dine_in: s.allow_dine_in ?? prev.allow_dine_in,
            allow_take_out: s.allow_take_out ?? prev.allow_take_out,
            service_charge_percent: s.service_charge_percent ?? prev.service_charge_percent
          }));
        }
      })
      .subscribe((status) => {
        console.log("POS: Realtime connection status:", status);
      });

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, [storeId]);

  // 3. Robust Heartbeat & Realtime Status
  useEffect(() => {
    const token = localStorage.getItem('velopos_device_token');
    if (!token || !storeId) return;

    console.log("POS: Starting System Monitor for Store:", storeId);

    // Heartbeat Function
    const runHeartbeat = async () => {
      try {
        console.log("POS Heartbeat using token:", token.substring(0, 8) + "...");
        const { data, error } = await supabase.rpc('get_device_session', { p_device_token: token });
        if (error) {
          setIsConnected(false);
          if (error.message?.includes('Invalid Token')) handleKick();
        } else {
          setIsConnected(true);
          // Sync settings from heartbeat response as a fallback
          if (data.store_settings) {
            const s = data.store_settings;
            setIsStoreOpen(s.is_open ?? true);
            setTenantSettings(prev => ({
              ...prev,
              allow_dine_in: s.allow_dine_in ?? prev.allow_dine_in,
              allow_take_out: s.allow_take_out ?? prev.allow_take_out,
              service_charge_percent: Number(s.service_charge_percent ?? prev.service_charge_percent)
            }));
          }
        }
      } catch (e) {
        setIsConnected(false);
      }
    };

    // Realtime Listener
    const statusChannel = supabase
      .channel(`pos_realtime_${storeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` }, (payload) => {
        console.log("POS: Realtime Update Received!", payload.new.settings);
        const s = payload.new.settings;
        if (s) {
          setIsStoreOpen(s.is_open ?? true);
          setTenantSettings(prev => ({
            ...prev,
            allow_dine_in: s.allow_dine_in ?? prev.allow_dine_in,
            allow_take_out: s.allow_take_out ?? prev.allow_take_out,
            service_charge_percent: Number(s.service_charge_percent ?? prev.service_charge_percent)
          }));
        }
      })
      .subscribe();

    runHeartbeat();
    const hbTimer = setInterval(runHeartbeat, 30000);

    return () => {
      clearInterval(hbTimer);
      supabase.removeChannel(statusChannel);
    };
  }, [storeId]); // Re-run if storeId changes

  const handleKick = () => {
    localStorage.removeItem('velopos_device_token');
    localStorage.removeItem('velopos_store_id');
    localStorage.removeItem('velopos_store_name');
    localStorage.removeItem('velopos_device_role');
    localStorage.removeItem('velopos_tenant_mode');
    localStorage.removeItem('velopos_employee');
    toast.error('裝置權限已被撤銷', { description: '此裝置已從後台解除綁定。' });
    navigate('/login');
  };

  async function fetchData() {
    if (!storeId) return;

    try {
      const { data, error } = await supabase.rpc('get_store_menu', { p_store_id: storeId });
      
      if (error) throw error;
      if (!data) return;
      if (data.error) {
        toast.error('裝置異常', { description: '找不到門市資料，請重新綁定' });
        return;
      }

      const { 
        categories: catData, 
        products: prodData, 
        modifier_groups: modGroups, 
        prod_mod_links: prodModLinks,
        cat_mod_links: catModLinks,
        tenant_name,
        tenant_settings,
        tenant_mode,
        store_name,
        store_settings
      } = data;

      // Update names
      if (tenant_name) setTenantName(tenant_name);
      if (store_name) setStoreName(store_name);
      if (tenant_mode) localStorage.setItem('velopos_tenant_mode', tenant_mode);

      // Handle Settings Merging (Safe from RLS)
      const combinedSettings = {
        allow_dine_in: tenant_settings?.allow_dine_in ?? true,
        allow_take_out: tenant_settings?.allow_take_out ?? true,
        service_charge_percent: tenant_settings?.service_charge_percent ?? 0
      };

      if (store_settings) {
        setIsStoreOpen(store_settings.is_open ?? true);
        // Store-specific overrides
        if (store_settings.allow_dine_in !== undefined) combinedSettings.allow_dine_in = store_settings.allow_dine_in;
        if (store_settings.allow_take_out !== undefined) combinedSettings.allow_take_out = store_settings.allow_take_out;
        if (store_settings.service_charge_percent !== undefined) combinedSettings.service_charge_percent = store_settings.service_charge_percent;
      }

      setTenantSettings(combinedSettings);
      
      // Auto-switch order type if current one is disallowed
      if (!combinedSettings.allow_dine_in && orderType === 'dine_in') {
        setOrderType('take_out');
      } else if (!combinedSettings.allow_take_out && orderType === 'take_out') {
        setOrderType('dine_in');
      }

      if (catData) {
        setCategories(catData);
        if (catData.length > 0 && !selectedCategory) setSelectedCategory(catData[0].id);
      }
// ... rest of fetchData

      if (prodData) {
        // Map modifiers to products (including category-level ones)
        const productsWithModifiers = prodData.map((p: any) => {
          // Direct product links
          const directGroupIds = prodModLinks
            ?.filter((link: any) => link.product_id === p.id)
            .map((link: any) => link.modifier_group_id) || [];
          
          // Category-inherited links
          const categoryGroupIds = catModLinks
            ?.filter((link: any) => link.category_id === p.category_id)
            .map((link: any) => link.modifier_group_id) || [];

          // Combine and unique
          const allGroupIds = Array.from(new Set([...directGroupIds, ...categoryGroupIds]));
          
          const groups = modGroups
            ?.filter((g: any) => allGroupIds.includes(g.id))
            .map((g: any) => ({
              id: g.id,
              name: g.name,
              options: g.options || []
            }));

          return { ...p, modifier_groups: groups || [] };
        });

        setProducts(productsWithModifiers);
      }
    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      toast.error('無法載入菜單資料');
    }
  }

  async function fetchOrders() {
    if (!tenantId) return;

    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('tenant_id', tenantId)
      .eq('store_id', storeId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data);
  }

  const handleCloseOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'closed' })
      .eq('id', orderId);
    
    if (error) toast.error('結單失敗');
    else {
      toast.success(tenantMode === 'single' ? '交易已完成' : '訂單已結單');
      fetchOrders();
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('確定要刪除此訂單嗎？此動作無法復原。')) return;

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('Delete error:', error);
      toast.error('刪除失敗');
    } else {
      toast.success('訂單已刪除');
      fetchOrders();
    }
  };

  // --- Cart Logic with Modifiers ---

  const handleProductClick = (product: Product) => {
    if (product.modifier_groups && product.modifier_groups.length > 0) {
      setCurrentProduct(product);
      setTempModifiers([]);
      setIsModifierModalOpen(true);
    } else {
      addToCart(product, []);
    }
  };

  const addToCart = (product: Product, modifiers: SelectedModifier[]) => {
    const modifierKey = modifiers
      .sort((a, b) => a.group_id.localeCompare(b.group_id))
      .map(m => m.option_id)
      .join('|');
    
    const uuid = `${product.id}-${modifierKey}`;

    setCart(prev => {
      const existing = prev.find(item => item.uuid === uuid);
      if (existing) {
        return prev.map(item => item.uuid === uuid ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, selectedModifiers: modifiers, uuid }];
    });

    setIsModifierModalOpen(false);
    toast.success('已加入購物車');
  };

  const updateQuantity = (uuid: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.uuid === uuid) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (uuid: string) => {
    setCart(prev => prev.filter(item => item.uuid !== uuid));
  };

  const calculateItemPrice = (item: CartItem) => {
    const modifiersPrice = item.selectedModifiers.reduce((sum, m) => sum + m.price, 0);
    return (item.price + modifiersPrice) * item.quantity;
  };

  const subtotal = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  const serviceChargePercent = Number(tenantSettings.service_charge_percent || 0);
  const serviceCharge = (orderType === 'dine_in' && serviceChargePercent > 0)
    ? Math.round(subtotal * (serviceChargePercent / 100))
    : 0;
  const total = subtotal + serviceCharge;

  // Debug settings
  useEffect(() => {
    if (tenantSettings.service_charge_percent > 0) {
      console.log("POS: Service Charge Rate detected:", tenantSettings.service_charge_percent, "%");
    }
  }, [tenantSettings.service_charge_percent]);

  // --- Modifier Modal Logic ---

  const toggleModifier = (group: ModifierGroup, option: ModifierOption) => {
    setTempModifiers(prev => {
      const isSelected = prev.some(m => m.group_id === group.id && m.option_id === option.id);
      
      if (isSelected) {
        // Deselect if already selected
        return prev.filter(m => !(m.group_id === group.id && m.option_id === option.id));
      } else {
        // Add to selection (Multi-select allowed)
        return [...prev, {
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price: option.extra_price
        }];
      }
    });
  };

  const handleConfirmModifiers = () => {
    if (!currentProduct) return;
    // Optional: Validate if all required groups are selected? We'll skip validation for now.
    addToCart(currentProduct, tempModifiers);
  };

  // --- Submit Order ---

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('請輸入桌號');
      return;
    }

    try {
      // 1. Verify Device Still Active before submitting
      const deviceToken = localStorage.getItem('velopos_device_token');
      const { data: isValid, error: checkError } = await supabase.rpc('check_device_token', { 
        p_device_token: deviceToken 
      });

      if (checkError || !isValid) {
        handleKick();
        return;
      }

      const { data: orderNumber, error: seqError } = await supabase.rpc('generate_order_number', { p_tenant_id: tenantId });
      if (seqError) throw seqError;

      // In single mode, order status starts as 'completed' (waiting for final close/payment)
      const initialStatus = tenantMode === 'single' ? 'completed' : 'pending';

      const { data: order, error: orderError } = await supabase.from('orders').insert({
        tenant_id: tenantId,
        store_id: storeId,
        order_number: orderNumber,
        type: orderType,
        table_number: tableNumber,
        total_amount: total,
        service_charge: serviceCharge,
        status: initialStatus
      }).select().single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        const unitPrice = item.price + item.selectedModifiers.reduce((s, m) => s + m.price, 0);
        return {
          tenant_id: tenantId,
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: unitPrice, // Store final unit price including modifiers? Or base price? 
          // Schema says 'price'. Usually snapshots the price at that moment.
          // Let's store the full unit price.
          modifiers: item.selectedModifiers // JSONB
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      toast.success(tenantMode === 'single' ? `訂單已成立：${orderNumber}` : `訂單已送出：${orderNumber}`);
      setCart([]);
      setTableNumber('');
    } catch (err: any) {
      toast.error('送單失敗', { description: err.message });
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Category Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20">
            <User className="text-white w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">{employee?.role === 'store_manager' ? '店長' : '員工'}</p>
            <p className="font-bold text-white">{employee?.name || '未登入'}</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar">
          <div className="mb-6 hidden md:block">
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">系統功能</p>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('order')}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-left font-medium transition-all flex items-center gap-3 cursor-pointer",
                  activeTab === 'order' 
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Plus className="w-4 h-4" /> <span className="text-sm">點餐頁面</span>
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-left font-medium transition-all flex items-center gap-3 cursor-pointer",
                  activeTab === 'history' 
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <ShoppingCart className="w-4 h-4" /> <span className="text-sm">{tenantMode === 'single' ? '交易紀錄' : '訂單管理'}</span>
              </button>
              {employee?.role === 'store_manager' && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="w-full px-3 py-2.5 rounded-lg text-left font-medium transition-all flex items-center gap-3 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <User className="w-4 h-4" /> <span className="text-sm">後台管理</span>
                </button>
              )}
            </div>
          </div>

          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">商品分類</p>
          {categories
            .filter(cat => products.some(p => p.category_id === cat.id))
            .map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setActiveTab('order'); }}
              className={cn(
                "px-3 py-2.5 rounded-lg text-left transition-all whitespace-nowrap md:whitespace-normal flex items-center justify-between group cursor-pointer",
                selectedCategory === cat.id && activeTab === 'order'
                  ? "bg-slate-800 text-teal-400 border border-slate-700" 
                  : "hover:bg-slate-800/50 text-slate-400 hover:text-white"
              )}
            >
              <span className="text-sm font-medium">{cat.name}</span>
              <ChevronRight className={cn(
                "w-3.5 h-3.5 transition-transform hidden md:block",
                selectedCategory === cat.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
              )} />
            </button>
          ))}
        </nav>

        <div className="mt-auto px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isConnected ? "System Online" : "System Offline"}
            </span>
          </div>
        </div>

        <button 
          onClick={() => navigate('/login')}
          className="m-4 p-3 flex items-center gap-3 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">登出系統</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-slate-50 relative">
        {!isStoreOpen && activeTab === 'order' && (
          <div className="absolute inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">門市暫停營業中</h2>
              <p className="text-slate-500 font-bold mb-8">目前本門市暫不接受點餐，請洽詢店長開啟營業狀態。</p>
              <button 
                onClick={() => fetchData()}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-black transition-all"
              >
                <RefreshCw className="w-5 h-5" /> 檢查更新
              </button>
            </div>
          </div>
        )}

        {activeTab === 'order' ? (
          <>
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {categories.find(c => c.id === selectedCategory)?.name || '商品項目'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {tenantMode === 'single' ? '快速點餐結帳' : '選擇商品加入購物車'}
                </p>
              </div>
              
              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {tenantSettings.allow_dine_in && (
                  <button 
                    onClick={() => setOrderType('dine_in')}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer",
                      orderType === 'dine_in' ? "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200" : "text-slate-500 hover:text-slate-900"
                    )}
                  >內用</button>
                )}
                {tenantSettings.allow_take_out && (
                  <button 
                    onClick={() => setOrderType('take_out')}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer",
                      orderType === 'take_out' ? "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200" : "text-slate-500 hover:text-slate-900"
                    )}
                  >外帶</button>
                )}
              </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.filter(p => p.category_id === selectedCategory).map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="bg-white border border-slate-200 p-4 rounded-xl text-left hover:border-teal-500/50 hover:shadow-lg hover:shadow-teal-900/5 transition-all group active:scale-[0.98] cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="aspect-square bg-slate-50 rounded-lg mb-4 flex items-center justify-center group-hover:bg-teal-50 transition-colors relative">
                    <span className="text-3xl group-hover:scale-110 transition-transform duration-300">☕</span>
                    {product.modifier_groups && product.modifier_groups.length > 0 && (
                       <span className="absolute bottom-1 right-1 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-teal-200">
                         客製
                       </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1 text-sm">{product.name}</h3>
                  <p className="text-lg font-bold text-teal-600 group-hover:text-teal-700 transition-colors">
                    {formatCurrency(product.price)}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-primary">{tenantMode === 'single' ? '今日交易' : '訂單管理'}</h2>
                <p className="text-primary/40 text-sm font-bold uppercase tracking-widest mt-1">
                   {tenantMode === 'single' ? '管理進行中的交易' : '即時訂單狀態監控'}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-primary/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-primary">
                    {tenantMode === 'single' ? '待結帳: ' : '已完成可結單: '}
                    {orders.filter(o => o.status === 'completed').length}
                  </span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {orders.map(order => (
                <ReceiptCard 
                  key={order.id} 
                  order={order} 
                  tenantName={tenantName}
                  storeName={storeName}
                  tenantMode={tenantMode}
                  onClose={() => handleCloseOrder(order.id)}
                  onDelete={() => handleDeleteOrder(order.id)}
                />
              ))}
              {orders.length === 0 && (
                <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20 text-muted-foreground">
                  <ShoppingCart className="w-24 h-24 mb-4" />
                  <p className="text-2xl font-black">目前無進行中訂單</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modifier Modal */}
        {isModifierModalOpen && currentProduct && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{currentProduct.name}</h3>
                  <p className="text-sm text-slate-500">請選擇客製化選項</p>
                </div>
                <button 
                  onClick={() => setIsModifierModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {currentProduct.modifier_groups?.map(group => (
                  <div key={group.id} className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-1 h-4 bg-teal-500 rounded-full" />
                      {group.name}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {group.options.map(option => {
                        const isSelected = tempModifiers.some(m => m.group_id === group.id && m.option_id === option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => toggleModifier(group, option)}
                            className={cn(
                              "px-3 py-2.5 rounded-lg text-sm font-medium border text-left transition-all cursor-pointer flex justify-between items-center group",
                              isSelected
                                ? "bg-teal-50 border-teal-500 text-teal-700 shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span>{option.name}</span>
                            {option.extra_price > 0 && (
                              <span className={cn("text-xs", isSelected ? "text-teal-600" : "text-slate-400")}>
                                +{option.extra_price}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="flex justify-between items-center mb-4 text-sm">
                   <span className="text-slate-500">小計</span>
                   <span className="font-bold text-lg text-slate-900">
                     {formatCurrency(currentProduct.price + tempModifiers.reduce((s, m) => s + m.price, 0))}
                   </span>
                </div>
                <button
                  onClick={handleConfirmModifiers}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold text-base shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  確認加入
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      {activeTab === 'order' && (
        <aside className="w-full md:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-teal-600 w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-800">當前購物車</h2>
            </div>
            <span className="bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-teal-100">
              {cart.reduce((s, i) => s + i.quantity, 0)} 項
            </span>
          </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-sm">購物車是空的</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uuid} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center gap-3 shadow-sm hover:border-teal-100 transition-colors group">
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                    <p className="text-xs text-slate-500 font-medium whitespace-nowrap">
                       {formatCurrency((item.price + item.selectedModifiers.reduce((s, m) => s + m.price, 0)) * item.quantity)}
                    </p>
                  </div>
                  {item.selectedModifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.selectedModifiers.map((m, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                          {m.option_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200 self-center">
                  <button 
                    onClick={() => updateQuantity(item.uuid, -1)}
                    className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-teal-600 hover:scale-110 transition-all cursor-pointer"
                  ><Minus className="w-3 h-3" /></button>
                  <span className="font-bold w-4 text-center text-slate-700 text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.uuid, 1)}
                    className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-teal-600 hover:scale-110 transition-all cursor-pointer"
                  ><Plus className="w-3 h-3" /></button>
                </div>
                <button 
                  onClick={() => removeItem(item.uuid)}
                  className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100 self-center"
                ><Trash2 className="w-4 h-4" /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
          {orderType === 'dine_in' && (
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">桌號</span>
              <input 
                type="text" 
                placeholder="輸入桌號"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-900 placeholder:text-slate-300 text-right"
              />
            </div>
          )}
          
          <div className="space-y-1 pt-2 border-t border-slate-200 mt-2">
            {cart.length > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>商品小計 Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            )}
            {serviceCharge > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-teal-600 uppercase tracking-wider">
                <span>服務費 Service Charge ({serviceChargePercent}%)</span>
                <span>{formatCurrency(serviceCharge)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2">
              <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">應付總額 Total</span>
              <span className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Send className="w-5 h-5" />
            {tenantMode === 'single' ? '完成下單' : '確認送單'}
          </button>
        </div>
      </aside>
      )}
    </div>
  );
}

function ReceiptCard({ order, tenantName, storeName, tenantMode, onClose, onDelete }: { 
  order: any, 
  tenantName: string, 
  storeName: string, 
  tenantMode: string, 
  onClose: () => void,
  onDelete: () => void 
}) {
  const statusConfig = {
    pending: { 
      label: '待確認', 
      icon: <Clock className="w-4 h-4" />,
      containerClass: "border-slate-200",
      badgeClass: "bg-slate-500",
      headerClass: "text-slate-400"
    },
    processing: { 
      label: '處理中', 
      icon: <PlayCircle className="w-4 h-4" />,
      containerClass: "border-blue-400 shadow-lg shadow-blue-500/10",
      badgeClass: "bg-blue-500",
      headerClass: "text-blue-500"
    },
    completed: { 
      label: tenantMode === 'single' ? '待出餐' : '請出餐', 
      icon: <CheckCircle2 className="w-4 h-4" />,
      containerClass: tenantMode === 'single' ? "border-teal-500" : "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse ring-2 ring-emerald-500/20",
      badgeClass: tenantMode === 'single' ? "bg-teal-600" : "bg-emerald-500",
      headerClass: tenantMode === 'single' ? "text-teal-700" : "text-emerald-600"
    }
  };

  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
  const showDelete = (tenantMode === 'single') || (tenantMode !== 'single' && order.status === 'pending');

  return (
    <div className="relative animate-in fade-in slide-in-from-top-4 duration-500 group">
      <div className={cn(
        "bg-white shadow-xl rounded-xl p-8 font-mono text-slate-800 border-2 relative transition-all duration-300",
        config.containerClass
      )}>
        {/* Decorative top strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 rounded-t-sm" />
        
        <div className="text-center mb-6 pt-2">
          <h3 className="font-black text-2xl mb-1 tracking-tighter uppercase text-slate-900">{tenantName}</h3>
          <p className="text-xs opacity-60 tracking-widest">**** {storeName} RECEIPT ****</p>
          <div className="my-4 border-b border-dashed border-slate-300" />
          <div className={cn("flex justify-between text-sm font-bold", config.headerClass)}>
            <span>ORDER: #{order.order_number}</span>
            <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between text-xs font-black border-b border-slate-200 pb-2 uppercase opacity-60 text-slate-500">
            <span className="flex-1 text-left">ITEM</span>
            <span className="w-12 text-center">QTY</span>
            <span className="w-20 text-right">PRICE</span>
          </div>
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex flex-col text-sm font-bold leading-tight">
              <div className="flex justify-between">
                <span className="flex-1 text-left truncate pr-2 text-slate-700">{item.product_name}</span>
                <span className="w-12 text-center text-slate-500">x{item.quantity}</span>
                <span className="w-20 text-right text-slate-900">{item.price * item.quantity}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 pl-0">
                  {item.modifiers.map((m: any, idx: number) => (
                     <span key={idx} className="text-[10px] text-slate-400 font-medium">
                       + {m.option_name}
                     </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t-2 border-double border-slate-300 pt-4 mb-6 space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-500">
            <span>SUBTOTAL</span>
            <span>${order.total_amount - (order.service_charge || 0)}</span>
          </div>
          {order.service_charge > 0 && (
            <div className="flex justify-between text-xs font-bold text-teal-600">
              <span>SERVICE CHARGE</span>
              <span>${order.service_charge}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-3xl text-slate-900 pt-1">
            <span>TOTAL</span>
            <span>${order.total_amount}</span>
          </div>
          <div className="flex justify-between text-sm mt-6 font-black border-2 border-slate-200 p-3 text-center uppercase bg-slate-50 rounded-lg text-slate-600">
            <span className="flex-1">{order.type === 'dine_in' ? `Table: ${order.table_number}` : 'Take Away'}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center justify-center gap-2 py-3 rounded-lg text-white font-black text-sm mb-4 shadow-md transition-all",
          config.badgeClass
        )}>
          {config.icon}
          {config.label}
        </div>

        {showDelete && (
          <button
            onClick={onDelete}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-base mb-3 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Trash2 className="w-5 h-5" />
            刪除訂單
          </button>
        )}

        {order.status === 'completed' && (
          <button
            onClick={onClose}
            className={cn(
               "w-full text-white py-4 rounded-xl font-black text-base uppercase tracking-[0.2em] transition-all active:scale-[0.98] cursor-pointer shadow-lg",
               tenantMode === 'single' ? "bg-slate-900 hover:bg-black shadow-slate-900/20" : "bg-slate-900 hover:bg-black shadow-slate-900/20"
            )}
          >
            {tenantMode === 'single' ? '完成交易 (已出餐)' : '結單'}
          </button>
        )}

        {/* Decorative bottom strip */}
        <div className="mt-8 text-center opacity-30">
          <p className="text-[10px] font-bold">THANK YOU FOR YOUR VISIT</p>
          <div className="flex justify-center gap-1.5 mt-2">
            {[...Array(15)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
