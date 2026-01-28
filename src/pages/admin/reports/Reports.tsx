import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Store,
  Coffee,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  total_amount: number;
  created_at: string;
  store_id: string;
  items: OrderItem[];
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
}

interface Store {
  id: string;
  name: string;
}

const StatCard = ({ title, value, icon, trend, subValue }: any) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-primary/5 transition-colors duration-300">
        {icon}
      </div>
      {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>}
    </div>
    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
    {subValue && <p className="text-xs text-slate-400 mt-2 font-medium">{subValue}</p>}
  </div>
);

export default function Reports() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange, customStart, customEnd, selectedStoreId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id, store_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setRole(profile.role);

      // Fetch Stores (for mapping names & filtering)
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id);
      
      if (storesData) setStores(storesData);

      // Calculate Date Range
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date(); // Default to now
      
      if (dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        startDate.setDate(now.getDate() - 7);
        endDate = now;
      } else if (dateRange === 'month') {
        startDate.setMonth(now.getMonth() - 1);
        endDate = now;
      } else if (dateRange === 'custom') {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }

      // Build Query
      let query = supabase
        .from('orders')
        .select('*, items:order_items(product_name, quantity, price)')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (profile.role === 'store_manager' && profile.store_id) {
        query = query.eq('store_id', profile.store_id);
      } else if (profile.role === 'partner' && selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      const { data: ordersData, error } = await query;
      
      if (error) throw error;
      setOrders(ordersData || []);

    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Sales by Store
    const salesByStore: Record<string, number> = {};
    orders.forEach(order => {
      if (order.store_id) {
        salesByStore[order.store_id] = (salesByStore[order.store_id] || 0) + (order.total_amount || 0);
      }
    });

    // Top Products
    const productSales: Record<string, { quantity: number, revenue: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.product_name]) {
          productSales[item.product_name] = { quantity: 0, revenue: 0 };
        }
        productSales[item.product_name].quantity += item.quantity;
        productSales[item.product_name].revenue += item.quantity * item.price;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return { totalSales, totalOrders, avgOrderValue, salesByStore, topProducts };
  }, [orders]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data: number[] = [];
    const labels: string[] = [];
    
    if (orders.length === 0) return { data, labels };

    if (dateRange === 'today') {
      // Hourly
      const hours = new Array(24).fill(0);
      orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hours[hour] += order.total_amount || 0;
      });
      return { 
        data: hours, 
        labels: hours.map((_, i) => `${i}時`) 
      };
    } else {
      // Daily
      const daysMap: Record<string, number> = {};
      
      // Initialize map with 0 for all days in range if feasible? 
      // For now, simpler to just show days with sales or sparse.
      // Better: Sort orders by date (already done in query), then bucket.
      
      orders.forEach(order => {
        const date = new Date(order.created_at);
        const dayKey = date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
        daysMap[dayKey] = (daysMap[dayKey] || 0) + (order.total_amount || 0);
      });

      return {
        data: Object.values(daysMap),
        labels: Object.keys(daysMap)
      };
    }
  }, [orders, dateRange]);

  const maxChartValue = Math.max(...chartData.data, 1);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 whitespace-nowrap">
            <BarChart3 className="w-6 h-6 text-primary" />
            銷售概況
          </h3>
          
          {role === 'partner' && (
            <div className="relative group w-full sm:w-auto">
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="appearance-none w-full sm:w-48 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl px-4 py-2.5 pr-10 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="all">所有門市</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {dateRange === 'custom' && (
             <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-600 px-2 py-1 outline-none"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-600 px-2 py-1 outline-none"
                />
             </div>
          )}

          <div className="flex p-1 bg-slate-50 border border-slate-200 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['today', 'week', 'month', 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                  dateRange === r 
                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-100" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                {r === 'today' ? '今日' : r === 'week' ? '本週' : r === 'month' ? '本月' : '自訂'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="總銷售額" 
          value={`NT$ ${stats.totalSales.toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-500" />} 
        />
        <StatCard 
          title="總訂單數" 
          value={stats.totalOrders} 
          icon={<ShoppingBag className="w-6 h-6 text-blue-500" />} 
          subValue={`平均客單價: NT$ ${Math.round(stats.avgOrderValue)}`}
        />
        <StatCard 
          title="熱銷商品" 
          value={stats.topProducts[0]?.name || '-'} 
          icon={<Coffee className="w-6 h-6 text-amber-500" />} 
          subValue={stats.topProducts[0] ? `售出 ${stats.topProducts[0].quantity} 份` : ''}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              銷售趨勢
            </h3>
            {dateRange !== 'today' && (
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                日銷售額
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400 animate-pulse">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                <span>載入數據中...</span>
              </div>
            </div>
          ) : orders.length > 0 ? (
            <div className="relative">
              {/* Chart Container with horizontal scroll */}
              <div className="h-[300px] flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent px-2">
                {chartData.data.map((val, i) => (
                  <div key={i} className="flex-1 min-w-[40px] flex flex-col justify-end group relative h-full">
                    
                    {/* Tooltip Wrapper */}
                    <div className="relative flex-1 w-full flex items-end">
                       <div className="w-full bg-slate-50 rounded-t-xl relative overflow-hidden transition-all duration-300 group-hover:bg-slate-100 h-full">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-primary/80 rounded-t-xl transition-all duration-1000 ease-out group-hover:from-primary/90 group-hover:to-primary" 
                            style={{ height: `${(val / maxChartValue) * 100}%` }} 
                          >
                          </div>
                       </div>
                       
                       {/* Floating Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap pointer-events-none transition-all duration-200 z-20 shadow-xl flex flex-col items-center gap-0.5">
                          <span className="font-bold text-xs">NT${val.toLocaleString()}</span>
                          <span className="text-slate-400 text-[9px]">{chartData.labels[i]}</span>
                          <div className="w-2 h-2 bg-slate-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                        </div>
                    </div>

                    <div className="text-[10px] text-center text-slate-400 mt-3 font-bold truncate w-full group-hover:text-primary transition-colors">
                      {chartData.labels[i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                <BarChart3 className="w-8 h-8 text-slate-200" />
                <span className="font-medium">此區間尚無銷售資料</span>
             </div>
          )}
        </div>

        {/* Top Products / Stores */}
        <div className="space-y-6">
          {/* Top Products */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-fit">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-500" />
              熱銷排行
            </h3>
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-3 hover:bg-amber-50/50 rounded-2xl transition-all group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black shadow-sm transition-transform group-hover:scale-110",
                      i === 0 ? "bg-amber-500 text-white" : 
                      i === 1 ? "bg-slate-400 text-white" :
                      i === 2 ? "bg-orange-700/50 text-white" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.quantity} 份</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-700 text-sm">NT${p.revenue.toLocaleString()}</span>
                </div>
              ))}
              {stats.topProducts.length === 0 && <p className="text-slate-400 text-center py-4 text-sm">無銷售資料</p>}
            </div>
          </div>

          {/* Store Performance (Partner Only) */}
          {role === 'partner' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-fit">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-500" />
                門市業績占比
              </h3>
              <div className="space-y-5">
                {stores.map((store) => {
                  const sales = stats.salesByStore[store.id] || 0;
                  const percent = stats.totalSales > 0 ? (sales / stats.totalSales) * 100 : 0;
                  
                  return (
                    <div key={store.id} className="space-y-2 group">
                      <div className="flex justify-between text-sm font-bold text-slate-900">
                        <span className="group-hover:text-blue-600 transition-colors">{store.name}</span>
                        <span>NT$ {sales.toLocaleString()}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out relative" 
                          style={{ width: `${percent}%` }} 
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-bold">
                        {percent.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
                {stores.length === 0 && <p className="text-slate-400 text-center text-sm">尚無門市資料</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
