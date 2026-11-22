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
  Clock, 
  Users, 
  Play, 
  Square, 
  DollarSign, 
  Calendar, 
  Award, 
  SlidersHorizontal,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShiftItem {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  role: string;
  shift_date: string;
  clock_in: string;
  clock_out?: string;
  total_hours: string | number;
  hourly_rate: string | number;
  shift_wage: string | number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

interface PayrollStaffSummary {
  user_id: string;
  full_name: string;
  username: string;
  role: string;
  hourly_rate: string | number;
  monthly_salary: string | number;
  total_shifts: number;
  total_hours_worked: string | number;
  total_accumulated_wage: string | number;
}

export const StaffShiftsPage: React.FC = () => {
  const { user, token, hasRole } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'shifts' | 'payroll'>('shifts');
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [payroll, setPayroll] = useState<PayrollStaffSummary[]>([]);
  const [payrollSummary, setPayrollSummary] = useState({
    totalStaff: 0,
    grandTotalHours: 0,
    grandTotalWages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [myActiveShift, setMyActiveShift] = useState<ShiftItem | null>(null);

  // Modals
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftItem | null>(null);
  const [adjustHours, setAdjustHours] = useState('');
  const [adjustRate, setAdjustRate] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  const [clockInNotes, setClockInNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/shifts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setShifts(json.data);
        const myActive = json.data.find(
          (s: ShiftItem) => s.user_id === user?.id && s.status === 'ACTIVE'
        );
        setMyActiveShift(myActive || null);
      }
    } catch (e) {
      toast.error('Failed to load shift records');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayroll = async () => {
    try {
      const res = await fetch('/api/shifts/payroll-summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setPayroll(json.data);
        if (json.summary) setPayrollSummary(json.summary);
      }
    } catch (e) {
      toast.error('Failed to load payroll summary');
    }
  };

  useEffect(() => {
    fetchShifts();
    if (hasRole('ADMIN', 'MANAGER')) {
      fetchPayroll();
    }
  }, []);

  const handleClockIn = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/shifts/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: clockInNotes || 'On-duty shift' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Clocked in successfully!`);
        setClockInNotes('');
        fetchShifts();
      } else {
        toast.error(json.error || 'Clock in failed');
      }
    } catch (err) {
      toast.error('Network error during clock in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/shifts/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchShifts();
        if (hasRole('ADMIN', 'MANAGER')) fetchPayroll();
      } else {
        toast.error(json.error || 'Clock out failed');
      }
    } catch (err) {
      toast.error('Network error during clock out');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;
    const hours = parseFloat(adjustHours);
    const rate = parseFloat(adjustRate);

    if (isNaN(hours) || hours < 0 || isNaN(rate) || rate < 0) {
      toast.error('Invalid hours or rate');
      return;
    }
    if (!adjustNotes.trim()) {
      toast.error('Adjustment reason is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/shifts/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          totalHours: hours,
          hourlyRate: rate,
          notes: adjustNotes.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setIsAdjustOpen(false);
        fetchShifts();
        fetchPayroll();
      } else {
        toast.error(json.error || 'Adjustment failed');
      }
    } catch (err) {
      toast.error('Network error adjusting shift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rollify-red-50 text-rollify-red rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Staff Shifts & Payroll</h1>
              <p className="text-xs text-stone-500">
                Shift attendance logging, live duty clock-in, duration calculations, and payroll hours
              </p>
            </div>
          </div>
        </div>

        {/* Quick Duty Control Pill */}
        <div className="flex items-center gap-3 bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                'w-3 h-3 rounded-full',
                myActiveShift ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
              )}
            />
            <span className="text-xs font-semibold text-stone-700">
              {myActiveShift ? 'On Duty' : 'Off Duty'}
            </span>
          </div>

          {myActiveShift ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
              onClick={handleClockOut}
              isLoading={submitting}
            >
              Clock Out
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={handleClockIn}
              isLoading={submitting}
            >
              Clock In
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards (for Managers) */}
      {hasRole('ADMIN', 'MANAGER') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-white border border-stone-200/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total Staff Team</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{payrollSummary.totalStaff}</p>
              </div>
              <div className="p-3 bg-stone-100 rounded-xl text-stone-700">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mt-2">Active floor captains, chefs, and cashiers</p>
          </Card>

          <Card className="p-4 bg-white border border-stone-200/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Hours Worked This Month</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{payrollSummary.grandTotalHours} hrs</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mt-2">Combined floor and kitchen shifts</p>
          </Card>

          <Card className="p-4 bg-white border border-stone-200/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Accumulated Shift Wages</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">₹{payrollSummary.grandTotalWages.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mt-2">Hourly shift wages accrued this month</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab('shifts')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'shifts'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <Clock className="w-4 h-4" />
          Shift Logs ({shifts.length})
        </button>

        {hasRole('ADMIN', 'MANAGER') && (
          <button
            onClick={() => setActiveTab('payroll')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
              activeTab === 'payroll'
                ? 'bg-rollify-red text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            )}
          >
            <Award className="w-4 h-4" />
            Payroll & Hours Summary ({payroll.length})
          </button>
        )}
      </div>

      {/* TAB 1: SHIFTS */}
      {activeTab === 'shifts' && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Floor & Kitchen Shift Attendance</h2>
              <p className="text-xs text-stone-400">Live check-in times, shift durations and wage accruals</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchShifts}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading shifts..." />
            </div>
          ) : shifts.length === 0 ? (
            <EmptyState
              title="No shift records"
              description="No staff shifts have been logged today."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Clock In</th>
                    <th className="py-3 px-3">Clock Out</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Hourly Rate</th>
                    <th className="py-3 px-3">Shift Wage</th>
                    <th className="py-3 px-3">Status</th>
                    {hasRole('ADMIN', 'MANAGER') && <th className="py-3 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {shifts.map((s) => {
                    const isActive = s.status === 'ACTIVE';
                    return (
                      <tr key={s.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-stone-900">
                          {s.full_name}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-700 font-semibold text-[10px]">
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-stone-500 text-[11px]">
                          {s.shift_date}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-stone-700 text-[11px]">
                          {new Date(s.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-stone-700 text-[11px]">
                          {s.clock_out
                            ? new Date(s.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-stone-900">
                          {isActive ? (
                            <span className="text-amber-700">In Progress</span>
                          ) : (
                            `${Number(s.total_hours).toFixed(2)} hrs`
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-stone-500 text-[11px]">
                          ₹{Number(s.hourly_rate).toFixed(2)}/hr
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-emerald-800">
                          ₹{Number(s.shift_wage).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3">
                          <Badge variant={isActive ? 'preparing' : 'success'}>
                            {isActive ? 'Active Duty' : 'Completed'}
                          </Badge>
                        </td>
                        {hasRole('ADMIN', 'MANAGER') && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedShift(s);
                                setAdjustHours(String(s.total_hours));
                                setAdjustRate(String(s.hourly_rate));
                                setIsAdjustOpen(true);
                              }}
                              className="px-2.5 py-1 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Adjust</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: PAYROLL SUMMARY */}
      {activeTab === 'payroll' && hasRole('ADMIN', 'MANAGER') && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Monthly Payroll & Hours Breakdown</h2>
              <p className="text-xs text-stone-400">Total shifts, cumulative hours, base salaries and calculated hourly payouts</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchPayroll}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Total Shifts</th>
                  <th className="py-3 px-3">Hours Worked</th>
                  <th className="py-3 px-3">Hourly Rate</th>
                  <th className="py-3 px-3">Accumulated Shift Wages</th>
                  <th className="py-3 px-4 text-right">Base Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {payroll.map((p) => (
                  <tr key={p.user_id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      <div>
                        <span>{p.full_name}</span>
                        <span className="block text-[10px] text-stone-400">@{p.username}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-700 font-semibold text-[10px]">
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-stone-800 font-mono font-bold">
                      {p.total_shifts} shifts
                    </td>
                    <td className="py-3.5 px-3 text-stone-800 font-mono font-bold">
                      {Number(p.total_hours_worked).toFixed(2)} hrs
                    </td>
                    <td className="py-3.5 px-3 text-stone-500 font-mono">
                      ₹{Number(p.hourly_rate).toFixed(2)}/hr
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-800">
                      ₹{Number(p.total_accumulated_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-stone-700 font-semibold">
                      ₹{Number(p.monthly_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: ADJUST SHIFT */}
      <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title="Manager Shift Adjustment">
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <p className="text-xs text-stone-500">
            Adjusting shift records for <strong className="text-stone-900">{selectedShift?.full_name}</strong> on {selectedShift?.shift_date}
          </p>

          <Input
            label="Total Hours"
            type="number"
            step="any"
            value={adjustHours}
            onChange={(e) => setAdjustHours(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Hourly Rate (₹)"
            type="number"
            step="any"
            value={adjustRate}
            onChange={(e) => setAdjustRate(e.target.value)}
            required
          />

          {adjustHours && adjustRate && (
            <div className="p-3 bg-stone-50 rounded-xl text-xs font-medium">
              Calculated Shift Wage:{' '}
              <strong className="text-emerald-800 font-bold font-mono">
                ₹{(parseFloat(adjustHours) * parseFloat(adjustRate)).toFixed(2)}
              </strong>
            </div>
          )}

          <Input
            label="Adjustment Reason"
            placeholder="e.g. Overtime approved by floor manager"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Apply Shift Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
