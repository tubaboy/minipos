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
  AlertCircle,
  Building2,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// Types
interface OverviewStats {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  topProduct?: string;
  activeStores?: number; // Partner only
  activeEmployees?: number; // Store Manager only
  activeTenants?: number; // Super Admin only
}

interface PerformanceItem {
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

interface Tenant {
  id: string;
  name: string;
}

interface TrendPoint {
  label: string;
  value: number;
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

const TrendChart = ({ data }: { data: TrendPoint[] }) => {
  const maxVal = Math.max(...data.map(p => p.value), 100);
  const chartHeight = 320;
  const padding = 20;
  const width = 800; // Reference width for SVG coordinate system
  
  if (data.length === 0) return null;

  const points = data.map((p, i) => {
    const x = (i / (data.length - 1 || 1)) * (width - padding * 2) + padding;
    const y = chartHeight - ((p.value / maxVal) * (chartHeight - padding * 2) + padding);
    return { x, y, value: p.value, label: p.label };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <div className="relative group/chart w-full overflow-x-auto pb-4 custom-scrollbar">
      <div className="min-w-[600px] h-[320px] relative">
        <svg 
          viewBox={`0 0 ${width} ${chartHeight}`} 
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <line
              key={i}
              x1={padding}
              y1={chartHeight - (v * (chartHeight - padding * 2) + padding)}
              x2={width - padding}
              y2={chartHeight - (v * (chartHeight - padding * 2) + padding)}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          ))}

          {/* Area Fill */}
          <path
            d={areaPath}
            fill="url(#chartGradient)"
            className="transition-all duration-1000 ease-out"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-1000 ease-out"
          />

          {/* Points */}
          {points.map((p, i) => (
            <g key={i} className="group/point">
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                className="fill-white stroke-primary stroke-2 transition-all duration-300 opacity-0 group-hover/chart:opacity-100"
              />
              {/* Tooltip Target */}
              <rect
                x={p.x - 10}
                y={0}
                width={20}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
              />
            </g>
          ))}

          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Labels & Tooltips (HTML Overlay for better rendering) */}
        <div className="absolute inset-0 pointer-events-none">
          {points.filter((_, i) => data.length < 15 || i % Math.floor(data.length / 8) === 0).map((p, i) => (
            <div
              key={i}
              className="absolute text-[10px] font-bold text-slate-400 -bottom-1 -translate-x-1/2"
              style={{ left: `${(p.x / width) * 100}%` }}
            >
              {p.label}
            </div>
          ))}
        </div>

