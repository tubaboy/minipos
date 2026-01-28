import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, PlayCircle, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  notes?: string;
  modifiers?: {
    group_name: string;
    option_name: string;
  }[];
}

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'completed' | 'closed';
  type: 'dine_in' | 'take_out';
  table_number?: string;
  created_at: string;
  order_items: OrderItem[];
}

interface KDSSettings {
  overdue_minutes: number;
  show_dine_in: boolean;
  show_take_out: boolean;
  auto_clear_completed_minutes: number;
}

const KitchenContext = createContext<{ settings: KDSSettings }>({
  settings: {
    overdue_minutes: 15,
    show_dine_in: true,
    show_take_out: true,
    auto_clear_completed_minutes: 10
  }
});

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<KDSSettings>({
    overdue_minutes: 15,
    show_dine_in: true,
    show_take_out: true,
    auto_clear_completed_minutes: 10
  });
  
  const navigate = useNavigate();

  // Load employee session
  const employeeData = localStorage.getItem('velopos_employee');
  const employee = employeeData ? JSON.parse(employeeData) : null;
  const storeId = employee?.store_id;
  const deviceToken = localStorage.getItem('velopos_device_token');

  useEffect(() => {
    if (!employee) {
      navigate('/login');
      return;
    }

    initKitchen();

    // Subscribe to changes
    const ordersChannel = supabase
      .channel('kitchen_orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' }, 
        () => fetchOrders()
      )
      .subscribe();

    const deviceChannel = supabase
      .channel('device_status')
      .on(
        'postgres_changes', 
        { event: 'DELETE', schema: 'public', table: 'pos_devices' }, 
        (payload) => {
          if (payload.old && payload.old.device_token === deviceToken) {
            handleKick();
          }
        }
      )
      .subscribe();

    const storeChannel = supabase
      .channel('store_settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
        (payload) => {
          if (payload.new.settings?.kds_settings) {
            setSettings(payload.new.settings.kds_settings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(deviceChannel);
      supabase.removeChannel(storeChannel);
    };
  }, []);

  async function initKitchen() {
    if (!storeId) return;

    try {
      const { data: store } = await supabase
        .from('stores')
        .select('settings')
        .eq('id', storeId)
        .single();
      
      if (store?.settings?.kds_settings) {
        setSettings(store.settings.kds_settings);
      }

      fetchOrders();
    } catch (e) {
      console.error('Init error:', e);
    }
  }

  async function fetchOrders() {
    if (!storeId) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('store_id', storeId)
      .in('status', ['pending', 'processing', 'completed'])
      .order('created_at', { ascending: true });

    if (error) console.error('Fetch error:', error);
    else setOrders(data || []);
  }

  const handleKick = () => {
    localStorage.removeItem('velopos_device_token');
    localStorage.removeItem('velopos_store_id');
    localStorage.removeItem('velopos_store_name');
    localStorage.removeItem('velopos_device_role');
    localStorage.removeItem('velopos_tenant_mode');
    localStorage.removeItem('velopos_employee');
    alert('此裝置已解除綁定，即將登出。');
    navigate('/login');
  };

  async function updateStatus(orderId: string, status: Order['status']) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) alert('更新失敗');
  }

  const filteredOrders = useMemo(() => {
    const now = new Date().getTime();
    return orders.filter(order => {
      // 1. Type filter
      if (order.type === 'dine_in' && !settings.show_dine_in) return false;
      if (order.type === 'take_out' && !settings.show_take_out) return false;

      // 2. Auto hide completed (KDS UI Filter only)
      if (order.status === 'completed' && settings.auto_clear_completed_minutes > 0) {
        const completedTime = new Date(order.updated_at || order.created_at).getTime();
        const diffMinutes = (now - completedTime) / 60000;
        if (diffMinutes > settings.auto_clear_completed_minutes) return false;
      }

      return true;
    });
  }, [orders, settings]);

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const processingOrders = filteredOrders.filter(o => o.status === 'processing');
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');

  const storeName = localStorage.getItem('velopos_store_name');

  return (
    <KitchenContext.Provider value={{ settings }}>
      <div className="h-screen bg-[#1E1B4B] flex flex-col font-sans text-white">
        {/* Header */}
        <header className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{storeName} 廚房接單系統</h1>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                {employee?.name} (職位: {employee?.role === 'store_manager' ? '店長' : '廚務'})
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-sm font-bold">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <span>待確認: {pendingOrders.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span>處理中: {processingOrders.length}</span>
              </div>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Kanban Board */}
        <main className="flex-1 overflow-hidden flex p-6 gap-6">
          {/* Column: Pending */}
          <section className="flex-1 flex flex-col gap-4 min-w-[350px]">
            <div className="flex items-center gap-2 text-amber-500 font-black uppercase tracking-widest text-sm mb-2">
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              待確認訂單
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {pendingOrders.map(order => (
                <OrderCard key={order.id} order={order} onAction={() => updateStatus(order.id, 'processing')} actionLabel="接單" actionIcon={<PlayCircle className="w-5 h-5" />} actionColor="bg-amber-500" />
              ))}
            </div>
          </section>

          {/* Column: Processing */}
          <section className="flex-1 flex flex-col gap-4 min-w-[350px] border-x border-white/5 px-6">
            <div className="flex items-center gap-2 text-blue-400 font-black uppercase tracking-widest text-sm mb-2">
              <Clock className="w-4 h-4" />
              處理中
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {processingOrders.map(order => (
                <OrderCard key={order.id} order={order} onAction={() => updateStatus(order.id, 'completed')} actionLabel="完成" actionIcon={<CheckCircle2 className="w-5 h-5" />} actionColor="bg-blue-500" />
              ))}
            </div>
          </section>

          {/* Column: Completed */}
          <section className="flex-1 flex flex-col gap-4 min-w-[350px]">
            <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm mb-2">
              <CheckCircle2 className="w-4 h-4" />
              已完成 (待出餐)
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {completedOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAction={() => {}} 
                  actionLabel="待出餐" 
                  actionIcon={<CheckCircle2 className="w-5 h-5" />} 
                  actionColor="bg-emerald-500/50 cursor-default hover:brightness-100 active:scale-100" 
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </KitchenContext.Provider>
  );
}

