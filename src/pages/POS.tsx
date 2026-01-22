import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { ShoppingCart, User, LogOut, ChevronRight, Plus, Minus, Trash2, Send, CheckCircle2, PlayCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends Product {
  quantity: number;
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
  const navigate = useNavigate();

  const tenantId = '00000000-0000-0000-0000-000000000001'; // Mock tenant

  useEffect(() => {
    fetchData();
    if (activeTab === 'history') {
      fetchOrders();
    }

    // Subscribe to realtime for orders
    const channel = supabase
      .channel('pos_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  async function fetchData() {
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order');
    
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId);

    if (catError) console.error('Categories fetch error:', catError);
    if (prodError) console.error('Products fetch error:', prodError);

    if (catData) {
      setCategories(catData);
      if (catData.length > 0 && !selectedCategory) setSelectedCategory(catData[0].id);
    }
    if (prodData) setProducts(prodData);
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('tenant_id', tenantId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data);
  }

  const handleCloseOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'closed' })
      .eq('id', orderId);
    
    if (error) alert('結單失敗');
    else fetchOrders();
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === 'dine_in' && !tableNumber) {
      alert('請輸入桌號');
      return;
    }

    try {
      // 1. Generate order number using the RPC (we'll assume the generate_order_number works or we do it here)
      const { data: orderNumber, error: seqError } = await supabase.rpc('generate_order_number', { p_tenant_id: tenantId });
      
      if (seqError) throw seqError;

      // 2. Create Order
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        type: orderType,
        table_number: tableNumber,
        total_amount: total,
        status: 'pending'
      }).select().single();

      if (orderError) throw orderError;

      // 3. Create Order Items
      const orderItems = cart.map(item => ({
        tenant_id: tenantId,
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      alert(`訂單已送出！編號：${orderNumber}`);
      setCart([]);
      setTableNumber('');
    } catch (err: any) {
      alert('送單失敗：' + err.message);
    }
  };

  return (
    <div className="h-screen bg-[#FAF5FF] flex flex-col md:flex-row overflow-hidden font-['Plus_Jakarta_Sans']">
      {/* Category Sidebar */}
      <aside className="w-full md:w-64 bg-white/80 backdrop-blur-md border-r border-primary/10 flex flex-col">
        <div className="p-6 border-b border-primary/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <User className="text-white w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">員工 001</p>
            <p className="font-bold text-primary">櫃檯點餐</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar">
          <div className="mb-4 hidden md:block">
            <p className="px-4 text-[10px] font-black text-primary/40 uppercase tracking-widest mb-2">系統功能</p>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('order')}
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-left font-bold transition-all flex items-center gap-3 cursor-pointer",
                  activeTab === 'order' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-primary/60 hover:bg-primary/5"
                )}
              >
                <Plus className="w-5 h-5" /> 點餐頁面
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-left font-bold transition-all flex items-center gap-3 cursor-pointer",
                  activeTab === 'history' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-primary/60 hover:bg-primary/5"
                )}
              >
                <ShoppingCart className="w-5 h-5" /> 訂單管理
              </button>
            </div>
          </div>

          <p className="px-4 text-[10px] font-black text-primary/40 uppercase tracking-widest mb-2 hidden md:block">商品分類</p>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setActiveTab('order'); }}
              className={cn(
                "px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap md:whitespace-normal flex items-center justify-between group cursor-pointer",
                selectedCategory === cat.id && activeTab === 'order'
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "hover:bg-primary/5 text-primary/70"
              )}
            >
              <span className="font-semibold">{cat.name}</span>
              <ChevronRight className={cn(
                "w-4 h-4 transition-transform hidden md:block",
                selectedCategory === cat.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
              )} />
            </button>
          ))}
        </nav>

        <button 
          onClick={() => navigate('/login')}
          className="m-4 p-3 flex items-center gap-3 text-destructive hover:bg-destructive/5 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold">登出系統</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
        {activeTab === 'order' ? (
          <>
            <header className="mb-8 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-primary">
                {categories.find(c => c.id === selectedCategory)?.name || '商品項目'}
              </h2>
              <div className="flex bg-white p-1 rounded-xl border border-primary/10">
                <button 
                  onClick={() => setOrderType('dine_in')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                    orderType === 'dine_in' ? "bg-primary text-white" : "text-primary/60 hover:text-primary"
                  )}
                >內用</button>
                <button 
                  onClick={() => setOrderType('take_out')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                    orderType === 'take_out' ? "bg-primary text-white" : "text-primary/60 hover:text-primary"
                  )}
                >外帶</button>
              </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.filter(p => p.category_id === selectedCategory).map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white/80 backdrop-blur-sm border border-primary/5 p-4 rounded-3xl text-left hover:shadow-xl hover:shadow-primary/5 transition-all group active:scale-95 cursor-pointer"
                >
                  <div className="aspect-square bg-primary/5 rounded-2xl mb-4 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <span className="text-4xl">☕</span>
                  </div>
                  <h3 className="font-bold text-primary mb-1">{product.name}</h3>
                  <p className="text-xl font-black text-primary/40 group-hover:text-primary transition-colors">
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
                <h2 className="text-3xl font-bold text-primary">訂單管理</h2>
                <p className="text-primary/40 text-sm font-bold uppercase tracking-widest mt-1">即時訂單狀態監控</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-primary/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-primary">已完成可結單: {orders.filter(o => o.status === 'completed').length}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {orders.map(order => (
                <ReceiptCard key={order.id} order={order} onClose={() => handleCloseOrder(order.id)} />
              ))}
              {orders.length === 0 && (
                <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20">
                  <ShoppingCart className="w-24 h-24 mb-4" />
                  <p className="text-2xl font-black">目前無進行中訂單</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Cart Sidebar - Only visible in 'order' tab */}
      {activeTab === 'order' && (
        <aside className="w-full md:w-96 bg-white border-l border-primary/10 flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-primary w-6 h-6" />
              <h2 className="text-xl font-bold text-primary">購物車</h2>
            </div>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)} 項
            </span>
          </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <ShoppingCart className="w-12 h-12 mb-4" />
              <p>購物車是空的</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-[#FAF5FF] p-4 rounded-2xl flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-primary">{item.name}</p>
                  <p className="text-sm text-primary/60">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-white border border-primary/10 flex items-center justify-center text-primary cursor-pointer"
                  ><Minus className="w-4 h-4" /></button>
                  <span className="font-bold w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-primary/10 flex items-center justify-center text-primary cursor-pointer"
                  ><Plus className="w-4 h-4" /></button>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="text-destructive p-2 hover:bg-destructive/5 rounded-lg cursor-pointer"
                ><Trash2 className="w-4 h-4" /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-[#FAF5FF] border-t border-primary/10 space-y-4">
          {orderType === 'dine_in' && (
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-primary/10">
              <span className="text-sm font-bold text-primary">桌號</span>
              <input 
                type="text" 
                placeholder="請輸入桌號"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-primary"
              />
            </div>
          )}
          
          <div className="flex justify-between items-end">
            <span className="text-muted-foreground font-bold text-sm uppercase tracking-wider">應付總額</span>
            <span className="text-4xl font-black text-primary">{formatCurrency(total)}</span>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Send className="w-6 h-6" />
            確認送單
          </button>
        </div>
      </aside>
      )}
    </div>
  );
}

