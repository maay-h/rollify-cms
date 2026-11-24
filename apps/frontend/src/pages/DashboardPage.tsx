import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { 
  UtensilsCrossed, 
  BookOpen, 
  Users, 
  ArrowRight, 
  ShieldCheck, 
  Workflow, 
  Clock,
  Sparkles,
  ShoppingCart,
  ListOrdered,
  ChefHat,
  Receipt,
  PackageSearch,
  CreditCard,
  BarChart3,
  DollarSign,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  activeKitchenTickets: number;
  totalTables: number;
  occupiedTables: number;
  lowStockCount: number;
  totalMenuItems: number;
  orderCounts: {
    created: number;
    toKitchen: number;
    preparing: number;
    ready: number;
    served: number;
    completed: number;
  };
}

export const DashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const { status: socketStatus } = useSocket();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    activeKitchenTickets: 0,
    totalTables: 10,
    occupiedTables: 0,
    lowStockCount: 0,
    totalMenuItems: 114,
    orderCounts: {
      created: 0,
      toKitchen: 0,
      preparing: 0,
      ready: 0,
      served: 0,
      completed: 0,
    },
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [tablesRes, menuRes, kitchenRes, alertsRes, salesRes, ordersRes] = await Promise.all([
          fetch('/api/tables', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/menu/items', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/orders/kitchen/active', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/inventory/alerts', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/billing/day-close/preview', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        let totalTables = 10;
        let occupiedTables = 0;
        let totalMenuItems = 114;
        let activeKitchenTickets = 0;
        let lowStockCount = 0;
        let todaySales = 0;
        const orderCounts = {
          created: 0,
          toKitchen: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0,
        };

        if (tablesRes.ok) {
          const tData = await tablesRes.json();
          if (tData.data) {
            totalTables = tData.data.length;
            occupiedTables = tData.data.filter((t: any) => t.status === 'OCCUPIED').length;
          }
        }

        if (menuRes.ok) {
          const mData = await menuRes.json();
          if (mData.data) totalMenuItems = mData.data.length;
        }

        if (kitchenRes.ok) {
          const kData = await kitchenRes.json();
          if (kData.data) activeKitchenTickets = kData.data.length;
        }

        if (alertsRes.ok) {
          const aData = await alertsRes.json();
          if (aData.data) lowStockCount = aData.data.length;
        }

        if (salesRes.ok) {
          const sData = await salesRes.json();
          if (sData.data) todaySales = Number(sData.data.totalSettledSales || 0);
        }

        if (ordersRes.ok) {
          const oData = await ordersRes.json();
          if (Array.isArray(oData.data)) {
            for (const o of oData.data) {
              if (o.status === 'CREATED') orderCounts.created++;
              else if (o.status === 'SENT_TO_KITCHEN') orderCounts.toKitchen++;
              else if (o.status === 'PREPARING') orderCounts.preparing++;
              else if (o.status === 'READY') orderCounts.ready++;
              else if (o.status === 'SERVED') orderCounts.served++;
              else if (o.status === 'COMPLETED') orderCounts.completed++;
            }
          }
        }

        setStats({
          todaySales,
          activeKitchenTickets,
          totalTables,
          occupiedTables,
          lowStockCount,
          totalMenuItems,
          orderCounts,
        });
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStatus();
    }
  }, [token]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cafe-espresso via-cafe-roast to-cafe-mocha p-6 sm:p-8 text-white shadow-xl shadow-stone-900/10 border border-stone-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-xs text-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-cafe-accent" />
              <span>Rollify Cafe • Flagship Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, {user?.fullName || user?.username || 'Cafe Team'}!
            </h1>
            <p className="text-sm text-amber-100/80 max-w-xl">
              Fast order taking, live kitchen display, automated recipe inventory tracking, and daily cash reconciliation.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              className="bg-cafe-accent hover:bg-orange-600 text-white font-bold border-none shadow-md shadow-orange-950/20"
              onClick={() => navigate('/pos')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Take New Order
            </Button>
            {user?.role === 'WAITER' ? (
              <>
                <Button
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => navigate('/orders')}
                >
                  Live Orders
                </Button>
                <Button
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => navigate('/tables')}
                >
                  Table Floor Plan
                </Button>
              </>
            ) : (
              <>
                {['ADMIN', 'KITCHEN'].includes(user?.role || '') && (
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => navigate('/kitchen')}
                  >
                    Kitchen Display (KDS)
                  </Button>
                )}
                {['ADMIN', 'CASHIER'].includes(user?.role || '') && (
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => navigate('/billing')}
                  >
                    Billing & Cashier
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Decorative corner accent */}
        <div className="absolute right-0 -bottom-10 opacity-20 pointer-events-none">
          <UtensilsCrossed className="w-64 h-64 text-rollify-gold" />
        </div>
      </div>

      {/* Live Business Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's Sales */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Today's Net Sales
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900 font-mono">
              ₹{stats.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Settled via Cash, UPI & Card
          </p>
        </Card>

        {/* Metric 2: Active Kitchen Tickets */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Active Kitchen Orders
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{stats.activeKitchenTickets} Tickets</span>
            {stats.activeKitchenTickets > 0 && (
              <Badge variant="preparing" size="sm" dot>Cooking</Badge>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Live orders on KDS screen
          </p>
        </Card>

        {/* Metric 3: Dining Floor Plan */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Dining Floor Occupancy
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {stats.occupiedTables} / {stats.totalTables}
            </span>
            <span className="text-xs text-stone-500 font-semibold">Tables Occupied</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Indoor, Patio, Balcony & Counter
          </p>
        </Card>

        {/* Metric 4: Total Orders & AOV */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Total Orders & AOV
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {stats.orderCounts.completed + stats.orderCounts.created + stats.orderCounts.toKitchen + stats.orderCounts.preparing + stats.orderCounts.ready + stats.orderCounts.served} Orders
            </span>
            <Badge variant="paid" size="sm" dot>Live</Badge>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            AOV: ₹{stats.todaySales > 0 ? (stats.todaySales / Math.max(1, stats.orderCounts.completed || 1)).toFixed(0) : '0'} avg per order
          </p>
        </Card>
      </div>

      {/* Order Workflow & Active Session Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Lifecycle Pipeline Card */}
        <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-2.5">
                <Workflow className="w-5 h-5 text-rollify-red" />
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Live Order Pipeline
                  </h2>
                  <p className="text-xs text-stone-400">Real-time ticket flow across active stations</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/orders')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="text-stone-700 hover:text-rollify-red hover:border-rollify-red/50 shadow-xs"
              >
                View Live Orders
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              <div className="p-3 bg-blue-50 border border-blue-200/60 rounded-2xl">
                <Badge variant="created" size="sm" className="mb-2">
                  {stats.orderCounts.created} Active
                </Badge>
                <h3 className="text-xs font-bold text-blue-900">New Order</h3>
                <p className="text-[10px] text-blue-600 mt-1">Waiter / QR Placed</p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-2xl">
                <Badge variant="kitchen" size="sm" className="mb-2">
                  {stats.orderCounts.toKitchen} Queued
                </Badge>
                <h3 className="text-xs font-bold text-amber-900">In Kitchen</h3>
                <p className="text-[10px] text-amber-600 mt-1">Sent to KDS Screen</p>
              </div>

              <div className="p-3 bg-orange-50 border border-orange-200/60 rounded-2xl">
                <Badge variant="preparing" size="sm" className="mb-2">
                  {stats.orderCounts.preparing} Cooking
                </Badge>
                <h3 className="text-xs font-bold text-orange-900">Preparing</h3>
                <p className="text-[10px] text-orange-600 mt-1">Chef Cooking Food</p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-2xl">
                <Badge variant="ready" size="sm" className="mb-2">
                  {stats.orderCounts.ready} Ready
                </Badge>
                <h3 className="text-xs font-bold text-emerald-900">Pickup Ready</h3>
                <p className="text-[10px] text-emerald-600 mt-1">KDS Bell Chime</p>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200/60 rounded-2xl">
                <Badge variant="served" size="sm" className="mb-2">
                  {stats.orderCounts.served} Dining
                </Badge>
                <h3 className="text-xs font-bold text-teal-900">Served</h3>
                <p className="text-[10px] text-teal-600 mt-1">At Table / Takeaway</p>
              </div>

              <div className="p-3 bg-green-50 border border-green-200/60 rounded-2xl">
                <Badge variant="paid" size="sm" className="mb-2">
                  {stats.orderCounts.completed} Settled
                </Badge>
                <h3 className="text-xs font-bold text-green-900">Paid</h3>
                <p className="text-[10px] text-green-600 mt-1">Cash, UPI or Card</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Current Active Session & Role Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100 mb-4">
            <Users className="w-5 h-5 text-rollify-gold" />
            <h2 className="text-base font-bold text-stone-900">Terminal User</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Staff Member</p>
              <p className="text-base font-bold text-stone-900">{user?.fullName}</p>
              <p className="text-xs text-stone-500 font-mono">@{user?.username} ({user?.email})</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Access Role</p>
              <Badge variant="default" size="md">
                {user?.role}
              </Badge>
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-2">
              <p className="text-xs font-semibold text-stone-700">Role Capabilities:</p>
              <ul className="text-xs text-stone-600 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Table occupancy & floor plan
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Menu catalog & price lookups
                </li>
                {['ADMIN', 'CASHIER'].includes(user?.role || '') && (
                  <li className="flex items-center gap-2 text-emerald-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Billing & split payment checkout
                  </li>
                )}
                {user?.role === 'ADMIN' && (
                  <li className="flex items-center gap-2 text-purple-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Menu catalog, table floor plan, staff & reports
                  </li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Launchpad to Cafe Modules */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">Cafe Operations Launchpad</h2>
          <span className="text-xs font-semibold text-stone-500">
            Store Open • All Stations Ready
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              to: '/pos',
              title: 'Order Entry (POS)',
              desc: 'Digital menu, categories & order cart',
              icon: <ShoppingCart className="w-4 h-4" />,
              color: 'bg-rollify-red-50 text-rollify-red group-hover:scale-110',
              borderColor: 'hover:border-rollify-red/50',
              roles: ['ADMIN', 'CASHIER', 'WAITER'],
            },
            {
              to: '/kitchen',
              title: 'Kitchen Display (KDS)',
              desc: 'Live tickets, timers & audio chime',
              icon: <ChefHat className="w-4 h-4" />,
              color: 'bg-amber-50 text-amber-700 group-hover:scale-110',
              borderColor: 'hover:border-amber-300',
              roles: ['ADMIN', 'KITCHEN'],
            },
            {
              to: '/billing',
              title: 'Cashier Dashboard',
              desc: '5% GST, Split Pay, Invoices & Receipts',
              icon: <Receipt className="w-4 h-4" />,
              color: 'bg-emerald-50 text-emerald-700 group-hover:scale-110',
              borderColor: 'hover:border-emerald-300',
              roles: ['ADMIN', 'CASHIER'],
            },
            {
              to: '/orders',
              title: 'Order Management',
              desc: 'Track live orders & table status',
              icon: <ListOrdered className="w-4 h-4" />,
              color: 'bg-blue-50 text-blue-700 group-hover:scale-110',
              borderColor: 'hover:border-blue-300',
              roles: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'],
            },
            {
              to: '/tables',
              title: 'Table Management',
              desc: '10 tables across dining floor zones',
              icon: <UtensilsCrossed className="w-4 h-4" />,
              color: 'bg-stone-100 text-stone-700 group-hover:scale-110',
              borderColor: 'hover:border-stone-400',
              roles: ['ADMIN', 'CASHIER', 'WAITER'],
            },
            {
              to: '/menu',
              title: 'Menu Management',
              desc: 'Dishes, categories, prices & availability',
              icon: <BookOpen className="w-4 h-4" />,
              color: 'bg-purple-50 text-purple-700 group-hover:scale-110',
              borderColor: 'hover:border-purple-300',
              roles: ['ADMIN'],
            },
            {
              to: '/users',
              title: 'Staff Management',
              desc: 'Admin, Cashier, Waiter, Kitchen Staff',
              icon: <Users className="w-4 h-4" />,
              color: 'bg-indigo-50 text-indigo-700 group-hover:scale-110',
              borderColor: 'hover:border-indigo-300',
              roles: ['ADMIN'],
            },
            {
              to: '/analytics',
              title: 'Revenue & Reports',
              desc: 'P&L statements, Excel CSV & PDF print',
              icon: <BarChart3 className="w-4 h-4" />,
              color: 'bg-teal-50 text-teal-700 group-hover:scale-110',
              borderColor: 'hover:border-teal-300',
              roles: ['ADMIN'],
            },
          ]
            .filter((item) => item.roles.includes(user?.role || ''))
            .map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`p-4 bg-white rounded-2xl border border-stone-200/80 ${item.borderColor} hover:shadow-sm text-left transition-all group`}
              >
                <div
                  className={`w-8 h-8 rounded-xl ${item.color} flex items-center justify-center mb-2.5 transition-transform`}
                >
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-stone-900">{item.title}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{item.desc}</p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
