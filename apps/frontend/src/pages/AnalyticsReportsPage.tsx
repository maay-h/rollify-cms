import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Input } from '../components/ui/Input.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Receipt, 
  ShieldCheck, 
  Layers, 
  ShoppingBag, 
  Utensils, 
  CreditCard,
  Download,
  Printer
} from 'lucide-react';
import { clsx } from 'clsx';

interface PnLData {
  revenue: {
    grossRevenue: number;
    discounts: number;
    taxableSales: number;
    gstCollected: number;
    totalCollected: number;
    invoiceCount: number;
  };
  costOfSales: {
    cogs: number;
    wastageCost: number;
    totalProductionCost: number;
  };
  grossProfit: {
    amount: number;
    marginPercent: number;
  };
  operatingExpenses: {
    breakdown: Record<string, number>;
    totalOperatingExpenses: number;
  };
  netProfit: {
    amount: number;
    marginPercent: number;
    isProfitable: boolean;
  };
}

interface SalesBreakdown {
  byOrderType: Array<{
    order_type: string;
    order_count: string | number;
    total_sales: string | number;
  }>;
  byCategory: Array<{
    category_id: string;
    category_name: string;
    units_sold: string | number;
    total_revenue: string | number;
  }>;
  topSellingDishes: Array<{
    item_id: string;
    item_name: string;
    category_name: string;
    is_veg: boolean;
    total_quantity_sold: string | number;
    total_sales_volume: string | number;
  }>;
  byPaymentMethod: Array<{
    payment_method: string;
    transaction_count: string | number;
    total_amount: string | number;
  }>;
}