function ReceiptCard({ order, onClose }: { order: any, onClose: () => void }) {
  const statusConfig = {
    pending: { label: '待確認', color: 'bg-slate-500', icon: <Clock className="w-4 h-4" /> },
    processing: { label: '處理中', color: 'bg-blue-500', icon: <PlayCircle className="w-4 h-4" /> },
    completed: { label: '已完成', color: 'bg-emerald-500', icon: <CheckCircle2 className="w-4 h-4" /> }
  };

  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className="relative animate-in fade-in slide-in-from-top-4 duration-500 group">
      <div className="bg-white shadow-xl rounded-sm p-8 font-mono text-slate-800 border border-slate-200 relative">
        {/* Decorative top strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100" />
        
        <div className="text-center mb-6 pt-2">
          <h3 className="font-black text-2xl mb-1 tracking-tighter uppercase">Gemini Coffee</h3>
          <p className="text-xs opacity-60 tracking-widest">**** STORE RECEIPT ****</p>
          <div className="my-4 border-b border-dashed border-slate-300" />
          <div className="flex justify-between text-sm font-bold">
            <span>ORDER: #{order.order_number}</span>
            <span>{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>STAFF: 001</span>
            <span>{new Date(order.created_at).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between text-xs font-black border-b border-slate-200 pb-2 uppercase opacity-60">
            <span className="flex-1 text-left">ITEM</span>
            <span className="w-12 text-center">QTY</span>
            <span className="w-20 text-right">PRICE</span>
          </div>
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm font-bold leading-tight">
              <span className="flex-1 text-left truncate pr-2">{item.product_name}</span>
              <span className="w-12 text-center">x{item.quantity}</span>
              <span className="w-20 text-right">{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="border-t-2 border-double border-slate-300 pt-4 mb-6">
          <div className="flex justify-between font-black text-3xl">
            <span>TOTAL</span>
            <span>${order.total_amount}</span>
          </div>
          <div className="flex justify-between text-sm mt-6 font-black border-2 border-slate-800 p-3 text-center uppercase bg-slate-50">
            <span className="flex-1">{order.type === 'dine_in' ? `Table: ${order.table_number}` : 'Take Away'}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center justify-center gap-2 py-3 rounded-lg text-white font-black text-sm mb-4",
          config.color
        )}>
          {config.icon}
          {config.label}
        </div>

        {order.status === 'completed' && (
          <button
            onClick={onClose}
            className="w-full bg-slate-900 text-white py-5 rounded-xl font-black text-base uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 cursor-pointer shadow-lg shadow-black/20"
          >
            Finalize Order
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
