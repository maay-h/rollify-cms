import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Flame, 
  Bell, 
  Layers, 
  Sparkles,
  AlertTriangle,
  XCircle,
  Play,
  Check,
  UtensilsCrossed,
  Package
} from 'lucide-react';
import { clsx } from 'clsx';

interface KDSTicketItem {
  id: string;
  item_name: string;
  variant_name?: string;
  quantity: number;
  notes?: string;
  item_status: string;
  is_veg: boolean;
  prep_time_minutes: number;
}

interface KDSTicket {
  id: string;
  order_number: string;
  order_type: string;
  table_id?: string;
  table_number?: string;
  table_section?: string;
  customer_name?: string;
  status: 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY';
  order_notes?: string;
  created_at: string;
  elapsed_minutes: number;
  items: KDSTicketItem[];
}

// Chime generator using Web Audio API for kitchen notification bell
function playKitchenChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6); // Pitch drop

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Audio context may require user gesture on first load
  }
}

export const KitchenDisplayPage: React.FC = () => {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');

  // Reject Order Modal
  const [rejectTicket, setRejectTicket] = useState<KDSTicket | null>(null);
  const [rejectReason, setRejectReason] = useState('Out of raw ingredients');
  const [customRejectNote, setCustomRejectNote] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/orders/kitchen/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTickets(json.data);
      }
    } catch (e) {
      toast.error('Failed to load active kitchen tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // Refresh tickets every 5s to ensure instant updates from customer QR orders
    const interval = setInterval(fetchTickets, 5000);

    const handleStorageOrCustomEvent = () => {
      fetchTickets();
      if (soundEnabled) {
        playKitchenChime();
      }
    };

    window.addEventListener('storage', handleStorageOrCustomEvent);
    window.addEventListener('rollify:new_order', handleStorageOrCustomEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageOrCustomEvent);
      window.removeEventListener('rollify:new_order', handleStorageOrCustomEvent);
    };
  }, [token, soundEnabled]);

  // Real-Time Socket Listeners for KDS
  useEffect(() => {
    if (!socket) return;

    const handleKitchenTicket = (ticket: any) => {
      if (soundEnabled) {
        playKitchenChime();
      }
      toast.info('NEW KITCHEN ORDER!', `Table ${ticket.tableNumber || ticket.orderType} • ${ticket.orderNumber}`);
      fetchTickets();
    };

    const handleItemsAdded = (payload: any) => {
      if (soundEnabled) {
        playKitchenChime();
      }
      toast.warning('EXTRA ITEMS ADDED!', `Order ${payload.orderNumber} added more dishes`);
      fetchTickets();
    };

    const handleStatusUpdated = () => {
      fetchTickets();
    };

    socket.on('order:kitchen_ticket', handleKitchenTicket);
    socket.on('order:items_added', handleItemsAdded);
    socket.on('order:status_updated', handleStatusUpdated);

    return () => {
      socket.off('order:kitchen_ticket', handleKitchenTicket);
      socket.off('order:items_added', handleItemsAdded);
      socket.off('order:status_updated', handleStatusUpdated);
    };
  }, [socket, soundEnabled]);

  const updateTicketStatus = async (orderId: string, status: 'PREPARING' | 'READY' | 'SERVED') => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        if (status === 'READY') {
          toast.success('Order Marked Ready!', 'Server notified for table pickup');
        } else if (status === 'PREPARING') {
          toast.info('Started Cooking', 'Ticket moved to Preparing');
        } else {
          toast.success('Order Completed', 'Dispatched from kitchen');
        }
        fetchTickets();
      } else {
        toast.error('Update Failed', json.error);
      }
    } catch (e: any) {
      toast.error('Network Error', e.message);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTicket) return;
    setIsSubmittingReject(true);
    try {
      const reasonText = customRejectNote ? `${rejectReason}: ${customRejectNote}` : rejectReason;
      const res = await fetch(`/api/orders/${rejectTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'CANCELLED', reason: reasonText }),
      });
      const json = await res.json();
      if (json.success) {
        toast.warning('Order Rejected', `Order ${rejectTicket.order_number} was cancelled`);
        setRejectTicket(null);
        setCustomRejectNote('');
        fetchTickets();
      } else {
        toast.error('Rejection Failed', json.error);
      }
    } catch (err: any) {
      toast.error('Network Error', err.message);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === 'NEW') return t.status === 'SENT_TO_KITCHEN';
    if (activeFilter === 'PREPARING') return t.status === 'PREPARING';
    if (activeFilter === 'READY') return t.status === 'READY';
    return true;
  });

  const newCount = tickets.filter((t) => t.status === 'SENT_TO_KITCHEN').length;
  const preparingCount = tickets.filter((t) => t.status === 'PREPARING').length;
  const readyCount = tickets.filter((t) => t.status === 'READY').length;

  if (loading) {
    return <LoadingSpinner text="Booting Kitchen Display System (KDS)..." />;
  }

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto pb-12">
      {/* KDS Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#2D1810] text-white p-5 rounded-3xl shadow-xl border border-stone-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#EA580C] flex items-center justify-center text-white shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE KDS STREAM
              </span>
            </h1>
            <p className="text-xs text-stone-300">
              Active tickets: {tickets.length} • Real-time kitchen order bell enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer',
              soundEnabled
                ? 'bg-stone-800/80 text-emerald-400 border border-emerald-500/30'
                : 'bg-stone-800/80 text-stone-400 border border-stone-700'
            )}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Bell On' : 'Muted'}
          </button>

          {/* Filter Tabs */}
          <div className="flex p-1 bg-stone-900/80 border border-stone-800 rounded-2xl">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer',
                activeFilter === 'ALL' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
              )}
            >
              All ({tickets.length})
            </button>
            <button
              onClick={() => setActiveFilter('NEW')}
              className={clsx(
                'px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1',
                activeFilter === 'NEW' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
              )}
            >
              New ({newCount})
            </button>
            <button
              onClick={() => setActiveFilter('PREPARING')}
              className={clsx(
                'px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1',
                activeFilter === 'PREPARING' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
              )}
            >
              Cooking ({preparingCount})
            </button>
            <button
              onClick={() => setActiveFilter('READY')}
              className={clsx(
                'px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1',
                activeFilter === 'READY' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
              )}
            >
              Ready ({readyCount})
            </button>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-400 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-[#2D1810] mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-stone-800">Kitchen Display is Clear</h3>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
            All customer food and beverage tickets have been prepared and served. New orders placed from the POS will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTickets.map((ticket) => {
            const isDelayed = ticket.elapsed_minutes >= 15 && ticket.status !== 'READY';
            const isPreparing = ticket.status === 'PREPARING';
            const isReady = ticket.status === 'READY';

            return (
              <div
                key={ticket.id}
                className={clsx(
                  'rounded-3xl border bg-white flex flex-col justify-between overflow-hidden shadow-xs transition duration-200',
                  isDelayed
                    ? 'border-red-400 ring-2 ring-red-400/20'
                    : isReady
                    ? 'border-emerald-300'
                    : isPreparing
                    ? 'border-amber-300'
                    : 'border-stone-200'
                )}
              >
                {/* Ticket Top Header */}
                <div
                  className={clsx(
                    'p-4 border-b flex items-start justify-between text-white',
                    isDelayed
                      ? 'bg-red-700'
                      : isReady
                      ? 'bg-emerald-700'
                      : isPreparing
                      ? 'bg-[#2D1810]'
                      : 'bg-stone-800'
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black font-mono tracking-tight">
                        {ticket.order_number}
                      </span>
                      {ticket.order_type === 'DINE_IN' ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20">
                          Table {ticket.table_number || 'T-01'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20">
                          {ticket.order_type}
                        </span>
                      )}
                    </div>
                    {ticket.customer_name && (
                      <p className="text-[11px] text-white/80 font-medium mt-0.5">
                        Customer: {ticket.customer_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end">
                    <span
                      className={clsx(
                        'text-xs font-mono font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg',
                        isDelayed ? 'bg-white text-red-700 animate-pulse font-black' : 'bg-white/15'
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {ticket.elapsed_minutes}m ago
                    </span>
                    {isDelayed && (
                      <span className="text-[9px] font-extrabold uppercase text-white mt-1 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3 text-amber-300" />
                        Delayed
                      </span>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 flex-1 space-y-2.5 divide-y divide-stone-100">
                  {ticket.items.map((item) => (
                    <div key={item.id} className="pt-2 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-md bg-[#2D1810] text-white text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {item.quantity}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-stone-900 leading-tight block">
                              {item.item_name}
                            </span>
                            {item.variant_name && item.variant_name !== 'Single' && (
                              <span className="text-[10px] font-semibold text-[#EA580C]">
                                Size: {item.variant_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] text-stone-400 font-mono shrink-0">
                          {item.prep_time_minutes}m
                        </span>
                      </div>

                      {/* Special Instructions Chip */}
                      {item.notes && (
                        <div className="mt-1 pl-7">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF7ED] text-[#EA580C] text-[10px] font-bold border border-[#FED7AA]">
                            ⚡ {item.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* General Ticket Note */}
                  {ticket.order_notes && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-stone-500 uppercase">Special Note:</p>
                      <p className="text-xs font-semibold text-stone-800 italic bg-[#FAF7F2] p-2 rounded-xl mt-0.5">
                        "{ticket.order_notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Action Controls */}
                <div className="p-3 bg-[#FAF7F2] border-t border-stone-100 flex items-center gap-2">
                  {ticket.status === 'SENT_TO_KITCHEN' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 bg-[#2D1810] hover:bg-[#1A0E09] text-white font-bold text-xs py-2 flex items-center justify-center gap-1.5 rounded-xl"
                        onClick={() => updateTicketStatus(ticket.id, 'PREPARING')}
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-[#EA580C]" />
                        Start Cooking
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs py-2 px-2.5 rounded-xl"
                        onClick={() => setRejectTicket(ticket)}
                        title="Reject Order"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}

                  {ticket.status === 'PREPARING' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 flex items-center justify-center gap-1.5 rounded-xl"
                        onClick={() => updateTicketStatus(ticket.id, 'READY')}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        Mark as Ready
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs py-2 px-2.5 rounded-xl"
                        onClick={() => setRejectTicket(ticket)}
                        title="Reject / Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}

                  {ticket.status === 'READY' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 flex items-center justify-center gap-1.5 rounded-xl"
                      onClick={() => updateTicketStatus(ticket.id, 'SERVED')}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Hand Over / Picked Up
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectTicket && (
        <Modal
          isOpen={true}
          onClose={() => setRejectTicket(null)}
          title={`Reject Kitchen Ticket - ${rejectTicket.order_number}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Please specify a reason for rejecting this order. The waiter and cashier will be alerted and the table will be freed:
            </p>

            <div className="space-y-2">
              {[
                'Out of raw ingredients / stock',
                'Kitchen at peak capacity (high delay)',
                'Equipment / stove breakdown',
                'Customer requested cancellation',
                'Incorrect table or order entry',
              ].map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 p-2 rounded-xl border border-stone-200 hover:bg-[#FAF7F2] cursor-pointer text-xs font-semibold"
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    value={r}
                    checked={rejectReason === r}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="accent-[#2D1810]"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                Additional Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Specific details..."
                value={customRejectNote}
                onChange={(e) => setCustomRejectNote(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2D1810]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectTicket(null)}
              >
                Keep Order
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubmittingReject}
                onClick={handleConfirmReject}
              >
                {isSubmittingReject ? 'Rejecting...' : 'Confirm Reject & Cancel'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
