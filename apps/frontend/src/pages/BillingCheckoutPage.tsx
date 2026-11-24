import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge, BadgeVariant } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ReceiptModal, BillDetail } from '../components/billing/ReceiptModal.js';
import { 
  CreditCard, 
  DollarSign, 
  QrCode, 
  Layers, 
  Printer, 
  Receipt, 
  Search, 
  CheckCircle2, 
  Tag, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { clsx } from 'clsx';

interface OrderToBill {
  id: string;
  order_number: string;
  order_type: string;
  table_number?: string;
  customer_name?: string;
  status: string;
  total_amount: string;
  created_at: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    subtotal: string;
  }>;
}

interface BillListItem {
  id: string;
  bill_number: string;
  order_id: string;
  order_number: string;
  order_type: string;
  table_number?: string;
  customer_name?: string;
  gross_amount: string;
  discount_amount: string;
  discount_reason?: string;
  tax_amount: string;
  net_amount: string;
  paid_amount: string;
  balance_due: number;
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  cashier_name?: string;
  created_at: string;
}

export const BillingCheckoutPage: React.FC = () => {
  const { token, user, hasRole } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [bills, setBills] = useState<BillListItem[]>([]);
  const [unbilledOrders, setUnbilledOrders] = useState<OrderToBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'UNBILLED' | 'INVOICES'>('UNBILLED');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Selected Bill for Payment Tender Modal
  const [selectedBill, setSelectedBill] = useState<BillListItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [tenderAmount, setTenderAmount] = useState<number>(0);
  const [tenderedCash, setTenderedCash] = useState<number>(0);
  const [txnRef, setTxnRef] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Discount Selection in Bill Generation
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  // Receipt Preview
  const [previewBill, setPreviewBill] = useState<BillDetail | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Refund / Void State
  const [refundBill, setRefundBill] = useState<BillListItem | null>(null);
  const [refundReason, setRefundReason] = useState<string>('Customer Request');
  const [refundNotes, setRefundNotes] = useState<string>('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // Process Refund Submission
  const handleProcessRefund = async () => {
    if (!refundBill) return;
    setIsProcessingRefund(true);
    try {
      const res = await fetch(`/api/billing/${refundBill.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: refundReason,
          notes: refundNotes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Invoice Refunded', 'Invoice has been voided and marked as refunded.');
        setRefundBill(null);
        setRefundReason('Customer Request');
        setRefundNotes('');
        await fetchBillingData();
      } else {
        toast.error('Refund Failed', json.error || 'Could not process refund');
      }
    } catch (err: any) {
      toast.error('Refund Failed', err.message);
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const fetchBillingData = async () => {
    try {
      const [billsRes, ordersRes] = await Promise.all([
        fetch('/api/billing', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/orders?activeOnly=true', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const billsJson = await billsRes.json();
      const ordersJson = await ordersRes.json();

      if (Array.isArray(billsJson.data)) setBills(billsJson.data);
      if (Array.isArray(ordersJson.data)) {
        // Find orders that don't have a generated bill yet or are served
        const billedOrderIds = new Set((billsJson.data || []).map((b: BillListItem) => b.order_id));
        const unbilled = ordersJson.data.filter((o: any) => !billedOrderIds.has(o.id));
        setUnbilledOrders(unbilled);
      }
    } catch (err) {
      toast.error('Failed to load billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [token]);

  // Real-Time Socket Listeners for Payments and New Bills
  useEffect(() => {
    if (!socket) return;

    socket.on('payment:received', () => {
      fetchBillingData();
    });

    socket.on('order:new', () => {
      fetchBillingData();
    });

    socket.on('order:status_updated', () => {
      fetchBillingData();
    });

    return () => {
      socket.off('payment:received');
      socket.off('order:new');
      socket.off('order:status_updated');
    };
  }, [socket]);

  const filteredBills = bills.filter((b) => {
    if (statusFilter !== 'ALL' && b.payment_status !== statusFilter) return false;
    if (search && !b.bill_number.toLowerCase().includes(search.toLowerCase()) && !b.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Generate Bill from Served Order
  const handleGenerateBill = async (order: OrderToBill) => {
    try {
      const payload = {
        discountType,
        discountValue,
        discountReason: discountReason || undefined,
      };

      const res = await fetch(`/api/billing/generate/${order.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Bill Generated`, `Invoice ${json.data.bill_number} ready for settlement`);
        // Reset discount
        setDiscountType('NONE');
        setDiscountValue(0);
        setDiscountReason('');
        await fetchBillingData();
        // Automatically open payment tender modal for this new bill
        openPaymentModal(json.data);
      } else {
        toast.error('Bill Generation Error', json.error);
      }
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  // Open Payment Modal
  const openPaymentModal = (bill: BillListItem) => {
    setSelectedBill(bill);
    const due = Number(bill.balance_due || bill.net_amount);
    setTenderAmount(due);
    setTenderedCash(due);
    setPaymentMethod('CASH');
    setTxnRef('');
  };

  // Process Payment Submission
  const handleProcessPayment = async () => {
    if (!selectedBill) return;

    if (tenderAmount <= 0) {
      toast.warning('Invalid Amount', 'Payment amount must be greater than zero');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await fetch(`/api/billing/${selectedBill.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod,
          amount: tenderAmount,
          transactionReference: txnRef || undefined,
          tenderedCash: paymentMethod === 'CASH' ? tenderedCash : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Payment Received!', json.message);
        const billId = selectedBill.id;
        setSelectedBill(null);
        await fetchBillingData();
        // Load receipt for print preview
        await loadReceipt(billId);
      } else {
        toast.error('Payment Failed', json.error);
      }
    } catch (e: any) {
      toast.error('Network Error', e.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Load Printable Thermal Receipt
  const loadReceipt = async (billId: string) => {
    try {
      const res = await fetch(`/api/billing/${billId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setPreviewBill(json.data);
        setReceiptOpen(true);
      }
    } catch (e) {
      toast.error('Failed to load receipt details');
    }
  };

  const statusBadgeVariants: Record<BillListItem['payment_status'], BadgeVariant> = {
    UNPAID: 'danger',
    PARTIALLY_PAID: 'warning',
    PAID: 'paid',
    REFUNDED: 'cancelled',
  };

  // Change to return calculation
  const cashChange = Math.max(0, Math.round((tenderedCash - tenderAmount) * 100) / 100);

  if (loading) {
    return <LoadingSpinner text="Loading Billing & Cash Reconciliation..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Billing, Checkout & Payment Reconciliation
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Generate formal 5% GST tax invoices, split payments (Cash/UPI/Card), and printable thermal receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab(activeTab === 'UNBILLED' ? 'INVOICES' : 'UNBILLED')}
          >
            {activeTab === 'UNBILLED' ? 'View All Settled Invoices' : 'View Orders Awaiting Billing'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab('UNBILLED')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2',
            activeTab === 'UNBILLED'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          )}
        >
          <Receipt className="w-4 h-4" />
          Awaiting Billing ({unbilledOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2',
            activeTab === 'INVOICES'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          )}
        >
          <CreditCard className="w-4 h-4" />
          All Invoices / Settle Payment ({bills.length})
        </button>
      </div>

      {/* TAB 1: Orders Awaiting Billing */}
      {activeTab === 'UNBILLED' && (
        <div className="space-y-4">
          {unbilledOrders.length === 0 ? (
            <EmptyState
              title="No Pending Orders to Bill"
              description="All active dining tabs have either been invoiced or no orders are currently placed."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {unbilledOrders.map((order) => (
                <Card key={order.id} className="p-5 flex flex-col justify-between">
                  <div>
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

                      <Badge variant="served" size="sm" dot>
                        {order.status}
                      </Badge>
                    </div>

                    <div className="py-3 space-y-1 text-xs">
                      {order.items?.map((it) => (
                        <div key={it.id} className="flex justify-between">
                          <span className="text-stone-700">
                            {it.quantity}x {it.item_name}
                          </span>
                          <span className="font-mono text-stone-500">₹{it.subtotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-stone-500">Order Total (incl. GST)</span>
                      <span className="text-base font-black font-mono text-stone-900">
                        ₹{order.total_amount}
                      </span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleGenerateBill(order)}
                      leftIcon={<Receipt className="w-3.5 h-3.5" />}
                    >
                      Generate Bill & Pay
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Invoices & Payment Ledger */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="overflow-hidden bg-white border border-stone-200/80 rounded-3xl shadow-xs">
            <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice number, table, or guest..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-1">
                {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={clsx(
                      'px-3 py-1 rounded-xl text-[11px] font-bold transition',
                      statusFilter === st
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Table / Type</th>
                    <th className="py-3 px-4">Gross</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">GST (5%)</th>
                    <th className="py-3 px-4">Net Total</th>
                    <th className="py-3 px-4">Paid</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-stone-400">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                        <p className="text-sm font-semibold text-stone-600">No Invoices Found</p>
                        <p className="text-xs text-stone-400 mt-0.5">Invoices generated for completed or ongoing orders will be listed here.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-stone-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          {bill.bill_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-stone-700">
                          {bill.table_number ? `Table ${bill.table_number}` : bill.order_type}
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500">
                          ₹{Number(bill.gross_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-700 font-bold">
                          {Number(bill.discount_amount) > 0 ? `-₹${Number(bill.discount_amount).toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500">
                          ₹{Number(bill.tax_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          ₹{Number(bill.net_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-700">
                          ₹{Number(bill.paid_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-rollify-red">
                          ₹{Number(bill.balance_due || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={statusBadgeVariants[bill.payment_status]} size="sm" dot>
                            {bill.payment_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {bill.payment_status !== 'PAID' && bill.payment_status !== 'REFUNDED' && (
                              <Button
                                variant="primary"
                                size="sm"
                                className="text-xs h-7 py-0 px-2.5"
                                onClick={() => openPaymentModal(bill)}
                              >
                                Tender Pay
                              </Button>
                            )}
                            {bill.payment_status === 'PAID' && (
                              <Button
                                variant="outline"
                                size="sm"
                                title="Issue Refund & Void Invoice"
                                className="text-xs h-7 py-0 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                onClick={() => {
                                  setRefundBill(bill);
                                  setRefundReason('Customer Request');
                                  setRefundNotes('');
                                }}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 py-0 px-2"
                              onClick={() => loadReceipt(bill.id)}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tender Modal */}
      <Modal
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        title={
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-rollify-red" />
            <span>Settle Invoice: {selectedBill?.bill_number}</span>
          </div>
        }
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          {/* Bill Summary Banner */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/60 flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-500">
                Order {selectedBill?.order_number} • {selectedBill?.table_number ? `Table ${selectedBill.table_number}` : 'Takeaway'}
              </p>
              <p className="text-sm font-bold text-stone-900 mt-0.5">
                Net Bill Amount: <span className="font-mono">₹{selectedBill?.net_amount}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Balance Due</span>
              <span className="text-xl font-black font-mono text-rollify-red">
                ₹{selectedBill?.balance_due}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Select Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: <DollarSign className="w-4 h-4" /> },
                { id: 'UPI', label: 'UPI / QR', icon: <QrCode className="w-4 h-4" /> },
                { id: 'CARD', label: 'Card (POS)', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'SPLIT', label: 'Split Pay', icon: <Layers className="w-4 h-4" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={clsx(
                    'p-2.5 rounded-2xl border-2 font-bold text-xs flex flex-col items-center gap-1.5 transition',
                    paymentMethod === m.id
                      ? 'border-rollify-red bg-rollify-red-50 text-rollify-red shadow-xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tender Amount Input (For Partial or Split Payment) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                Amount to Tender (₹)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const bal = Number(selectedBill?.balance_due || 0);
                    setTenderAmount(bal);
                    setTenderedCash(bal);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                >
                  Full (100%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bal = Number(selectedBill?.balance_due || 0);
                    const split = Math.round((bal / 2) * 100) / 100;
                    setTenderAmount(split);
                    setTenderedCash(split);
                    setPaymentMethod('SPLIT');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 transition"
                >
                  Split 2-Way
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bal = Number(selectedBill?.balance_due || 0);
                    const split = Math.round((bal / 3) * 100) / 100;
                    setTenderAmount(split);
                    setTenderedCash(split);
                    setPaymentMethod('SPLIT');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 transition"
                >
                  Split 3-Way
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bal = Number(selectedBill?.balance_due || 0);
                    const split = Math.round((bal / 4) * 100) / 100;
                    setTenderAmount(split);
                    setTenderedCash(split);
                    setPaymentMethod('SPLIT');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 transition"
                >
                  Split 4-Way
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              value={tenderAmount || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setTenderAmount(val);
                setTenderedCash(val);
              }}
              className="w-full text-lg font-mono font-bold p-3 border-2 border-stone-200 rounded-2xl focus:border-rollify-red focus:outline-none"
            />
          </div>

          {/* CASH: Quick Tender Notes & Change Calculator */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-2 p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Cash Tendered & Change Return
              </span>
              <div className="flex gap-2">
                {[100, 200, 500, 2000].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setTenderedCash(note)}
                    className="flex-1 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-bold text-stone-800 hover:bg-stone-100"
                  >
                    ₹{note}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-xs font-bold">
                <span className="text-stone-600">Change to Return to Diner:</span>
                <span className="font-mono text-base text-emerald-700 font-black">
                  ₹{cashChange.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* UPI: Transaction Ref */}
          {paymentMethod === 'UPI' && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                UPI Reference / UTR Number
              </label>
              <input
                type="text"
                placeholder="e.g. 433129847192 or GPay ref"
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                className="w-full p-2.5 border border-stone-200 rounded-xl text-xs focus:outline-none font-mono"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedBill(null)}
              disabled={isProcessingPayment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isProcessingPayment}
              onClick={handleProcessPayment}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Payment (₹{tenderAmount.toFixed(2)})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund / Void Invoice Modal */}
      <Modal
        isOpen={Boolean(refundBill)}
        onClose={() => setRefundBill(null)}
        maxWidth="sm"
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <RotateCcw className="w-5 h-5" />
            <span>Issue Refund & Void Invoice</span>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
            <div className="flex justify-between font-bold text-rose-900">
              <span>Invoice #{refundBill?.bill_number}</span>
              <span className="font-mono">₹{refundBill?.net_amount}</span>
            </div>
            <p className="text-rose-700">
              This will record a refund transaction, mark the invoice as REFUNDED, and cancel the order.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Select Reason for Refund *
            </label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500"
            >
              <option value="Customer Request">Customer Changed Mind / Requested Refund</option>
              <option value="Order Quality Issue">Food Quality or Taste Issue</option>
              <option value="Wrong Item Prepared">Wrong Item Prepared / Kitchen Error</option>
              <option value="Accidental Duplicate">Accidental Duplicate Billing</option>
              <option value="Item Out of Stock">Item Out of Stock</option>
              <option value="Other">Other Administrative Adjustment</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Authorization Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
              placeholder="e.g. Authorized by Shift Supervisor"
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundBill(null)}
              disabled={isProcessingRefund}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isProcessingRefund}
              onClick={handleProcessRefund}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Confirm Refund (₹{refundBill?.net_amount})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        bill={previewBill}
      />
    </div>
  );
};