export const AnalyticsReportsPage: React.FC = () => {
  const { token } = useAuth();
  const toast = useToast();

  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [breakdown, setBreakdown] = useState<SalesBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      let pnlUrl = '/api/analytics/pnl';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) pnlUrl += `?${params.toString()}`;

      const [pnlRes, breakdownRes] = await Promise.all([
        fetch(pnlUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/analytics/sales-breakdown', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [pnlJson, breakdownJson] = await Promise.all([
        pnlRes.json(),
        breakdownRes.json(),
      ]);

      if (pnlJson.success) setPnl(pnlJson.data);
      if (breakdownJson.success) setBreakdown(breakdownJson.data);
    } catch (e) {
      toast.error('Failed to load financial analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!pnl) {
      toast.warning('No Data', 'No financial data available to export');
      return;
    }

    const lines: string[] = [];
    lines.push('ROLLIFY CAFE - FINANCIAL & SALES REPORT');
    lines.push(`Generated At,${new Date().toLocaleString()}`);
    lines.push(`Filter Range,${startDate || 'All Time'} to ${endDate || 'Present'}`);
    lines.push('');

    // P&L Summary
    lines.push('EXECUTIVE PROFIT & LOSS SUMMARY');
    lines.push('Metric,Amount (INR)');
    lines.push(`Gross Revenue,${pnl.revenue.grossRevenue.toFixed(2)}`);
    lines.push(`Discounts Given,${pnl.revenue.discounts.toFixed(2)}`);
    lines.push(`Taxable Sales,${pnl.revenue.taxableSales.toFixed(2)}`);
    lines.push(`GST Collected (5%),${pnl.revenue.gstCollected.toFixed(2)}`);
    lines.push(`Total Collected,${pnl.revenue.totalCollected.toFixed(2)}`);
    lines.push(`Settled Invoices Count,${pnl.revenue.invoiceCount}`);
    lines.push(`Raw Ingredient COGS,${pnl.costOfSales.cogs.toFixed(2)}`);
    lines.push(`Wastage Cost,${pnl.costOfSales.wastageCost.toFixed(2)}`);
    lines.push(`Total Operating Expenses,${pnl.operatingExpenses.totalOperatingExpenses.toFixed(2)}`);
    lines.push(`Net Profit,${pnl.netProfit.amount.toFixed(2)}`);
    lines.push(`Net Profit Margin,${pnl.netProfit.marginPercent.toFixed(1)}%`);
    lines.push('');

    // Sales by Category
    if (breakdown?.byCategory?.length) {
      lines.push('SALES BY CATEGORY');
      lines.push('Category,Units Sold,Total Revenue (INR)');
      breakdown.byCategory.forEach((cat) => {
        lines.push(`"${cat.category_name}",${cat.units_sold},${cat.total_revenue}`);
      });
      lines.push('');
    }

    // Top Selling Dishes
    if (breakdown?.topSellingDishes?.length) {
      lines.push('TOP SELLING DISHES');
      lines.push('Dish Name,Category,Diet,Quantity Sold,Total Volume (INR)');
      breakdown.topSellingDishes.forEach((d) => {
        lines.push(`"${d.item_name}","${d.category_name}",${d.is_veg ? 'VEG' : 'NON-VEG'},${d.total_quantity_sold},${d.total_sales_volume}`);
      });
      lines.push('');
    }

    // Payment Methods
    if (breakdown?.byPaymentMethod?.length) {
      lines.push('PAYMENTS COLLECTED BY TENDER METHOD');
      lines.push('Payment Method,Transactions,Total Amount (INR)');
      breakdown.byPaymentMethod.forEach((pm) => {
        lines.push(`${pm.payment_method},${pm.transaction_count},${pm.total_amount}`);
      });
      lines.push('');
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Rollify_Cafe_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report Exported', 'CSV financial report downloaded successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner text="Computing financial analytics & P&L statements..." size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rollify-red-50 text-rollify-red rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Financial Reports & Profit & Loss</h1>
              <p className="text-xs text-stone-500">
                Live executive accounting: Net revenue, recipe COGS, operating overheads, and profit margins
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36 text-xs"
          />
          <span className="text-xs text-stone-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 text-xs"
          />
          <Button size="sm" variant="primary" onClick={fetchData}>
            Apply
          </Button>

          <div className="h-6 w-px bg-stone-200 mx-1 hidden sm:block" />

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            title="Download full P&L and category report as CSV / Excel"
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            title="Print executive summary statement"
          >
            Print
          </Button>
        </div>
      </div>

      {pnl && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border border-stone-200/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Net Taxable Revenue</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">
                ₹{pnl.revenue.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-stone-500">
                <span>Gross: ₹{pnl.revenue.grossRevenue.toFixed(0)}</span>
                <span>•</span>
                <span>Discounts: -₹{pnl.revenue.discounts.toFixed(0)}</span>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-stone-200/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Raw Ingredient Costs (COGS)</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                ₹{pnl.costOfSales.cogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-amber-700">
                <span>Wastage Loss: ₹{pnl.costOfSales.wastageCost.toFixed(0)}</span>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-stone-200/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Operating Expenses</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">
                ₹{pnl.operatingExpenses.totalOperatingExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-stone-500">
                <span>Rent, Utilities, Packaging, Wages</span>
              </div>
            </Card>

            <Card
              className={clsx(
                'p-4 border',
                pnl.netProfit.isProfitable
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-rose-50/50 border-rose-200'
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-700">Net Operating Profit</p>
              <p
                className={clsx(
                  'text-2xl font-bold mt-1',
                  pnl.netProfit.isProfitable ? 'text-emerald-800' : 'text-rose-800'
                )}
              >
                ₹{pnl.netProfit.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold">
                {pnl.netProfit.isProfitable ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span className={pnl.netProfit.isProfitable ? 'text-emerald-700' : 'text-rose-700'}>
                  Net Margin: {pnl.netProfit.marginPercent}%
                </span>
              </div>
            </Card>
          </div>

          {/* Full P&L Statement Card */}
          <Card className="p-6 bg-white border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">Standardized Profit & Loss (P&L) Statement</h2>
                <p className="text-xs text-stone-400">Compliant restaurant accounting ledger with 5% GST segregation</p>
              </div>
              <span className="text-xs font-mono font-semibold bg-stone-100 px-3 py-1 rounded-full text-stone-600">
                {pnl.revenue.invoiceCount} Bills Settled
              </span>
            </div>

            <div className="divide-y divide-stone-100 text-xs">
              {/* REVENUE SECTION */}
              <div className="py-2.5 flex items-center justify-between font-medium">
                <span className="text-stone-800 font-bold">1. Gross Restaurant Sales</span>
                <span className="font-mono text-stone-900 font-semibold">
                  ₹{pnl.revenue.grossRevenue.toFixed(2)}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between pl-4 text-stone-500">
                <span>Less: Promotional Discounts & Comp Vouchers</span>
                <span className="font-mono text-red-600 font-medium">
                  -₹{pnl.revenue.discounts.toFixed(2)}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between font-bold text-stone-900 bg-stone-50/50 px-2 rounded-lg">
                <span>Net Taxable Restaurant Revenue</span>
                <span className="font-mono text-sm">
                  ₹{pnl.revenue.taxableSales.toFixed(2)}
                </span>
              </div>

              {/* COGS SECTION */}
              <div className="py-2 flex items-center justify-between pl-4 text-stone-500">
                <span>Less: Cost of Raw Ingredients (Recipe-based COGS)</span>
                <span className="font-mono text-amber-700 font-medium">
                  -₹{pnl.costOfSales.cogs.toFixed(2)}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between pl-4 text-stone-500">
                <span>Less: Kitchen Wastage & Spoilage Loss</span>
                <span className="font-mono text-red-600 font-medium">
                  -₹{pnl.costOfSales.wastageCost.toFixed(2)}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between font-bold text-emerald-900 bg-emerald-50/60 px-2 rounded-lg">
                <span>Gross Profit (Net Revenue - COGS)</span>
                <span className="font-mono text-sm">
                  ₹{pnl.grossProfit.amount.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-emerald-700">({pnl.grossProfit.marginPercent}% Margin)</span>
                </span>
              </div>

              {/* OPERATING OVERHEADS */}
              <div className="py-2.5 font-bold text-stone-800 pt-3">
                <span>2. Operating Expenses (Overheads)</span>
              </div>

              {Object.entries(pnl.operatingExpenses.breakdown).map(([cat, amount]) => (
                <div key={cat} className="py-1.5 flex items-center justify-between pl-4 text-stone-600">
                  <span>{cat.replace('_', ' ')}</span>
                  <span className="font-mono text-stone-800">
                    ₹{Number(amount).toFixed(2)}
                  </span>
                </div>
              ))}

              <div className="py-2 flex items-center justify-between pl-2 font-semibold text-stone-700">
                <span>Total Operating Overhead Expenses</span>
                <span className="font-mono text-red-700">
                  -₹{pnl.operatingExpenses.totalOperatingExpenses.toFixed(2)}
                </span>
              </div>

              {/* NET PROFIT */}
              <div
                className={clsx(
                  'py-3 flex items-center justify-between font-bold text-sm px-3 rounded-xl mt-2',
                  pnl.netProfit.isProfitable
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-rose-600 text-white shadow-xs'
                )}
              >
                <span>NET OPERATING PROFIT</span>
                <span className="font-mono text-base">
                  ₹{pnl.netProfit.amount.toFixed(2)} ({pnl.netProfit.marginPercent}%)
                </span>
              </div>

              {/* GST MEMO */}
              <div className="py-2 flex items-center justify-between text-stone-400 text-[11px] pt-3">
                <span>Memo: 5% Restaurant GST Collected (Payable to Government)</span>
                <span className="font-mono font-semibold text-stone-600">
                  ₹{pnl.revenue.gstCollected.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Sales Distributions */}
      {breakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 Dishes */}
          <Card className="p-5 bg-white border border-stone-200/80">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-rollify-red" />
              Top 5 Best-Selling Dishes
            </h2>

            <div className="divide-y divide-stone-100 text-xs">
              {breakdown.topSellingDishes.map((dish, i) => (
                <div key={dish.item_id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-stone-900">{dish.item_name}</p>
                      <p className="text-[10px] text-stone-400">{dish.category_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-stone-900">
                      ₹{Number(dish.total_sales_volume).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">
                      {dish.total_quantity_sold} orders
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Revenue by Category */}
          <Card className="p-5 bg-white border border-stone-200/80">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-rollify-gold" />
              Sales Distribution by Category
            </h2>

            <div className="divide-y divide-stone-100 text-xs">
              {breakdown.byCategory.slice(0, 6).map((cat) => (
                <div key={cat.category_id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">{cat.category_name}</p>
                    <p className="text-[10px] text-stone-400 font-mono">{cat.units_sold} units sold</p>
                  </div>
                  <span className="font-bold font-mono text-stone-900">
                    ₹{Number(cat.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Sales by Order Channel */}
          <Card className="p-5 bg-white border border-stone-200/80">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              Orders by Dining Channel
            </h2>

            <div className="divide-y divide-stone-100 text-xs">
              {breakdown.byOrderType.map((channel) => (
                <div key={channel.order_type} className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-stone-900">{channel.order_type.replace('_', ' ')}</span>
                  <div className="text-right">
                    <span className="font-bold font-mono text-stone-900">
                      ₹{Number(channel.total_sales).toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[10px] text-stone-400 font-mono">
                      {channel.order_count} tickets
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Payment Methods Breakdown */}
          <Card className="p-5 bg-white border border-stone-200/80">
            <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Payment Tender Channels
            </h2>

            <div className="divide-y divide-stone-100 text-xs">
              {breakdown.byPaymentMethod.map((pm) => (
                <div key={pm.payment_method} className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-stone-900">{pm.payment_method}</span>
                  <div className="text-right">
                    <span className="font-bold font-mono text-stone-900">
                      ₹{Number(pm.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[10px] text-stone-400 font-mono">
                      {pm.transaction_count} payments
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
