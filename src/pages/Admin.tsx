import { 
  LayoutDashboard, 
  Users, 
  Coffee, 
  BarChart3, 
  History, 
  LogOut,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  Users2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Sub-pages (Stubs)
const Overview = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="今日銷售" value="NT$ 12,480" icon={<TrendingUp className="text-emerald-500" />} trend="+12.5%" />
      <StatCard title="訂單數量" value="84" icon={<ShoppingBag className="text-blue-500" />} trend="+3.2%" />
      <StatCard title="熱銷商品" value="拿鐵咖啡" icon={<Coffee className="text-amber-500" />} />
      <StatCard title="在線員工" value="3" icon={<Users2 className="text-purple-500" />} />
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-primary/5 shadow-sm">
        <h3 className="text-xl font-bold text-primary mb-6">銷售趨勢</h3>
        <div className="h-[300px] flex items-end gap-4">
          {[40, 60, 45, 90, 65, 80, 50].map((h, i) => (
            <div key={i} className="flex-1 bg-primary/10 rounded-t-xl relative group">
              <div 
                className="bg-primary rounded-t-xl transition-all duration-1000 group-hover:bg-primary/80" 
                style={{ height: `${h}%` }} 
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-4 text-xs font-bold text-primary/40 uppercase">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl p-8 border border-primary/5 shadow-sm">
        <h3 className="text-xl font-bold text-primary mb-6">熱門類別</h3>
        <div className="space-y-6">
          <CategoryProgress name="義式咖啡" value={75} color="bg-primary" />
          <CategoryProgress name="茶飲系列" value={45} color="bg-blue-500" />
          <CategoryProgress name="精緻甜點" value={25} color="bg-amber-500" />
        </div>
      </div>
    </div>
  </div>
);

const StatCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-white rounded-3xl p-6 border border-primary/5 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>}
    </div>
    <p className="text-sm font-bold text-primary/40 uppercase tracking-wider mb-1">{title}</p>
    <p className="text-3xl font-black text-primary">{value}</p>
  </div>
);

const CategoryProgress = ({ name, value, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm font-bold text-primary">
      <span>{name}</span>
      <span>{value}%</span>
    </div>
    <div className="h-2 bg-primary/5 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const Employees = () => <div className="p-8 bg-white rounded-3xl border border-primary/5">員工管理 (開發中)</div>;
const Products = () => <div className="p-8 bg-white rounded-3xl border border-primary/5">商品管理 (開發中)</div>;
const Reports = () => <div className="p-8 bg-white rounded-3xl border border-primary/5">銷售報表 (開發中)</div>;
const HistoryLogs = () => <div className="p-8 bg-white rounded-3xl border border-primary/5">登入歷史 (開發中)</div>;

export default function Admin() {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: '總覽' },
    { path: '/admin/employees', icon: <Users className="w-5 h-5" />, label: '員工管理' },
    { path: '/admin/products', icon: <Coffee className="w-5 h-5" />, label: '商品管理' },
    { path: '/admin/reports', icon: <BarChart3 className="w-5 h-5" />, label: '銷售報表' },
    { path: '/admin/history', icon: <History className="w-5 h-5" />, label: '歷史記錄' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF5FF] flex font-['Plus_Jakarta_Sans']">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-primary/5 flex flex-col fixed inset-y-0 shadow-sm z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight">MiniPOS</h1>
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-primary/60 hover:bg-primary/5 hover:text-primary"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <button 
            onClick={() => navigate('/login')}
            className="w-full p-4 flex items-center gap-4 text-destructive font-bold hover:bg-destructive/5 rounded-2xl transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>登出系統</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-12">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black text-primary mb-2">
              {menuItems.find(i => i.path === location.pathname)?.label || '管理系統'}
            </h2>
            <p className="text-primary/40 font-bold uppercase tracking-widest text-xs">
              Gemini Coffee • 店長模式
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold text-primary">林管理員</p>
              <p className="text-xs text-primary/40">總部管理者</p>
            </div>
            <div className="w-12 h-12 bg-white rounded-2xl border border-primary/10 flex items-center justify-center">
              <Users className="text-primary w-6 h-6" />
            </div>
          </div>
        </header>

        <Routes>
          <Route index element={<Overview />} />
          <Route path="employees" element={<Employees />} />
          <Route path="products" element={<Products />} />
          <Route path="reports" element={<Reports />} />
          <Route path="history" element={<HistoryLogs />} />
        </Routes>
      </main>
    </div>
  );
}
