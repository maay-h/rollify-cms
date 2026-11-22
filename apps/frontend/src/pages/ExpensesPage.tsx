import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge, BadgeVariant } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { 
  Receipt, 
  Building2, 
  Plus, 
  CheckCircle2, 
  DollarSign, 
  Search, 
  ShieldAlert, 
  TrendingDown, 
  ArrowUpRight, 
  Calendar,
  CreditCard
} from 'lucide-react';
import { clsx } from 'clsx';

interface ExpenseItem {
  id: string;
  vendor_id?: string;
  vendor_name?: string;
  category: 'RAW_MATERIALS' | 'UTILITIES' | 'RENT' | 'MAINTENANCE' | 'PACKAGING' | 'SALARY' | 'OTHER';
  amount: string | number;
  payment_status: 'PAID' | 'PENDING_LIABILITY';
  payment_method?: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  description: string;
  expense_date: string;
  created_by_name?: string;
}

interface VendorItem {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  current_liability: string | number;
  total_business_volume: string | number;
  total_invoices: number;
}

export const ExpensesPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'expenses' | 'vendors'>('expenses');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState({
    totalPaid: 0,
    totalPendingLiability: 0,
    categoryTotals: {} as Record<string, number>,
  });

  const [vendorSummary, setVendorSummary] = useState({
    totalVendors: 0,
    totalOutstandingDebt: 0,
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  // Form states
  const [expCategory, setExpCategory] = useState<'RAW_MATERIALS' | 'UTILITIES' | 'RENT' | 'MAINTENANCE' | 'PACKAGING' | 'SALARY' | 'OTHER'>('UTILITIES');
  const [expAmount, setExpAmount] = useState('');
  const [expVendorId, setExpVendorId] = useState('');
  const [expPaymentStatus, setExpPaymentStatus] = useState<'PAID' | 'PENDING_LIABILITY'>('PAID');
  const [expPaymentMethod, setExpPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('UPI');
  const [expDescription, setExpDescription] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));

  const [settleMethod, setSettleMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  const [venId, setVenId] = useState('');
  const [venName, setVenName] = useState('');
  const [venPerson, setVenPerson] = useState('');
  const [venPhone, setVenPhone] = useState('');
  const [venEmail, setVenEmail] = useState('');
  const [venAddress, setVenAddress] = useState('');
  const [venInitialLiability, setVenInitialLiability] = useState('0');

  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data);
        if (json.summary) setSummary(json.summary);
      }
    } catch (e) {
      toast.error('Failed to load operating expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/expenses/vendors', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setVendors(json.data);
        if (json.summary) setVendorSummary(json.summary);
      }
    } catch (e) {
      toast.error('Failed to load vendor liabilities');
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchVendors();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }
    if (!expDescription.trim()) {
      toast.error('Description is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: expCategory,
          amount: amt,
          vendorId: expVendorId || null,
          paymentStatus: expPaymentStatus,
          paymentMethod: expPaymentStatus === 'PAID' ? expPaymentMethod : null,
          description: expDescription.trim(),
          expenseDate: expDate,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Expense of ₹${amt} recorded (${expPaymentStatus})`);
        setIsAddExpenseOpen(false);
        setExpAmount('');
        setExpDescription('');
        fetchExpenses();
        fetchVendors();
      } else {
        toast.error(json.error || 'Failed to record expense');
      }
    } catch (err) {
      toast.error('Network error recording expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/expenses/${selectedExpense.id}/settle-liability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod: settleMethod,
          transactionReference: settleRef || undefined,
          notes: settleNotes || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Vendor liability of ₹${selectedExpense.amount} settled via ${settleMethod}`);
        setIsSettleOpen(false);
        fetchExpenses();
        fetchVendors();
      } else {
        toast.error(json.error || 'Failed to settle liability');
      }
    } catch (err) {
      toast.error('Network error during settlement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venName.trim() || !venId.trim()) {
      toast.error('Vendor ID and Name are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: venId.trim().toLowerCase().startsWith('ven-') ? venId.trim().toLowerCase() : `ven-${venId.trim().toLowerCase()}`,
          name: venName.trim(),
          contactPerson: venPerson.trim() || undefined,
          phone: venPhone.trim() || undefined,
          email: venEmail.trim() || undefined,
          address: venAddress.trim() || undefined,
          initialLiability: parseFloat(venInitialLiability) || 0,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Vendor '${venName}' registered successfully`);
        setIsAddVendorOpen(false);
        setVenId('');
        setVenName('');
        fetchVendors();
      } else {
        toast.error(json.error || 'Failed to register vendor');
      }
    } catch (err) {
      toast.error('Network error registering vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && e.payment_status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rollify-red-50 text-rollify-red rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Expenses & Vendor Payables</h1>
              <p className="text-xs text-stone-500">
                Operating overheads, supplier debt management, and payment reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasRole('ADMIN', 'MANAGER') && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Building2 className="w-4 h-4" />}
                onClick={() => setIsAddVendorOpen(true)}
              >
                Register Vendor
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsAddExpenseOpen(true)}
              >
                Record Expense
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total Settled Expenses</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">₹{summary.totalPaid.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl text-stone-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Paid out via Cash, UPI, and Bank Transfers</p>
        </Card>

        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Liabilities</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">₹{summary.totalPendingLiability.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-800 mt-2">Unpaid supplier credit invoices to settle</p>
        </Card>

        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Registered Vendors</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{vendorSummary.totalVendors}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Total Outstanding Debt: ₹{vendorSummary.totalOutstandingDebt.toLocaleString('en-IN')}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab('expenses')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'expenses'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <Receipt className="w-4 h-4" />
          Operating Expenses ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'vendors'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <Building2 className="w-4 h-4" />
          Vendors & Payables ({vendors.length})
        </button>
      </div>

      {/* TAB 1: EXPENSES */}
      {activeTab === 'expenses' && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
              >
                <option value="ALL">All Categories</option>
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="UTILITIES">Utilities (Gas/Electricity)</option>
                <option value="RENT">Store Rent</option>
                <option value="PACKAGING">Packaging</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="SALARY">Salaries</option>
                <option value="OTHER">Other</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING_LIABILITY">Pending Liability</option>
              </select>
            </div>

            <Button size="sm" variant="outline" onClick={fetchExpenses}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading expenses..." />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              title="No expenses found"
              description="No operating expenses matched the selected filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-3">Vendor</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredExpenses.map((exp) => {
                    const isPending = exp.payment_status === 'PENDING_LIABILITY';
                    return (
                      <tr key={exp.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                          {exp.expense_date}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-700 font-semibold text-[10px] uppercase">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900 max-w-xs truncate" title={exp.description}>
                          {exp.description}
                        </td>
                        <td className="py-3 px-3 text-stone-600">
                          {exp.vendor_name || '—'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-stone-900">
                          ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono text-stone-500 text-[11px]">
                          {exp.payment_method || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={isPending ? 'warning' : 'success'}>
                            {isPending ? 'Pending Debt' : 'Paid'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPending && hasRole('ADMIN', 'MANAGER') ? (
                            <button
                              onClick={() => {
                                setSelectedExpense(exp);
                                setIsSettleOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Settle</span>
                            </button>
                          ) : (
                            <span className="text-stone-300 text-[10px]">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: VENDORS */}
      {activeTab === 'vendors' && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Vendor Directory & Payable Ledger</h2>
              <p className="text-xs text-stone-400">Track outstanding balances, credit periods and supplier contacts</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchVendors}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Total Volume</th>
                  <th className="py-3 px-3">Invoices</th>
                  <th className="py-3 px-4 text-right">Current Payable Debt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {vendors.map((ven) => {
                  const debt = Number(ven.current_liability);
                  return (
                    <tr key={ven.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-stone-900">
                        <div>
                          <span>{ven.name}</span>
                          <span className="block text-[10px] text-stone-400 font-mono">{ven.id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-stone-600">{ven.contact_person || '—'}</td>
                      <td className="py-3.5 px-3 font-mono text-stone-600">{ven.phone || '—'}</td>
                      <td className="py-3.5 px-3 font-mono text-stone-700">
                        ₹{Number(ven.total_business_volume).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 text-stone-600">{ven.total_invoices}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={clsx('font-bold font-mono text-sm', debt > 0 ? 'text-amber-800' : 'text-emerald-700')}>
                          ₹{debt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: ADD EXPENSE */}
      <Modal isOpen={isAddExpenseOpen} onClose={() => setIsAddExpenseOpen(false)} title="Record Operational Expense">
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Expense Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
              >
                <option value="UTILITIES">Utilities (Gas/Electricity)</option>
                <option value="RENT">Store Rent</option>
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="PACKAGING">Packaging & Supplies</option>
                <option value="MAINTENANCE">Repairs & Maintenance</option>
                <option value="SALARY">Salaries & Wages</option>
                <option value="OTHER">Other Operating Overheads</option>
              </select>
            </div>

            <Input
              label="Amount (₹)"
              type="number"
              step="any"
              placeholder="e.g. 5000"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Status</label>
              <select
                value={expPaymentStatus}
                onChange={(e) => setExpPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
              >
                <option value="PAID">Paid Immediately</option>
                <option value="PENDING_LIABILITY">Pending Liability (Supplier Credit)</option>
              </select>
            </div>

            {expPaymentStatus === 'PAID' && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Method</label>
                <select
                  value={expPaymentMethod}
                  onChange={(e) => setExpPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="CASH">Cash Drawer Outflow</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Associated Vendor (Optional)</label>
            <select
              value={expVendorId}
              onChange={(e) => setExpVendorId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
            >
              <option value="">No vendor / Independent expense</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Description & Notes"
            placeholder="e.g. Commercial gas cylinder refill invoice #2991"
            value={expDescription}
            onChange={(e) => setExpDescription(e.target.value)}
            required
          />

          <Input
            label="Expense Date"
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAddExpenseOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Record Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SETTLE LIABILITY */}
      <Modal isOpen={isSettleOpen} onClose={() => setIsSettleOpen(false)} title="Settle Vendor Liability">
        <form onSubmit={handleSettleLiability} className="space-y-4">
          <p className="text-xs text-stone-500">
            Settling outstanding debt of{' '}
            <strong className="text-stone-900 font-bold font-mono">
              ₹{selectedExpense?.amount}
            </strong>{' '}
            for <strong className="text-stone-800">{selectedExpense?.description}</strong>
          </p>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Method</label>
            <select
              value={settleMethod}
              onChange={(e) => setSettleMethod(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI / Online Transfer</option>
              <option value="CASH">Cash Drawer Outflow</option>
            </select>
          </div>

          <Input
            label="Transaction Reference / Cheque #"
            placeholder="e.g. UTR-AXIS-9912048"
            value={settleRef}
            onChange={(e) => setSettleRef(e.target.value)}
          />

          <Input
            label="Settlement Notes"
            placeholder="Optional reference notes"
            value={settleNotes}
            onChange={(e) => setSettleNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsSettleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Confirm Settlement
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD VENDOR */}
      <Modal isOpen={isAddVendorOpen} onClose={() => setIsAddVendorOpen(false)} title="Register New Supplier / Vendor">
        <form onSubmit={handleCreateVendor} className="space-y-3">
          <Input
            label="Vendor Code / ID"
            placeholder="e.g. ven-dairy-02"
            value={venId}
            onChange={(e) => setVenId(e.target.value)}
            required
          />

          <Input
            label="Vendor Business Name"
            placeholder="e.g. Nandi Valley Dairy Products"
            value={venName}
            onChange={(e) => setVenName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Contact Person"
              placeholder="e.g. Ramesh Gowda"
              value={venPerson}
              onChange={(e) => setVenPerson(e.target.value)}
            />
            <Input
              label="Phone Number"
              placeholder="e.g. +91 98450 12345"
              value={venPhone}
              onChange={(e) => setVenPhone(e.target.value)}
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            placeholder="orders@supplier.in"
            value={venEmail}
            onChange={(e) => setVenEmail(e.target.value)}
          />

          <Input
            label="Warehouse / Business Address"
            placeholder="City, Market or Road address"
            value={venAddress}
            onChange={(e) => setVenAddress(e.target.value)}
          />

          <Input
            label="Opening Outstanding Liability (₹)"
            type="number"
            step="any"
            value={venInitialLiability}
            onChange={(e) => setVenInitialLiability(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAddVendorOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Register Vendor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
