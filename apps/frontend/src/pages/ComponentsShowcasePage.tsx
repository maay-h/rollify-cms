import React, { useState } from 'react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Card } from '../components/ui/Card.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { 
  Plus, 
  Trash2, 
  Check, 
  Search, 
  DollarSign, 
  AlertCircle, 
  Sparkles, 
  Coffee, 
  ShieldAlert,
  Bell
} from 'lucide-react';

export const ComponentsShowcasePage: React.FC = () => {
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmVariant, setConfirmVariant] = useState<'danger' | 'warning' | 'primary'>('danger');
  const [btnLoading, setBtnLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const triggerTestConfirm = (variant: 'danger' | 'warning' | 'primary') => {
    setConfirmVariant(variant);
    setIsConfirmOpen(true);
  };

  const handleAsyncAction = () => {
    setBtnLoading(true);
    setTimeout(() => {
      setBtnLoading(false);
      toast.success('Action Completed', 'Simulation of backend processing finished');
    }, 1500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-rollify-gold-700" />
          <span>Rollify Design System Showcase</span>
        </div>
        <h1 className="text-3xl font-black text-stone-900 tracking-tight">
          Shared Reusable UI Components
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Interactive test sandbox verifying brand colors, typography, touch targets, and accessibility.
        </p>
      </div>

      {/* 1. Brand Color System */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          1. Brand Palette & Color Tokens
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-rollify-red text-white">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Primary Red</p>
            <p className="text-lg font-black mt-1">#C8102E</p>
            <p className="text-[11px] opacity-75 mt-2">Brand core accent, main CTAs</p>
          </div>
          <div className="p-4 rounded-2xl bg-rollify-gold text-rollify-charcoal">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Brand Gold</p>
            <p className="text-lg font-black mt-1">#F59E0B</p>
            <p className="text-[11px] opacity-75 mt-2">Warm accents, highlights, badges</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-stone-200 text-stone-900">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Soft Cream</p>
            <p className="text-lg font-black mt-1">#FFFDF9</p>
            <p className="text-[11px] text-stone-500 mt-2">App canvas & card surfaces</p>
          </div>
          <div className="p-4 rounded-2xl bg-rollify-charcoal text-white">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Charcoal Dark</p>
            <p className="text-lg font-black mt-1">#18181B</p>
            <p className="text-[11px] opacity-75 mt-2">High contrast typography</p>
          </div>
        </div>
      </Card>

      {/* 2. Buttons */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          2. Button Variants & States
        </h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Red</Button>
            <Button variant="gold">Brand Gold</Button>
            <Button variant="charcoal">Charcoal Slate</Button>
            <Button variant="outline">Outline Border</Button>
            <Button variant="ghost">Ghost Plain</Button>
            <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>
              Destructive Danger
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button size="sm" variant="primary">Small (sm)</Button>
            <Button size="md" variant="primary">Medium (md)</Button>
            <Button size="lg" variant="primary">Large Touch POS (lg)</Button>
            <Button
              variant="primary"
              isLoading={btnLoading}
              onClick={handleAsyncAction}
            >
              Test Loading State
            </Button>
            <Button variant="primary" disabled>Disabled State</Button>
          </div>
        </div>
      </Card>

      {/* 3. Order Lifecycle Status Badges */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          3. Complete Order Lifecycle Badges
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="created" dot>CREATED</Badge>
          <Badge variant="kitchen" dot>SENT TO KITCHEN</Badge>
          <Badge variant="preparing" dot>PREPARING</Badge>
          <Badge variant="ready" dot>READY</Badge>
          <Badge variant="served" dot>SERVED</Badge>
          <Badge variant="completed" dot>COMPLETED</Badge>
          <Badge variant="paid" dot>PAID</Badge>
          <Badge variant="cancelled" dot>CANCELLED</Badge>
          <Badge variant="warning" dot>LOW STOCK ALERT</Badge>
          <Badge variant="danger" dot>PAYMENT FAILED</Badge>
        </div>
      </Card>

      {/* 4. Form Inputs */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          4. Form Inputs & Validation States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Normal Input"
            placeholder="Customer Name..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            helperText="Enter primary contact name"
          />
          <Input
            label="Input with Left Icon"
            placeholder="Search products..."
            leftIcon={<Search className="w-4 h-4" />}
          />
          <Input
            label="Input with Error State"
            placeholder="GSTIN Number"
            defaultValue="INVALID_GST_FORMAT"
            error="Please enter a valid 15-character GSTIN"
          />
        </div>
      </Card>

      {/* 5. Confirmation Dialogs & Modals */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          5. Modal & Financial Confirmation Dialogs
        </h2>
        <p className="text-xs text-stone-600 mb-4">
          Strict confirmation controls prevent accidental cancellations, bill voids, or unverified refunds.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            onClick={() => triggerTestConfirm('danger')}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Cancel Order (Destructive)
          </Button>
          <Button
            variant="gold"
            onClick={() => triggerTestConfirm('warning')}
            leftIcon={<ShieldAlert className="w-4 h-4" />}
          >
            Refund Payment (Warning)
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsModalOpen(true)}
          >
            Open Standard Modal
          </Button>
        </div>
      </Card>

      {/* 6. Real-Time Toast Notifications */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          6. Real-Time Notification Toasts
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            onClick={() => toast.success('Order Marked Ready!', 'Table T-02 is ready for pickup by waiter Rahul')}
          >
            Trigger Success Toast
          </Button>
          <Button
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-50"
            onClick={() => toast.warning('Low Ingredient Alert', 'Boneless Chicken has dropped below 5.0 kg minimum threshold')}
          >
            Trigger Warning Toast
          </Button>
          <Button
            variant="outline"
            className="border-rose-300 text-rose-800 hover:bg-rose-50"
            onClick={() => toast.error('Payment Gateway Timeout', 'UPI intent timed out on customer device')}
          >
            Trigger Error Toast
          </Button>
          <Button
            variant="outline"
            className="border-blue-300 text-blue-800 hover:bg-blue-50"
            onClick={() => toast.info('New QR Order Received', 'Customer at Table T-05 placed an order for 2 Frankie Rolls')}
          >
            Trigger Info Toast
          </Button>
        </div>
      </Card>

      {/* 7. Loading, Skeleton, and Empty States */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-stone-900 mb-4 pb-2 border-b border-stone-100">
          7. Loading Skeletons & Empty States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 bg-stone-50 rounded-2xl border border-stone-200/60">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Skeleton Placeholder</p>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <EmptyState
            title="No Active Orders in Queue"
            description="All orders have been prepared and served. New customer QR or Waiter tickets will appear here automatically."
            actionLabel="Create Walk-in Order"
            onAction={() => toast.info('New Order Action Triggered')}
          />
        </div>
      </Card>

      {/* Demo Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Sample Information Dialog">
        <p className="text-sm text-stone-600 mb-4 leading-relaxed">
          This is a sample reusable modal component configured with clean backdrop blur, keyboard ESC dismissal, and responsive auto-sizing for tablets and POS touchscreens.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          toast.success('Confirmed', 'Operation confirmed and logged in audit ledger');
        }}
        title={confirmVariant === 'danger' ? 'Cancel Order #ROL-0042?' : 'Process Customer Refund?'}
        message={
          confirmVariant === 'danger'
            ? 'Cancelling this order will automatically record a stock reversal in the inventory ledger and notify the kitchen display.'
            : 'Processing this refund requires manager authorization and will generate an immutable adjustment credit note.'
        }
        variant={confirmVariant}
        confirmText={confirmVariant === 'danger' ? 'Yes, Cancel Order' : 'Yes, Issue Refund'}
      />
    </div>
  );
};
