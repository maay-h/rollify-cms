import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge, BadgeVariant } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { 
  Plus, 
  Send, 
  ChefHat, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  History, 
  UtensilsCrossed, 
  Layers, 
  AlertTriangle 
} from 'lucide-react';
import { clsx } from 'clsx';
import { DEMO_INITIAL_ORDERS } from '../mock/demoStore.js';

interface OrderItem {
  id: string;
  order_id: string;
  item_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes?: string;
  item_status: string;
  is_veg: boolean;
}

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  table_id?: string;
  table_number?: string;
  table_section?: string;
  customer_name?: string;
  status: 'CREATED' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  notes?: string;
  waiter_name?: string;
  created_at: string;
  items?: OrderItem[];
}

interface TimelineEntry {
  id: string;
  action: string;
  from_status?: string;
  to_status: string;
  notes?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  created_at: string;
}

export const OrdersListPage: React.FC = () => {
  const { token, user, hasRole } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<string>('ACTIVE');

  // Timeline Modal
  const [timelineOrder, setTimelineOrder] = useState<Order | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Cancellation Dialog
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setOrders(json.data);
      } else {
        setOrders(DEMO_INITIAL_ORDERS as any);
      }
    } catch (err) {
      setOrders(DEMO_INITIAL_ORDERS as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  // Real-Time Socket.io Listeners for Instant Synchronization!
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder: any) => {
      toast.info('New Order Received', `${newOrder.orderNumber} placed for ${newOrder.tableNumber || newOrder.orderType}`);
      fetchOrders();
    };

    const handleStatusUpdate = (payload: any) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status } : o))
      );
    };

    const handleReadyAlert = (payload: any) => {
      toast.success('ORDER READY FOR PICKUP!', `${payload.orderNumber} is hot and ready`);
      fetchOrders();
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:status_updated', handleStatusUpdate);
    socket.on('order:ready_alert', handleReadyAlert);
    socket.on('order:items_added', fetchOrders);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:status_updated', handleStatusUpdate);
      socket.off('order:ready_alert', handleReadyAlert);
      socket.off('order:items_added', fetchOrders);
    };
  }, [socket]);

  // Action: Send to Kitchen
  const sendToKitchen = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/send-to-kitchen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Sent to Kitchen', 'Ticket dispatched to KDS display');
        fetchOrders();
      } else {
        toast.error('Action Failed', json.error);
      }
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  // Action: Update Lifecycle Status
  const updateStatus = async (orderId: string, status: Order['status'], notes?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, notes }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Order moved to ${status}`);
        fetchOrders();
      } else {
        toast.error('Status Update Failed', json.error);
      }
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  // Action: Confirm Cancellation
  const executeCancellation = async () => {
    if (!cancelOrder) return;
    setIsCancelling(true);
    try {
      await updateStatus(cancelOrder.id, 'CANCELLED', cancelReason || 'Cancelled by staff');
      setCancelOrder(null);
      setCancelReason('');
    } finally {
      setIsCancelling(false);
    }
  };

  // Inspect Timeline
  const viewTimeline = async (order: Order) => {
    setTimelineOrder(order);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data && json.data.timeline) {
        setTimelineEntries(json.data.timeline);
      }
    } catch (e) {
      toast.error('Failed to load audit history');
    } finally {
      setTimelineLoading(false);
    }
  };

  // Filter Orders
  const filteredOrders = orders.filter((o) => {
    if (filterTab === 'ACTIVE') {
      return !['COMPLETED', 'CANCELLED'].includes(o.status);
    }
    if (filterTab === 'KITCHEN') {
      return ['SENT_TO_KITCHEN', 'PREPARING'].includes(o.status);
    }
    if (filterTab === 'READY') {
      return o.status === 'READY';
    }
    if (filterTab === 'SERVED') {
      return o.status === 'SERVED';
    }
    if (filterTab === 'COMPLETED') {
      return o.status === 'COMPLETED';
    }
    return true;
  });

  const statusBadgeVariants: Record<Order['status'], BadgeVariant> = {
    CREATED: 'created',
    SENT_TO_KITCHEN: 'kitchen',
    PREPARING: 'preparing',
    READY: 'ready',
    SERVED: 'served',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };

  if (loading) {
    return <LoadingSpinner text="Connecting to Real-Time Order Stream..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Live Order Management
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Real-time synchronized order stream across Waiter, Kitchen, and Cashier terminals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/pos')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Fast Order
          </Button>
          <Button
            variant="charcoal"
            size="sm"
            onClick={() => navigate('/kitchen')}
            leftIcon={<ChefHat className="w-4 h-4 text-rollify-gold" />}
          >
            Kitchen Display (KDS)
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-stone-200 pb-3">
        {[
          { id: 'ACTIVE', label: 'All Active Orders' },
          { id: 'KITCHEN', label: 'In Kitchen' },
          { id: 'READY', label: 'Ready to Serve' },
          { id: 'SERVED', label: 'Served / Unpaid' },
          { id: 'COMPLETED', label: 'Paid & Completed' },
          { id: 'ALL', label: 'All History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold transition',
              filterTab === tab.id
                ? 'bg-rollify-red text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          title="No Orders Found in This Queue"
          description="There are currently no tickets matching this status filter. You can take a new order anytime."
          actionLabel="Create Walk-In Order"
          onAction={() => navigate('/pos')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="p-5 flex flex-col justify-between">
              <div>
                {/* Header: Table / Order Number / Status */}
                <div className="flex items-start justify-between pb-3 border-b border-stone-100">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-400">
                      {order.order_number}
                    </span>
                    <h3 className="text-base font-black text-stone-900 mt-0.5">
                      {order.table_number ? `Table ${order.table_number}` : order.order_type}
                    </h3>
                    {order.customer_name && (
                      <p className="text-[11px] text-stone-500">Guest: {order.customer_name}</p>
                    )}
                  </div>

                  <Badge variant={statusBadgeVariants[order.status]} size="sm" dot>
                    {order.status}
                  </Badge>
                </div>

                {/* Items List */}
                <div className="py-3 space-y-1.5 text-xs">
                  {order.items?.map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-900 font-mono w-4">
                          {it.quantity}x
                        </span>
                        <span className="text-stone-700 font-medium">
                          {it.item_name}
                        </span>
                        {it.variant_name && it.variant_name !== 'Single' && (
                          <span className="text-[10px] bg-stone-100 px-1 py-0.2 rounded font-bold text-stone-500">
                            {it.variant_name}
                          </span>
                        )}
                      </div>
                      <span className="text-stone-500 font-mono">₹{it.subtotal}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl mt-2 border border-amber-200/60">
                      <strong>Notes:</strong> {order.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer: Totals and Lifecycle Action Buttons */}
              <div className="pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-stone-500">Total (incl. 5% GST)</span>
                  <span className="text-base font-black font-mono text-stone-900">
                    ₹{order.total_amount}
                  </span>
                </div>

                {/* Quick Workflow Transitions */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {order.status === 'CREATED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => sendToKitchen(order.id)}
                        className="col-span-2 text-xs"
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Send to Kitchen (KOT)
                      </Button>
                    )}

                    {order.status === 'SENT_TO_KITCHEN' && (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                        className="col-span-2 text-xs"
                        leftIcon={<ChefHat className="w-3.5 h-3.5" />}
                      >
                        Start Preparing
                      </Button>
                    )}

                    {order.status === 'PREPARING' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => updateStatus(order.id, 'READY')}
                        className="col-span-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Mark Order Ready
                      </Button>
                    )}

                    {order.status === 'READY' && (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => updateStatus(order.id, 'SERVED')}
                        className="col-span-2 text-xs"
                        leftIcon={<UtensilsCrossed className="w-3.5 h-3.5" />}
                      >
                        Mark Served to Table
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => viewTimeline(order)}
                      className="text-[11px] text-stone-500 hover:text-stone-900 font-semibold flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5 text-stone-400" />
                      View Timeline
                    </button>

                    {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                      <button
                        onClick={() => setCancelOrder(order)}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Audit Timeline Modal */}
      <Modal
        isOpen={Boolean(timelineOrder)}
        onClose={() => setTimelineOrder(null)}
        title={
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-rollify-red" />
            <span>Order History: {timelineOrder?.order_number}</span>
          </div>
        }
        maxWidth="md"
      >
        {timelineLoading ? (
          <LoadingSpinner text="Retrieving immutable audit timeline..." />
        ) : (
          <div className="space-y-3 py-2">
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {timelineEntries.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-rollify-red border-2 border-white ring-2 ring-rollify-red/20" />
                  <div className="text-xs">
                    <span className="font-bold text-stone-900">{entry.action}</span>
                    <span className="text-[10px] text-stone-400 font-mono ml-2">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.notes && <p className="text-xs text-stone-600 mt-0.5">{entry.notes}</p>}
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    By: {entry.performed_by_name || 'System'} ({entry.performed_by_role || 'STAFF'})
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="charcoal" size="sm" onClick={() => setTimelineOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Dialog for Order Cancellation */}
      <ConfirmationDialog
        isOpen={Boolean(cancelOrder)}
        onClose={() => setCancelOrder(null)}
        onConfirm={executeCancellation}
        title={`Cancel Order ${cancelOrder?.order_number}?`}
        message={
          <div className="space-y-3 text-left">
            <p className="text-xs text-stone-600">
              Cancelling this order will release table <strong>{cancelOrder?.table_number || 'Takeaway'}</strong>, notify the kitchen display, and record a cancellation entry in the audit ledger.
            </p>
            <input
              type="text"
              placeholder="Reason for cancellation (required)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        }
        confirmText="Confirm Cancellation"
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
};
