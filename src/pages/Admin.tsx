import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Coffee, 
  BarChart3, 
  LogOut,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  Users2,
  Building2,
  Settings as SettingsIcon,
  ChefHat,
  Store,
  Tag,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Employees from './admin/employees/Employees';
import Products from './admin/Products';
import Tenants from './admin/tenants/Tenants';
import Stores from './admin/stores/Stores';
import Categories from './admin/categories/Categories';
import Modifiers from './admin/modifiers/Modifiers';
import Settings from './admin/Settings';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import Logo from '@/components/Logo';

// --- Sub-components (Stat Cards & Overview) ---

const StatCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>}
    </div>
    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-900">{value}</p>
  </div>
);

const CategoryProgress = ({ name, value, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm font-bold text-slate-900">
      <span>{name}</span>
      <span>{value}%</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const Overview = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="今日銷售" value="NT$ 12,480" icon={<TrendingUp className="text-emerald-500" />} trend="+12.5%" />
      <StatCard title="訂單數量" value="84" icon={<ShoppingBag className="text-blue-500" />} trend="+3.2%" />
      <StatCard title="熱銷商品" value="拿鐵咖啡" icon={<Coffee className="text-amber-500" />} />
      <StatCard title="在線員工" value="3" icon={<Users2 className="text-purple-500" />} />
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">銷售趨勢</h3>
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
        <div className="flex justify-between mt-4 text-xs font-bold text-slate-400 uppercase">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">熱門類別</h3>
        <div className="space-y-6">
          <CategoryProgress name="義式咖啡" value={75} color="bg-primary" />
          <CategoryProgress name="茶飲系列" value={45} color="bg-blue-500" />
          <CategoryProgress name="精緻甜點" value={25} color="bg-amber-500" />
        </div>
      </div>
    </div>
  </div>
);

const Reports = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 font-bold text-slate-400">銷售報表功能開發中...</div>;
const KitchenSettings = () => <div className="p-8 bg-white rounded-3xl border border-slate-100 font-bold text-slate-400">廚房設定功能開發中...</div>;

// --- Main Layout ---

export default function Admin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('管理員');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role, name').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) {
              setRole(data.role);
              setUserName(data.name || '管理員');
            }
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const menuItems = [
    { 
      path: '/admin', 
      icon: <LayoutDashboard className="w-5 h-5" />, 
      label: '總覽',
      roles: ['super_admin', 'partner', 'store_manager'] 
    },
    { 
      path: '/admin/tenants', 
      icon: <Building2 className="w-5 h-5" />, 
      label: '合作夥伴',
      roles: ['super_admin'] 
    },
    { 
      path: '/admin/stores', 
      icon: <Store className="w-5 h-5" />, 
      label: '門市管理',
      roles: ['partner', 'store_manager'] 
    },
    { 
      path: '/admin/categories', 
      icon: <Tag className="w-5 h-5" />, 
      label: '分類管理',
      roles: ['partner'] 
    },
    { 
      path: '/admin/products', 
      icon: <Coffee className="w-5 h-5" />, 
      label: '商品管理',
      roles: ['partner'] 
    },
    { 
      path: '/admin/modifiers', 
      icon: <Settings2 className="w-5 h-5" />, 
      label: '自定義選項',
      roles: ['partner'] 
    },
    { 
      path: '/admin/employees', 
      icon: <Users2 className="w-5 h-5" />, 
      label: '人員管理',
      roles: ['store_manager', 'partner'] 
    },
    { 
      path: '/admin/kitchen', 
      icon: <ChefHat className="w-5 h-5" />, 
      label: '廚房設定',
      roles: ['store_manager'] 
    },
    { 
      path: '/admin/reports', 
      icon: <BarChart3 className="w-5 h-5" />, 
      label: '銷售報表',
      roles: ['partner', 'store_manager'] 
    },
    { 
      path: '/admin/settings', 
      icon: <SettingsIcon className="w-5 h-5" />, 
      label: '系統設定',
      roles: ['super_admin', 'partner', 'store_manager'] 
    },
  ];

  const filteredMenu = menuItems.filter(item => !role || item.roles.includes(role));

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 shadow-sm z-50 hidden md:flex">
        <div className="p-8">
          <Logo showText className="w-10 h-10" />
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
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
            onClick={handleLogout}
            className="w-full p-4 flex items-center gap-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>登出系統</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-8 md:p-12">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black text-slate-900 mb-2">
              {menuItems.find(i => i.path === location.pathname)?.label || '管理系統'}
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              {role === 'super_admin' ? '超級管理員模式' : role === 'partner' ? '品牌總部模式' : '門市店長模式'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-slate-900">{userName}</p>
              <p className="text-xs text-slate-400 capitalize">{role?.replace('_', ' ')}</p>
            </div>
            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm">
              <Users className="text-primary w-6 h-6" />
            </div>
          </div>
        </header>

        <Routes>
          <Route index element={<Overview />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="stores" element={<Stores />} />
          <Route path="categories" element={<Categories />} />
          <Route path="modifiers" element={<Modifiers />} />
          <Route path="employees" element={<Employees />} />
          <Route path="products" element={<Products />} />
          <Route path="kitchen" element={<KitchenSettings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}