function OrderCard({ order, onAction, actionLabel, actionIcon, actionColor }: { order: Order, onAction: () => void, actionLabel: string, actionIcon: React.ReactNode, actionColor: string }) {
  const { settings } = useContext(KitchenContext);
  const [now, setNow] = useState(new Date().getTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeElapsed = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = timeElapsed >= settings.overdue_minutes && order.status !== 'completed';
  
  return (
    <div className={cn(
      "bg-white/10 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-500",
      isUrgent 
        ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse" 
        : "border-white/10 hover:border-white/20 shadow-none"
    )}>
      <div className={cn(
        "p-4 flex items-center justify-between border-b",
        isUrgent ? "bg-red-500/20 border-red-500/20" : "bg-white/5 border-white/5"
      )}>
        <div>
          <span className={cn(
            "text-xs font-bold uppercase tracking-tighter",
            isUrgent ? "text-red-300" : "text-white/40"
          )}>Order</span>
          <p className="text-lg font-black tracking-tighter">{order.order_number}</p>
        </div>
        <div className="text-right">
          <span className={cn(
            "px-2 py-1 rounded text-[10px] font-black uppercase",
            order.type === 'dine_in' ? "bg-primary text-white" : "bg-white text-black"
          )}>
            {order.type === 'dine_in' ? `桌號: ${order.table_number}` : '外帶'}
          </span>
          <p className={cn(
            "text-xs mt-1 font-bold transition-colors",
            isUrgent ? "text-red-400" : "text-white/40"
          )}>
            {isUrgent && "逾時 "}
            {timeElapsed} 分鐘前
          </p>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        {order.order_items.map(item => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
              {item.quantity}
            </span>
            <div className="flex-1">
              <p className="font-bold text-lg leading-tight">{item.product_name}</p>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.modifiers.map((m, idx) => (
                    <span key={idx} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                      {m.option_name}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && <p className="text-xs text-amber-400 font-semibold mt-1">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onAction}
        className={cn(
          "w-full py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer",
          actionColor
        )}
      >
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  );
}