import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ShoppingBag,
  Calendar,
  MoreVertical,
  Eye,
  Printer,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  modifiers?: any[];
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'completed' | 'closed';
  type: 'dine_in' | 'take_out';
  table_number?: string;
  total_amount: number;
  service_charge: number;
  created_at: string;
  items?: OrderItem[];
}

export default function Orders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    // Close menu when clicking outside
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id, tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.store_id) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('store_id', profile.store_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('無法載入訂單列表');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      toast.success('訂單狀態已更新');
    } catch (error) {
      toast.error('更新失敗');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const getStatusStyle = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'processing': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'closed': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '待確認';
      case 'processing': return '製作中';
      case 'completed': return '已出餐';
      case 'closed': return '已結單';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">訂單管理</h2>
            <p className="text-slate-400 font-medium">查看並處理所有門市訂單</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜尋單號..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer"
            >
              <option value="all">所有狀態</option>
              <option value="pending">待確認</option>
              <option value="processing">製作中</option>
              <option value="completed">已出餐</option>
              <option value="closed">已結單</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table/List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold">載入訂單中...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">訂單資訊</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">類型</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">金額</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">狀態</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">時間</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">#{order.order_number}</p>
                          <p className="text-xs text-slate-400 font-bold">{order.items?.length || 0} 個品項</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                        order.type === 'dine_in' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {order.type === 'dine_in' ? `內用 (${order.table_number})` : '外帶'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900">NT$ {order.total_amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm",
                        getStatusStyle(order.status)
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          order.status === 'pending' ? 'bg-amber-500' :
                          order.status === 'processing' ? 'bg-blue-500' :
                          order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'
                        )} />
                        {getStatusLabel(order.status)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-500 font-medium">
                        <p className="font-bold text-slate-700">{new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] uppercase">{new Date(order.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </td>
                                        <td className="px-8 py-5 text-right">
                                          <div className="flex justify-end gap-2">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowDetailModal(true); }}
                                              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all"
                                            >
                                              <Eye className="w-5 h-5" />
                                            </button>
                                            <div className="relative">
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveMenuId(activeMenuId === order.id ? null : order.id);
                                                }}
                                                className={cn(
                                                  "p-2 rounded-xl transition-all",
                                                  activeMenuId === order.id ? "bg-primary/10 text-primary" : "hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                                                )}
                                              >
                                                <MoreVertical className="w-5 h-5" />
                                              </button>
                                              
                                              {/* Floating Actions Menu */}
                                              {activeMenuId === order.id && (
                                                <div 
                                                  className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200 transform origin-top-right"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                   {order.status === 'pending' && (
                                                     <button 
                                                      onClick={() => { updateOrderStatus(order.id, 'processing'); setActiveMenuId(null); }}
                                                      className="w-full text-left px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                                                     >
                                                       <Clock className="w-4 h-4" /> 開始製作
                                                     </button>
                                                   )}
                                                   {order.status === 'processing' && (
                                                     <button 
                                                      onClick={() => { updateOrderStatus(order.id, 'completed'); setActiveMenuId(null); }}
                                                      className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                                     >
                                                       <CheckCircle2 className="w-4 h-4" /> 標記完成
                                                     </button>
                                                   )}
                                                   <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                                                     <Printer className="w-4 h-4" /> 列印單據
                                                   </button>
                                                   <div className="h-px bg-slate-50 my-1" />
                                                   <button className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                                     <XCircle className="w-4 h-4" /> 取消訂單
                                                   </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <ClipboardList className="w-10 h-10" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">找不到符合的訂單</p>
              <p className="text-slate-400 font-bold">請嘗試調整搜尋條件或篩選器</p>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">訂單詳情 #{selectedOrder.order_number}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                      selectedOrder.type === 'dine_in' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {selectedOrder.type === 'dine_in' ? `桌號: ${selectedOrder.table_number}` : '外帶'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-400 font-bold">
                      {new Date(selectedOrder.created_at).toLocaleString('zh-TW')}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6 scrollbar-thin">
              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">餐點明細</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex gap-4">
                        <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-900 border border-slate-200">
                          {item.quantity}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{item.product_name}</p>
                          {item.notes && <p className="text-xs text-amber-500 font-bold">備註: {item.notes}</p>}
                        </div>
                      </div>
                      <span className="font-black text-slate-900">NT$ {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-900 text-white rounded-[2rem] p-8 space-y-4 shadow-xl">
                <div className="flex justify-between items-center text-slate-400 font-bold text-sm">
                  <span>小計</span>
                  <span>NT$ {(selectedOrder.total_amount - (selectedOrder.service_charge || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 font-bold text-sm">
                  <span>服務費</span>
                  <span>NT$ {(selectedOrder.service_charge || 0).toLocaleString()}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black">總計金額</span>
                  <span className="text-3xl font-black text-primary">NT$ {selectedOrder.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <div className="flex-1 flex gap-2">
                {selectedOrder.status === 'pending' && (
                  <button 
                    onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                  >
                    開始製作
                  </button>
                )}
                {selectedOrder.status === 'processing' && (
                  <button 
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                    className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    標記完成
                  </button>
                )}
                <button className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-black hover:border-slate-300 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Printer className="w-5 h-5" />
                  列印
                </button>
              </div>
              <button className="p-4 bg-red-100 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                <Trash2 className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