        {/* Interactive Tooltip Helper */}
        <div className="absolute inset-0 flex">
           {points.map((p, i) => (
             <div 
               key={i} 
               className="flex-1 group/tooltip relative cursor-crosshair pointer-events-auto"
             >
               <div className="opacity-0 group-hover/tooltip:opacity-100 absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-4 bg-slate-900 text-white text-[10px] py-2 px-3 rounded-xl whitespace-nowrap z-30 shadow-2xl transition-all duration-200">
                  <p className="font-black text-xs mb-0.5">${p.value.toLocaleString()}</p>
                  <p className="text-slate-400 font-bold">{p.label}</p>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
               </div>
               {/* Vertical Hover Line */}
               <div className="absolute top-0 bottom-0 left-1/2 w-px bg-primary/20 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none" />
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

type DateRange = 'today' | 'week' | 'month' | 'custom';

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customRange, setCustomRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [stats, setStats] = useState<OverviewStats>({
    totalSales: 0,
    orderCount: 0,
    avgOrderValue: 0,
    topProduct: '-'
  });
  
  const [performanceItems, setPerformanceItems] = useState<PerformanceItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (role) {
      fetchDashboardData();
    }
  }, [role, dateRange, selectedTenantId, customRange]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id, store_id, name')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setRole(profile.role);
      setUserName(profile.name || 'User');

      if (profile.role === 'super_admin') {
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('id, name')
          .order('name');
        setTenants(tenantsData || []);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchDashboardData = async () => {
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

      // Date Filtering
      let startIso: string;
      let endIso: string = new Date().toISOString();
      
      if (dateRange === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startIso = d.toISOString();
      } else if (dateRange === 'week') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        startIso = d.toISOString();
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        startIso = d.toISOString();
      } else {
        // Custom
        const s = new Date(customRange.start);
        s.setHours(0, 0, 0, 0);
        startIso = s.toISOString();
        
        const e = new Date(customRange.end);
        e.setHours(23, 59, 59, 999);
        endIso = e.toISOString();
      }

      // Base Query
      let ordersQuery = supabase
        .from('orders')
        .select('id, total_amount, created_at, tenant_id, store_id, status');

      // Role & Tenant Filtering
      if (profile.role === 'super_admin') {
        if (selectedTenantId !== 'all') {
          ordersQuery = ordersQuery.eq('tenant_id', selectedTenantId);
        }
      } else {
        ordersQuery = ordersQuery.eq('tenant_id', profile.tenant_id);
        if (profile.role === 'store_manager' && profile.store_id) {
          ordersQuery = ordersQuery.eq('store_id', profile.store_id);
        }
      }

      // Apply Date Filter
      ordersQuery = ordersQuery.gte('created_at', startIso).lte('created_at', endIso);

      const { data: orders } = await ordersQuery;
      const safeOrders = orders || [];

      // Calculate Stats
      const totalSales = safeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const orderCount = safeOrders.length;
      const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

      // Trend Aggregation
      const aggregatedTrend: TrendPoint[] = [];
      if (dateRange === 'today') {
        // Hourly
        const hoursMap = new Array(24).fill(0);
        safeOrders.forEach(o => {
          const h = new Date(o.created_at).getHours();
          hoursMap[h] += o.total_amount || 0;
        });
        for (let i = 0; i < 24; i++) {
          aggregatedTrend.push({ label: `${i}:00`, value: hoursMap[i] });
        }
      } else {
        // Daily
        const dailyMap: Record<string, number> = {};
        const startDate = new Date(startIso);
        const endDate = new Date(endIso);
        
        // Initialize all days in range with 0
        const current = new Date(startDate);
        while (current <= endDate) {
          const dateStr = current.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
          dailyMap[dateStr] = 0;
          current.setDate(current.getDate() + 1);
        }

        safeOrders.forEach(o => {
          const dateStr = new Date(o.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
          if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += o.total_amount || 0;
          }
        });

        Object.entries(dailyMap).forEach(([label, value]) => {
          aggregatedTrend.push({ label, value });
        });
      }
      setTrendData(aggregatedTrend);

      // Role Specific Data
      if (profile.role === 'super_admin') {
        // Super Admin: Partner Performance
        const { data: allTenants } = await supabase
          .from('tenants')
          .select('id, name');

        if (allTenants) {
          const performance = allTenants.map(t => {
            const tenantOrders = safeOrders.filter(o => o.tenant_id === t.id);
            return {
              id: t.id,
              name: t.name,
              sales: tenantOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
              orderCount: tenantOrders.length
            };
          }).filter(p => p.orderCount > 0 || selectedTenantId === 'all')
            .sort((a, b) => b.sales - a.sales);
          
          setPerformanceItems(performance);
          setStats({ 
            totalSales, 
            orderCount, 
            avgOrderValue, 
            activeTenants: allTenants.length 
          });
        }
      } else if (profile.role === 'partner') {
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
          setPerformanceItems(performance);
        }

        // Top Product for Partner
        const { data: topProdOrders } = await supabase
          .from('orders')
          .select('items:order_items(product_name, quantity)')
          .eq('tenant_id', profile.tenant_id)
          .gte('created_at', startIso)
          .lte('created_at', endIso);
        
        const productCounts: Record<string, number> = {};
        topProdOrders?.forEach(o => {
          (o.items as any[]).forEach(i => {
            productCounts[i.product_name] = (productCounts[i.product_name] || 0) + i.quantity;
          });
        });
        const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '無';

        setStats({ 
          totalSales, 
          orderCount, 
          avgOrderValue, 
          topProduct, 
          activeStores: stores?.length || 0 
        });

      } else {
        // Store Manager: Recent Orders
        const { data: recentOrdersData } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, created_at, status, items:order_items(id)')
          .eq('store_id', profile.store_id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentOrders((recentOrdersData || []).map(o => ({
          id: o.id,
          order_no: o.order_number || o.id.slice(0, 8).toUpperCase(),
          total_amount: o.total_amount,
          created_at: o.created_at,
          status: o.status,
          items_count: (o.items as any[]).length
        })));
        
        setStats({ totalSales, orderCount, avgOrderValue, activeEmployees: 3 });
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return '早安';
    if (hour >= 11 && hour < 14) return '午安';
    if (hour >= 14 && hour < 18) return '下午好';
    return '晚安';
  }, []);

  if (loading && !role) {
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
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

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'today', label: '本日' },
              { id: 'week', label: '本週' },
              { id: 'month', label: '本月' },
              { id: 'custom', label: '自訂' },
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id as DateRange)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  dateRange === range.id 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">至</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          )}
        </div>

        {role === 'super_admin' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="relative flex-1 sm:w-64">
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-2xl px-4 py-2.5 font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="all">所有合作夥伴</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={dateRange === 'today' ? "今日營收" : "累積營收"} 
          value={`$${stats.totalSales.toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />} 
          colorClass="bg-emerald-100"
          trend={dateRange === 'today' ? "+8.2%" : undefined}
        />
        <StatCard 
          title={dateRange === 'today' ? "今日訂單" : "累積訂單"} 
          value={stats.orderCount.toLocaleString()} 
          icon={<ShoppingBag className="w-6 h-6 text-blue-600" />} 
          colorClass="bg-blue-100"
          trend={dateRange === 'today' ? "+12%" : undefined}
        />
        
        {role === 'super_admin' ? (
          <>
            <StatCard 
              title="客單均價" 
              value={`$${Math.round(stats.avgOrderValue).toLocaleString()}`} 
              icon={<Users2 className="w-6 h-6 text-purple-600" />} 
              colorClass="bg-purple-100"
            />
            <StatCard 
              title="品牌客戶" 
              value={stats.activeTenants} 
              icon={<Building2 className="w-6 h-6 text-amber-600" />} 
              colorClass="bg-amber-100"
            />
          </>
        ) : (
          <>
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
                value={`$${Math.round(stats.avgOrderValue).toLocaleString()}`} 
                icon={<Users2 className="w-6 h-6 text-purple-600" />} 
                colorClass="bg-purple-100"
              />
            )}
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Chart Section */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <SectionHeader 
            title={dateRange === 'today' ? "即時銷售趨勢 (24H)" : "銷售表現趨勢"} 
            icon={TrendingUp} 
          />
          
          <div className="mt-4">
            <TrendChart data={trendData} />
          </div>
        </div>
        
        {/* Sidebar List Section */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm h-full max-h-[500px] overflow-hidden flex flex-col">
          {role === 'super_admin' ? (
            <>
              <SectionHeader title="合作夥伴業績" icon={Building2} link="/admin/tenants" linkText="管理客戶" />
              <div className="overflow-y-auto pr-2 space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                {performanceItems.map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group cursor-default">
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
                        <p className="font-bold text-slate-900 truncate max-w-[120px]">{item.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{item.orderCount.toLocaleString()} 筆訂單</p>
                      </div>
                    </div>
                    <p className="font-black text-slate-900 group-hover:text-primary transition-colors">
                      ${item.sales.toLocaleString()}
                    </p>
                  </div>
                ))}
                {performanceItems.length === 0 && (
                   <div className="text-center text-slate-400 py-10">尚無業績資料</div>
                )}
              </div>
            </>
          ) : role === 'partner' ? (
            <>
              <SectionHeader title="門市業績表現" icon={Store} link="/admin/reports" linkText="查看報表" />
              <div className="overflow-y-auto pr-2 space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                {performanceItems.map((store, i) => (
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
                {performanceItems.length === 0 && (
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
