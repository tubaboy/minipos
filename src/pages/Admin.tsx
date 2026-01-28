import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Coffee, 
  BarChart3, 
  LogOut,
  ChevronRight,
  Users2,
  Building2,
  Settings as SettingsIcon,
  ChefHat,
  Store,
  Tag,
  Settings2,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Employees from './admin/employees/Employees';
import Products from './admin/Products';
import Tenants from './admin/tenants/Tenants';
import Stores from './admin/stores/Stores';
import Categories from './admin/categories/Categories';
import Modifiers from './admin/modifiers/Modifiers';
import Settings from './admin/Settings';
import Overview from './admin/Overview';
import KitchenSettings from './admin/kitchen/KitchenSettings';
import Reports from './admin/reports/Reports';
import Orders from './admin/orders/Orders';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

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
      path: '/admin/orders', 
      icon: <ClipboardList className="w-5 h-5" />, 
      label: '訂單管理',
      roles: ['store_manager'] 
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
          <Route path="orders" element={<Orders />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}