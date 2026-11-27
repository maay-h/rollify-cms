import React from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Printer, Download, CheckCircle2 } from 'lucide-react';

export interface BillDetail {
  id: string;
  bill_number: string;
  order_number: string;
  order_type: string;
  table_number?: string;
  table_section?: string;
  customer_name?: string;
  customer_phone?: string;
  order_notes?: string;
  gross_amount: string | number;
  discount_amount: string | number;
  discount_reason?: string;
  taxable_amount: string | number;
  tax_amount: string | number;
  net_amount: string | number;
  paid_amount: string | number;
  balance_due: number;
  payment_status: string;
  cashier_name?: string;
  created_at: string;
  items: Array<{
    id: string;
    item_name: string;
    variant_name?: string;
    quantity: number;
    unit_price: string | number;
    subtotal: string | number;
  }>;
  payments: Array<{
    id: string;
    amount: string | number;
    payment_method: string;
    transaction_reference?: string;
    status: string;
    created_at: string;
  }>;
}

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: BillDetail | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, bill }) => {
  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  const isTakeaway = bill.order_type === 'TAKEAWAY' || bill.order_type === 'DELIVERY';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" title="Tax Invoice & Receipt">
      <div className="space-y-4">
        {/* Printable Thermal Receipt Canvas (80mm width standard) */}
        <div
          id="printable-receipt"
          className="bg-white p-5 border border-stone-300 rounded-2xl font-mono text-xs text-stone-900 shadow-xs max-w-[340px] mx-auto select-none print:m-0 print:p-0 print:border-none print:shadow-none"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-stone-300">
            <h2 className="text-lg font-black tracking-tight uppercase font-sans text-stone-950">
              POS
            </h2>
            <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider font-sans">
              Cloud POS Terminal
            </p>
            <p className="text-[9px] text-stone-500 mt-1">
              For Online Orders: 98455 71817 | 96116 39964
            </p>
            <p className="text-[9px] text-stone-500 font-sans">
              GSTIN: 29AABCR8841Z1ZK
            </p>
          </div>

          {/* Meta Details */}
          <div className="py-2.5 border-b border-dashed border-stone-300 text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">INVOICE:</span>
              <span className="font-bold">{bill.bill_number}</span>
            </div>
            <div className="flex justify-between">
              <span>ORDER:</span>
              <span>{bill.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span>TABLE/TYPE:</span>
              <span className="font-bold">
                {bill.table_number ? `TABLE ${bill.table_number}` : bill.order_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span>DATE:</span>
              <span>{new Date(bill.created_at).toLocaleString()}</span>
            </div>
            {bill.cashier_name && (
              <div className="flex justify-between">
                <span>CASHIER:</span>
                <span>{bill.cashier_name}</span>
              </div>
            )}
            {bill.customer_name && (
              <div className="flex justify-between">
                <span>GUEST:</span>
                <span>{bill.customer_name}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b-2 border-dashed border-stone-300">
            <div className="flex justify-between font-bold text-[10px] uppercase text-stone-600 pb-1.5 border-b border-stone-200">
              <span>ITEM</span>
              <span>QTY × RATE</span>
              <span>AMT</span>
            </div>
            <div className="divide-y divide-stone-100 py-1">
              {bill.items.map((it) => (
                <div key={it.id} className="py-1 text-[11px]">
                  <div className="flex justify-between font-bold text-stone-900">
                    <span className="leading-tight">
                      {it.item_name}
                      {it.variant_name && it.variant_name !== 'Single' && (
                        <span className="text-[9px] text-stone-500 ml-1">({it.variant_name})</span>
                      )}
                    </span>
                    <span>₹{Number(it.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {it.quantity} × ₹{Number(it.unit_price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Tax Calculation Breakdown */}
          <div className="py-2.5 border-b-2 border-dashed border-stone-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Gross Subtotal:</span>
              <span>₹{Number(bill.gross_amount).toFixed(2)}</span>
            </div>

            {Number(bill.discount_amount) > 0 && (
              <div className="flex justify-between text-stone-700">
                <span>Discount ({bill.discount_reason || 'Promo'}):</span>
                <span>-₹{Number(bill.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-stone-600">
              <span>Taxable Value:</span>
              <span>₹{Number(bill.taxable_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>GST (5% Restaurant):</span>
              <span>₹{Number(bill.tax_amount).toFixed(2)}</span>
            </div>

            {isTakeaway && (
              <div className="flex justify-between text-stone-600">
                <span>Parcel Charges:</span>
                <span>₹10.00</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-stone-950 pt-2 border-t border-dashed border-stone-300">
              <span>NET TOTAL:</span>
              <span>₹{Number(bill.net_amount).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="py-2.5 border-b-2 border-dashed border-stone-300 space-y-1 text-[11px]">
            <span className="font-bold uppercase text-[10px] text-stone-500 block">Payment Settlement</span>
            {bill.payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>
                  {p.payment_method}
                  {p.transaction_reference && (
                    <span className="text-[9px] text-stone-400 ml-1">({p.transaction_reference})</span>
                  )}
                </span>
                <span className="font-bold">₹{Number(p.amount).toFixed(2)}</span>
              </div>
            ))}

            {bill.balance_due > 0 ? (
              <div className="flex justify-between font-bold text-rose-600 pt-1">
                <span>BALANCE DUE:</span>
                <span>₹{bill.balance_due.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between font-bold text-emerald-700 pt-1">
                <span>STATUS:</span>
                <span className="uppercase">PAID IN FULL ✓</span>
              </div>
            )}
          </div>

          {/* Footer Tagline */}
          <div className="text-center pt-3 text-[10px] text-stone-500 space-y-1">
            <p className="font-bold text-stone-800">
              “Thank you for dining with us!”
            </p>
            <p>We appreciate your visit.</p>
            <p className="text-[8px] text-stone-400">Powered by Cloud POS</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" />}>
            Print Thermal Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
};
