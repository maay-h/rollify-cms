import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
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
  Sparkles 
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

// Chime generator using Web Audio API for kitchen notification bells
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
    // Audio context may require initial user click in some browsers
  }
}

export const KitchenDisplayPage: React.FC = () => {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'COOKING' | 'READY'>('ALL');

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
    // Refresh tickets every 30s to update elapsed minutes
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [token]);

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

  const updateTicketStatus = async (orderId: string, status: 'PREPARING' | 'READY') => {
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
          toast.success('Order Marked Ready!', 'Waiter notified for pickup');
        } else {
          toast.info('Started Cooking', 'Ticket moved to Preparing');
        }
        fetchTickets();
      } else {
        toast.error('Update Failed', json.error);
      }
    } catch (e: any) {
      toast.error('Network Error', e.message);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === 'COOKING') return t.status === 'PREPARING';
    if (activeFilter === 'READY') return t.status === 'READY';
    return true;
  });

  if (loading) {
    return <LoadingSpinner text="Booting Kitchen Display System (KDS)..." />;
  }

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto pb-12">
      {/* KDS Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 text-white p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rollify-red flex items-center justify-center text-white">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                LIVE STREAM
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              Active tickets: {tickets.length} • Real-time audible order bell enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5',
              soundEnabled
                ? 'bg-stone-800 text-emerald-400 border border-emerald-500/30'
                : 'bg-stone-800 text-stone-400 border border-stone-700'
            )}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Bell On' : 'Muted'}
          </button>

          {/* Filter Pills */}
          <div className="flex p-1 bg-stone-800 rounded-2xl">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={clsx(
                'px-3 py-1 text-xs font-bold rounded-xl transition',
                activeFilter === 'ALL' ? 'bg-rollify-red text-white' : 'text-stone-400'
              )}
            >
              All ({tickets.length})
            </button>
            <button
              onClick={() => setActiveFilter('COOKING')}
              className={clsx(
                'px-3 py-1 text-xs font-bold rounded-xl transition',
                activeFilter === 'COOKING' ? 'bg-rollify-red text-white' : 'text-stone-400'
              )}
            >
              Cooking
            </button>
            <button
              onClick={() => setActiveFilter('READY')}
              className={clsx(
                'px-3 py-1 text-xs font-bold rounded-xl transition',
                activeFilter === 'READY' ? 'bg-rollify-red text-white' : 'text-stone-400'
              )}
            >
              Ready
            </button>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-stone-200 rounded-3xl bg-white">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-stone-800">Kitchen Queue is Clear!</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            All orders have been cooked and sent to guests. New tickets will ring into this screen in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTickets.map((ticket) => {
            const elapsed = Number(ticket.elapsed_minutes || 0);
            const isOverdue = elapsed >= 15;
            const isWarning = elapsed >= 8 && elapsed < 15;

            return (
              <div
                key={ticket.id}
                className={clsx(
                  'rounded-3xl border-2 flex flex-col justify-between overflow-hidden shadow-md transition-all',
                  ticket.status === 'READY'
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : isOverdue
                    ? 'border-rose-500 bg-rose-50/20 animate-pulse-slow'
                    : isWarning
                    ? 'border-amber-400 bg-amber-50/20'
                    : 'border-stone-300 bg-white'
                )}
              >
                {/* Ticket Header Bar */}
                <div
                  className={clsx(
                    'p-3.5 flex items-center justify-between text-white',
                    ticket.status === 'READY'
                      ? 'bg-emerald-600'
                      : isOverdue
                      ? 'bg-rose-600'
                      : isWarning
                      ? 'bg-amber-600'
                      : 'bg-stone-800'
                  )}
                >
                  <div>
                    <h3 className="text-lg font-black tracking-tight leading-none">
                      {ticket.table_number ? `TABLE ${ticket.table_number}` : ticket.order_type}
                    </h3>
                    <p className="text-[11px] font-mono opacity-90 mt-0.5">
                      {ticket.order_number}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="flex items-center gap-1 font-mono font-bold text-sm">
                      <Clock className="w-3.5 h-3.5" />
                      {elapsed} min
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                      {ticket.status === 'SENT_TO_KITCHEN' ? 'NEW TICKET' : ticket.status}
                    </span>
                  </div>
                </div>

                {/* Items Ticket Body */}
                <div className="p-4 flex-1 space-y-3">
                  <div className="divide-y divide-stone-100">
                    {ticket.items.map((it) => (
                      <div key={it.id} className="py-2.5 flex items-start gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-stone-900 text-white font-mono font-black text-sm flex items-center justify-center shrink-0">
                          {it.quantity}
                        </span>

                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={clsx(
                                'w-2 h-2 rounded-full shrink-0',
                                it.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                              )}
                            />
                            <h4 className="text-sm font-black text-stone-900 leading-snug">
                              {it.item_name}
                            </h4>
                          </div>

                          {it.variant_name && it.variant_name !== 'Single' && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[10px] font-bold font-mono">
                              SIZE: {it.variant_name}
                            </span>
                          )}

                          {it.notes && (
                            <p className="mt-1 text-xs font-bold text-amber-900 bg-amber-100/80 p-1.5 rounded-lg border border-amber-300">
                              ★ {it.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ticket.order_notes && (
                    <div className="p-2.5 rounded-xl bg-stone-100 text-xs text-stone-700 border border-stone-200">
                      <strong>Order Special Note:</strong> {ticket.order_notes}
                    </div>
                  )}
                </div>

                {/* Kitchen Action Buttons */}
                <div className="p-3 bg-stone-50 border-t border-stone-100">
                  {ticket.status === 'SENT_TO_KITCHEN' && (
                    <Button
                      variant="gold"
                      size="md"
                      className="w-full text-xs font-black h-11"
                      onClick={() => updateTicketStatus(ticket.id, 'PREPARING')}
                      leftIcon={<Flame className="w-4 h-4 text-rollify-red" />}
                    >
                      Start Cooking Ticket
                    </Button>
                  )}

                  {ticket.status === 'PREPARING' && (
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full text-xs font-black h-11 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => updateTicketStatus(ticket.id, 'READY')}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Mark Order Ready (Ring Waiter)
                    </Button>
                  )}

                  {ticket.status === 'READY' && (
                    <div className="text-center py-2 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5 bg-emerald-100/60 rounded-xl">
                      <Bell className="w-4 h-4 animate-bounce" />
                      Pickup Bell Ringing • Ready for Server
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
