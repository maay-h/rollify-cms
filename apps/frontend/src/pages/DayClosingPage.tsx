import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  DollarSign, 
  CreditCard, 
  QrCode, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { clsx } from 'clsx';

interface DayClosePreview {
  businessDate: string;
  totalBills: number;
  totalGross: number;
  totalDiscounts: number;
  totalGST: number;
  totalNet: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  refunds: number;
  totalSettledSales: number;
}

export const DayClosingPage: React.FC = () => {
  const { token, user, hasRole } = useAuth();
  const toast = useToast();

  const [preview, setPreview] = useState<DayClosePreview | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [openingCash, setOpeningCash] = useState<number>(500);
  const [actualCashCounted, setActualCashCounted] = useState<number>(500);
  const [notes, setNotes] = useState<string>('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState(false);

  const fetchPreview = async () => {
    try {
      const res = await fetch('/api/billing/day-close/preview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setPreview(json.data);
        // Default actual cash to expected cash initially
        const exp = Math.round((openingCash + json.data.cashSales - json.data.refunds) * 100) / 100;
        setActualCashCounted(exp);
      }
    } catch (e) {
      toast.error('Failed to load shift closing metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [token]);

  const cashSales = preview?.cashSales || 0;
  const refunds = preview?.refunds || 0;
  const expectedCash = Math.round((openingCash + cashSales - refunds) * 100) / 100;
  const cashVariance = Math.round((actualCashCounted - expectedCash) * 100) / 100;

  const handleSubmitClosing = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/billing/day-close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          openingCash,
          actualCashCounted,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Day Closing Registered', 'Cash register reconciled and locked');
        setClosingSuccess(true);
        setIsConfirmOpen(false);
      } else {
        toast.error('Closing Failed', json.error);
      }
    } catch (err: any) {
      toast.error('Network Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Computing shift financial reconciliation..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Shift & Day Closing Financial Reconciliation
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Reconcile physical cash in drawer, UPI & card settlement totals, and record immutable day-end ledger entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPreview} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Refresh Totals
          </Button>
        </div>
      </div>

      {closingSuccess ? (
        <Card className="p-8 text-center bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-emerald-950">Shift Successfully Closed & Reconciled!</h2>
          <p className="text-xs text-emerald-700 max-w-md mx-auto mt-1 mb-6">
            Financial audit record has been permanently logged in the database. Cash variance was ₹{cashVariance.toFixed(2)}.
          </p>
          <Button variant="charcoal" size="sm" onClick={() => setClosingSuccess(false)}>
            Review Ledger Details
          </Button>
        </Card>
      ) : (
        <>
          {/* Today's Sales Performance Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Settled Sales</span>
              <p className="text-2xl font-black font-mono text-stone-900 mt-1">
                ₹{preview?.totalSettledSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">{preview?.totalBills} Bills settled today</p>
            </Card>

            <Card className="p-4 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Cash Sales</span>
              <p className="text-2xl font-black font-mono text-emerald-700 mt-1">
                ₹{preview?.cashSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">Physical currency collected</p>
            </Card>

            <Card className="p-4 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">UPI / QR Sales</span>
              <p className="text-2xl font-black font-mono text-blue-700 mt-1">
                ₹{preview?.upiSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">Direct bank settlements</p>
            </Card>

            <Card className="p-4 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Card POS Sales</span>
              <p className="text-2xl font-black font-mono text-purple-700 mt-1">
                ₹{preview?.cardSales.toFixed(2)}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">Card terminal swipes</p>
            </Card>
          </div>

          {/* Detailed Financial Accounting Breakdown */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rollify-red" />
              Accounting Definitions & Tax Ledger (Date: {preview?.businessDate})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 font-sans block">Gross Sales:</span>
                <span className="font-bold text-stone-900 text-sm">₹{preview?.totalGross.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 font-sans block">Discounts Given:</span>
                <span className="font-bold text-emerald-700 text-sm">-₹{preview?.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 font-sans block">GST Collected (5%):</span>
                <span className="font-bold text-stone-900 text-sm">₹{preview?.totalGST.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl">
                <span className="text-stone-500 font-sans block">Refunds Issued:</span>
                <span className="font-bold text-rose-700 text-sm">-₹{preview?.refunds.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Cash Drawer Reconciliation Form */}
          <Card className="p-6 border-2 border-stone-200/80">
            <h3 className="text-sm font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-rollify-gold" />
              Physical Cash Drawer Count & Variance Auditing
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Opening Cash Float */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Opening Cash Float (₹)
                  </label>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                    className="w-full text-base font-mono font-bold p-2.5 border border-stone-200 rounded-xl focus:outline-none"
                  />
                  <p className="text-[10px] text-stone-400">Starting change in till</p>
                </div>

                {/* 2. Expected Cash (Auto-calculated) */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Expected Cash in Drawer (₹)
                  </label>
                  <div className="w-full text-base font-mono font-bold p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-stone-800">
                    ₹{expectedCash.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-stone-400">Float + Cash Sales - Refunds</p>
                </div>

                {/* 3. Actual Counted Cash */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Actual Physical Count (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={actualCashCounted}
                    onChange={(e) => setActualCashCounted(parseFloat(e.target.value) || 0)}
                    className="w-full text-base font-mono font-bold p-2.5 border-2 border-rollify-gold rounded-xl focus:outline-none bg-amber-50/20"
                  />
                  <p className="text-[10px] text-stone-400">Total physical notes counted</p>
                </div>
              </div>

              {/* Variance Alert Banner */}
              <div
                className={clsx(
                  'p-4 rounded-2xl border flex items-center justify-between',
                  cashVariance === 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : cashVariance > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                )}
              >
                <div className="flex items-center gap-3">
                  {cashVariance === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">
                      {cashVariance === 0
                        ? 'Cash Drawer Perfectly Balanced (₹0.00 Variance)'
                        : cashVariance > 0
                        ? `Cash Surplus Detected (+₹${cashVariance.toFixed(2)})`
                        : `Cash Shortage Detected (-₹${Math.abs(cashVariance).toFixed(2)})`}
                    </h4>
                    <p className="text-xs opacity-80">
                      Expected ₹{expectedCash.toFixed(2)} vs Counted ₹{actualCashCounted.toFixed(2)}
                    </p>
                  </div>
                </div>

                <span className="text-lg font-black font-mono">
                  {cashVariance >= 0 ? `+₹${cashVariance.toFixed(2)}` : `-₹${Math.abs(cashVariance).toFixed(2)}`}
                </span>
              </div>

              {/* Shift Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Closing Notes & Shift Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Evening shift closed with cashier Priya. Extra change returned to main safe..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* Submit Day Close Button */}
              <div className="flex justify-end pt-3 border-t border-stone-100">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsConfirmOpen(true)}
                  leftIcon={<Lock className="w-4 h-4" />}
                >
                  Submit & Lock Day Closing
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSubmitClosing}
        title="Lock Shift & Submit Day Closing?"
        message={
          <>
            Are you sure you want to lock the register for <strong>{preview?.businessDate}</strong>?
            Actual counted cash: <strong>₹{actualCashCounted.toFixed(2)}</strong> (Variance: {cashVariance >= 0 ? `+₹${cashVariance.toFixed(2)}` : `-₹${Math.abs(cashVariance).toFixed(2)}`}).
            This action creates an immutable audit record and finalizes today's ledger.
          </>
        }
        confirmText="Confirm & Lock Shift"
        variant="warning"
        isLoading={isSubmitting}
      />
    </div>
  );
};
