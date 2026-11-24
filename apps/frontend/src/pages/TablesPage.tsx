import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { Modal } from '../components/ui/Modal.js';
import { 
  UtensilsCrossed, 
  Users, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  Printer,
  ExternalLink,
  Copy,
  Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import { DEMO_TABLES } from '../mock/demoStore.js';

interface DiningTable {
  id: string;
  table_number: string;
  section: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY';
  current_order_id?: string;
  qr_token: string;
  order_number?: string;
  order_status?: string;
  order_total?: string;
}

export const TablesPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [targetTable, setTargetTable] = useState<DiningTable | null>(null);
  const [newStatus, setNewStatus] = useState<DiningTable['status']>('AVAILABLE');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [qrModalTable, setQrModalTable] = useState<DiningTable | null>(null);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setTables(json.data);
      } else {
        setTables(DEMO_TABLES as any);
      }
    } catch (err) {
      setTables(DEMO_TABLES as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [token]);

  const handleStatusChangeClick = (table: DiningTable, status: DiningTable['status']) => {
    setTargetTable(table);
    setNewStatus(status);

    // If changing from occupied to available, prompt confirmation to ensure no unbilled order is lost
    if (table.status === 'OCCUPIED' && status === 'AVAILABLE') {
      setIsConfirmOpen(true);
    } else {
      executeStatusUpdate(table.id, status);
    }
  };

  const executeStatusUpdate = async (tableId: string, status: DiningTable['status']) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Table updated to ${status}`);
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, status } : t))
        );
      } else {
        toast.error('Update failed', json.error);
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
    } finally {
      setIsUpdating(false);
      setIsConfirmOpen(false);
      setTargetTable(null);
    }
  };

  const sections = ['ALL', ...Array.from(new Set(tables.map((t) => t.section)))];

  const filteredTables = selectedSection === 'ALL'
    ? tables
    : tables.filter((t) => t.section === selectedSection);

  const statusColors = {
    AVAILABLE: 'border-emerald-200 bg-emerald-50/40 text-emerald-900',
    OCCUPIED: 'border-amber-300 bg-amber-50/50 text-amber-900',
    RESERVED: 'border-blue-200 bg-blue-50/40 text-blue-900',
    DIRTY: 'border-rose-200 bg-rose-50/40 text-rose-900',
  };

  const statusBadgeVariants: Record<DiningTable['status'], any> = {
    AVAILABLE: 'success',
    OCCUPIED: 'warning',
    RESERVED: 'created',
    DIRTY: 'danger',
  };

  if (loading) {
    return <LoadingSpinner text="Loading restaurant dining floor plan..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Dining Tables & Floor Plan
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Real-time table occupancy, seating capacity and digital QR identifiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTables} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Section Filters */}
      <div className="flex flex-wrap gap-2">
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setSelectedSection(sec)}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all',
              selectedSection === sec
                ? 'bg-rollify-red text-white shadow-sm'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <Card
            key={table.id}
            className={clsx(
              'p-5 border-2 transition-all duration-200',
              statusColors[table.status]
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  {table.section}
                </span>
                <h3 className="text-xl font-black text-stone-900 mt-0.5">
                  {table.table_number}
                </h3>
              </div>
              <Badge variant={statusBadgeVariants[table.status]} size="sm" dot>
                {table.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-y border-stone-200/40 text-xs text-stone-600 font-medium">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                {table.capacity} Guests
              </span>
              <button
                type="button"
                onClick={() => setQrModalTable(table)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF7F2] text-[#2D1810] hover:bg-stone-200 border border-stone-200 font-mono text-[10px] font-bold transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-[#EA580C]" />
                View QR Tent Card
              </button>
            </div>

            {/* Quick Status Action Buttons */}
            <div className="mt-4 pt-1">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                Update Status
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {table.status !== 'AVAILABLE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1 h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => handleStatusChangeClick(table, 'AVAILABLE')}
                  >
                    Available
                  </Button>
                )}
                {table.status !== 'OCCUPIED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1 h-7 border-amber-300 text-amber-800 hover:bg-amber-50"
                    onClick={() => handleStatusChangeClick(table, 'OCCUPIED')}
                  >
                    Occupied
                  </Button>
                )}
                {table.status !== 'RESERVED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1 h-7 border-blue-300 text-blue-800 hover:bg-blue-50"
                    onClick={() => handleStatusChangeClick(table, 'RESERVED')}
                  >
                    Reserved
                  </Button>
                )}
                {table.status !== 'DIRTY' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1 h-7 border-rose-300 text-rose-800 hover:bg-rose-50"
                    onClick={() => handleStatusChangeClick(table, 'DIRTY')}
                  >
                    Needs Bus/Clean
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Confirmation Dialog for Table Clearing */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          if (targetTable) {
            executeStatusUpdate(targetTable.id, newStatus);
          }
        }}
        title="Clear Table Occupancy?"
        message={
          <>
            Are you sure you want to mark table <strong>{targetTable?.table_number}</strong> as available?
            Please confirm that any active bills or diners have completed payment.
          </>
        }
        confirmText="Yes, Mark Available"
        cancelText="Keep Occupied"
        variant="warning"
        isLoading={isUpdating}
      />

      {/* Printable QR Tent Card Modal */}
      {qrModalTable && (
        <Modal
          isOpen={!!qrModalTable}
          onClose={() => setQrModalTable(null)}
          title={`Table ${qrModalTable.table_number} Digital Ordering QR`}
          maxWidth="md"
        >
          {(() => {
            const tableUrl = `${window.location.origin}/table/${encodeURIComponent(qrModalTable.qr_token)}`;
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(tableUrl)}`;

            return (
              <div className="space-y-4">
                {/* Physical Tent Card Mockup / Print View */}
                <div
                  id="printable-tent-card"
                  className="bg-white border-2 border-[#2D1810] rounded-3xl p-6 text-center shadow-lg relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-[#2D1810] via-[#EA580C] to-[#2D1810]" />

                  {/* Brand Header */}
                  <div className="flex items-center justify-center gap-2 mb-2 mt-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2D1810] text-[#EA580C] flex items-center justify-center font-black text-sm">
                      R
                    </div>
                    <span className="text-base font-black tracking-tight text-[#2D1810]">
                      ROLLIFY CAFE
                    </span>
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-widest text-[#EA580C] bg-[#FFF7ED] px-3 py-0.5 rounded-full border border-orange-200">
                    {qrModalTable.section}
                  </span>

                  <h2 className="text-3xl font-black text-[#2D1810] mt-2 mb-1 tracking-tight">
                    TABLE {qrModalTable.table_number}
                  </h2>
                  <p className="text-xs text-stone-500 font-medium max-w-xs mx-auto mb-4">
                    Scan with your phone camera to order directly from this table & join Craving Club.
                  </p>

                  {/* High Quality QR Canvas */}
                  <div className="w-48 h-48 mx-auto p-3 bg-white rounded-2xl border-2 border-stone-200 shadow-sm flex items-center justify-center">
                    <img
                      src={qrImgUrl}
                      alt={`Table ${qrModalTable.table_number} QR Code`}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Loyalty Perks Inside */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-around text-[10px] font-bold text-stone-600">
                    <span className="flex items-center gap-1 text-[#EA580C]">
                      <Sparkles className="w-3 h-3" /> Earn on Every Craving
                    </span>
                    <span className="text-stone-300">·</span>
                    <span>🎂 Birthday Month Treat</span>
                    <span className="text-stone-300">·</span>
                    <span>🎁 Friend Referrals</span>
                  </div>
                </div>

                {/* Direct Link and Actions */}
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between text-xs font-mono">
                  <span className="truncate max-w-[260px] text-stone-600">{tableUrl}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tableUrl);
                      toast.success('Link Copied', 'Table QR URL copied to clipboard');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-stone-200 font-sans font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer shrink-0 ml-2 shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>

                {/* Print & Test Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    leftIcon={<ExternalLink className="w-4 h-4" />}
                    onClick={() => window.open(tableUrl, '_blank')}
                  >
                    Open Live Customer Menu
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 bg-[#2D1810] hover:bg-stone-800 text-white"
                    leftIcon={<Printer className="w-4 h-4 text-[#EA580C]" />}
                    onClick={() => {
                      window.print();
                    }}
                  >
                    Print Acrylic Tent Card
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
