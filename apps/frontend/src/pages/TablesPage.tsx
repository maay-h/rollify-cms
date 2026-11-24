import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  UtensilsCrossed, 
  Users, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw 
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

            <div className="flex items-center gap-4 py-2 border-y border-stone-200/40 text-xs text-stone-600 font-medium">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                {table.capacity} Guests
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <QrCode className="w-3.5 h-3.5 text-stone-400" />
                {table.qr_token.slice(0, 10)}...
              </span>
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
    </div>
  );
};
