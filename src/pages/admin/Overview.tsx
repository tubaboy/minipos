import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, 
  ShoppingBag, 
  Coffee, 
  Users2, 
  Store,
  ArrowRight,
  Clock,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// Types
interface OverviewStats {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  topProduct: string;
  activeStores?: number; // Partner only
  activeEmployees?: number; // Store Manager only
}

interface StorePerformance {
  id: string;
  name: string;
  sales: number;
  orderCount: number;
}

interface RecentOrder {
  id: string;
  order_no: string;
  total_amount: number;
  created_at: string;
  status: string;
  items_count: number;
}

// Components
const StatCard = ({ title, value, icon, trend, colorClass }: any) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl transition-colors group-hover:scale-110 duration-300", colorClass)}>
        {icon}
      </div>
      {trend && (
        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {trend}
        </span>
      )}
    </div>
    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
  </div>
);

const SectionHeader = ({ title, icon: Icon, link, linkText }: any) => (
  <div className="flex justify-between items-center mb-6">
    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
      <Icon className="w-6 h-6 text-primary" />
      {title}
    </h3>
    {link && (
      <Link to={link} className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1 group">
        {linkText}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    )}
  </div>
);

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  
  const [stats, setStats] = useState<OverviewStats>({
    totalSales: 0,
    orderCount: 0,
    avgOrderValue: 0,
    topProduct: '-'
  });
  
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [hourlySales, setHourlySales] = useState<number[]>(new Array(24).fill(0));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id, store_id, name')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setRole(profile.role);
      setUserName(profile.name || 'User');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // 2. Base Query for Orders (Today)
      let ordersQuery = supabase
        .from('orders')
        .select('*, items:order_items(product_name, quantity, price)')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', todayIso)
        .order('created_at', { ascending: false });

      if (profile.role === 'store_manager' && profile.store_id) {
        ordersQuery = ordersQuery.eq('store_id', profile.store_id);
      }

      const { data: orders } = await ordersQuery;
      const safeOrders = orders || [];

      // 3. Calculate Stats
      const totalSales = safeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const orderCount = safeOrders.length;
      const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

      // Top Product
      const productCounts: Record<string, number> = {};
      safeOrders.forEach(o => {
        o.items.forEach((i: any) => {
          productCounts[i.product_name] = (productCounts[i.product_name] || 0) + i.quantity;
        });
      });
      const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '無';

      // Hourly Sales
      const hours = new Array(24).fill(0);
      safeOrders.forEach(o => {
        const h = new Date(o.created_at).getHours();
        hours[h] += o.total_amount || 0;
      });
      setHourlySales(hours);

      // 4. Role Specific Data
      if (profile.role === 'partner') {
        // Partner: Store Performance
        const { data: stores } = await supabase
          .from('stores')
          .select('id, name')
          .eq('tenant_id', profile.tenant_id);

        if (stores) {
          const performance = stores.map(store => {
            const storeOrders = safeOrders.filter(o => o.store_id === store.id);
            return {
              id: store.id,
              name: store.name,
              sales: storeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
              orderCount: storeOrders.length
            };
          }).sort((a, b) => b.sales - a.sales);
          setStorePerformance(performance);
        }
        setStats({ totalSales, orderCount, avgOrderValue, topProduct, activeStores: stores?.length || 0 });

      } else {
        // Store Manager: Recent Orders & Active Employees (Mock for now or fetch)
        setRecentOrders(safeOrders.slice(0, 5).map(o => ({
          id: o.id,
          order_no: o.order_number || o.id.slice(0, 8).toUpperCase(),
          total_amount: o.total_amount,
          created_at: o.created_at,
          status: o.status,
          items_count: o.items.length
        })));
        
        // Mock active employees count for now or fetch from profiles
        setStats({ totalSales, orderCount, avgOrderValue, topProduct, activeEmployees: 3 });
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxChartValue = Math.max(...hourlySales, 100); // Minimum scale

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return '早安';
    if (hour >= 11 && hour < 14) return '午安';
    if (hour >= 14 && hour < 18) return '下午好';
    return '晚安';
  }, []);

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold animate-pulse">載入儀表板...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">{greeting}，{userName} 👋</h2>
          <p className="text-slate-400 font-medium">今天是 {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="relative z-10 flex gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">系統狀態</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="font-bold">運作正常</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="今日營收" 
          value={`$${stats.totalSales.toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />} 
          colorClass="bg-emerald-100"
          trend="+8.2%"
        />
        <StatCard 
          title="今日訂單" 
          value={stats.orderCount} 
          icon={<ShoppingBag className="w-6 h-6 text-blue-600" />} 
          colorClass="bg-blue-100"
          trend="+12%"
        />
        <StatCard 
          title="熱銷冠軍" 
          value={stats.topProduct} 
          icon={<Coffee className="w-6 h-6 text-amber-600" />} 
          colorClass="bg-amber-100"
        />
        {role === 'partner' ? (
          <StatCard 
            title="營運門市" 
            value={stats.activeStores} 
            icon={<Store className="w-6 h-6 text-purple-600" />} 
            colorClass="bg-purple-100"
          />
        ) : (
          <StatCard 
            title="平均客單" 
            value={`$${Math.round(stats.avgOrderValue)}`} 
            icon={<Users2 className="w-6 h-6 text-purple-600" />} 
            colorClass="bg-purple-100"
          />
        )}
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Chart Section */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <SectionHeader title="即時銷售趨勢 (24H)" icon={TrendingUp} />
          
          <div className="h-[320px] w-full flex items-end gap-2 sm:gap-4 overflow-x-auto pb-6 pt-10 px-2 scrollbar-hide">
            {hourlySales.map((val, i) => {
              const heightPercent = (val / maxChartValue) * 100;
              const isCurrentHour = i === new Date().getHours();
              
              return (
                <div key={i} className="flex-1 min-w-[24px] flex flex-col justify-end group relative h-full">
                  <div className="relative w-full flex-1 flex items-end">
                    <div 
                      className={cn(
                        "w-full rounded-t-lg transition-all duration-700 ease-out relative group-hover:bg-opacity-80",
                        isCurrentHour ? "bg-primary animate-pulse" : "bg-slate-200 group-hover:bg-primary/60"
                      )}
                      style={{ height: `${Math.max(heightPercent, 4)}%` }} // Min height 4% for visibility
                    >
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] py-1.5 px-3 rounded-xl whitespace-nowrap pointer-events-none transition-all duration-300 z-20 shadow-xl transform group-hover:-translate-y-1">
                        <span className="font-bold block text-xs mb-0.5">${val.toLocaleString()}</span>
                        <span className="text-slate-400">{i}:00 - {i}:59</span>
                        <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-[10px] text-center mt-3 font-bold truncate transition-colors",
                    isCurrentHour ? "text-primary" : "text-slate-300 group-hover:text-slate-500"
                  )}>
                    {i}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Sidebar List Section */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-full max-h-[500px] overflow-hidden flex flex-col">
          {role === 'partner' ? (
            <>
              <SectionHeader title="門市今日業績" icon={Store} link="/admin/reports" linkText="查看報表" />
              <div className="overflow-y-auto pr-2 space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                {storePerformance.map((store, i) => (
                  <div key={store.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group cursor-default">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover:scale-110",
                        i === 0 ? "bg-amber-100 text-amber-600" :
                        i === 1 ? "bg-slate-200 text-slate-600" :
                        i === 2 ? "bg-orange-100 text-orange-600" :
                        "bg-white border border-slate-200 text-slate-400"
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{store.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{store.orderCount} 筆訂單</p>
                      </div>
                    </div>
                    <p className="font-black text-slate-900 group-hover:text-primary transition-colors">
                      ${store.sales.toLocaleString()}
                    </p>
                  </div>
                ))}
                {storePerformance.length === 0 && (
                   <div className="text-center text-slate-400 py-10">尚無門市資料</div>
                )}
              </div>
            </>
          ) : (
            <>
              <SectionHeader title="最新訂單" icon={Clock} link="/admin/orders" linkText="所有訂單" />
              <div className="overflow-y-auto pr-2 space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">#{order.order_no}</p>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          {new Date(order.created_at).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          {order.items_count} 品項
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">${order.total_amount}</p>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">完成</span>
                    </div>
                  </div>
                ))}
                 {recentOrders.length === 0 && (
                   <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-2">
                     <AlertCircle className="w-8 h-8 text-slate-200" />
                     <span>今日尚無訂單</span>
                   </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
