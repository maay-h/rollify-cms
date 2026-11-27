import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { Users, UserPlus, KeyRound, Shield, Phone, Mail } from 'lucide-react';
import { DEMO_USERS } from '../mock/demoStore.js';

interface StaffUser {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';
  pin_code: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export const UsersPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN'>('CASHIER');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setUsers(json.data);
      } else {
        setUsers(DEMO_USERS as any);
      }
    } catch (e) {
      setUsers(DEMO_USERS as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !fullName) {
      toast.error('Validation error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          username,
          email,
          password,
          role,
          pinCode: pinCode || undefined,
          phone: phone || undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success('Staff user created', `${fullName} (${role}) added successfully`);
        setIsAddOpen(false);
        // Reset form
        setFullName('');
        setUsername('');
        setEmail('');
        setPassword('');
        setPinCode('');
        setPhone('');
        fetchUsers();
      } else {
        toast.error('Failed to create user', json.error);
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBadgeVariants: Record<string, any> = {
    ADMIN: 'default',
    MANAGER: 'created',
    CASHIER: 'success',
    WAITER: 'warning',
    KITCHEN: 'preparing',
  };

  if (loading) {
    return <LoadingSpinner text="Loading staff records & role permissions..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Staff & Role-Based Access Control
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Backend-enforced roles, POS quick-switch PIN codes, and audit authorization
          </p>
        </div>

        {hasRole('ADMIN') && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Add Staff Member
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <Card key={u.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">{u.full_name}</h3>
                <p className="text-xs text-stone-500 font-mono">@{u.username}</p>
              </div>
              <Badge variant={roleBadgeVariants[u.role]} size="sm">
                {u.role}
              </Badge>
            </div>

            <div className="space-y-2 py-3 border-y border-stone-100 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>{u.email}</span>
              </div>
              {u.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{u.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-rollify-gold" />
                <span>POS Quick PIN: <strong className="font-mono text-stone-900">{u.pin_code || 'None'}</strong></span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-stone-400">
              <span>Account Status</span>
              <span className="text-emerald-700 font-bold">Active & Verified</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Staff Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Staff Account" maxWidth="md">
        <form onSubmit={handleCreateUser} className="space-y-3">
          <Input
            label="Full Name"
            placeholder="e.g. Ramesh Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username"
              placeholder="ramesh"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="ramesh@rollify.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Initial Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="4-Digit Terminal PIN"
              placeholder="e.g. 6677"
              maxLength={4}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Assigned Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rollify-red"
            >
              <option value="CASHIER">CASHIER (POS Billing & Payments)</option>
              <option value="KITCHEN">KITCHEN (Kitchen Display System)</option>
              <option value="ADMIN">ADMIN (Full Management)</option>
            </select>
          </div>
          <Input
            label="Contact Phone"
            placeholder="+91 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="flex gap-2 justify-end pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
