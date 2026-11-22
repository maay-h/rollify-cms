import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext.js';
import { RollifyLogo } from '../components/common/RollifyLogo.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { KeyRound, Lock, User as UserIcon, Delete, ArrowRight, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

export const LoginPage: React.FC = () => {
  const { login, pinLogin, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    const res = await login(identifier, password);
    setIsLoading(false);

    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Authentication failed');
    }
  };

  const handlePinDigit = async (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      setIsLoading(true);
      const res = await pinLogin(newPin);
      setIsLoading(false);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.error || 'Invalid PIN code');
        setPin('');
      }
    }
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleQuickStaffLogin = async (role: UserRole, staffPin: string, staffUser: string) => {
    setError('');
    setIsLoading(true);
    const res = await pinLogin(staffPin);
    setIsLoading(false);
    if (res.success) {
      navigate('/dashboard');
    } else {
      // Fallback to password login
      const pRes = await login(staffUser, `${staffUser}123`);
      if (pRes.success) {
        navigate('/dashboard');
      } else {
        setError(pRes.error || 'Quick staff sign-in failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-rollify-red flex flex-col justify-between relative overflow-hidden">
      {/* Decorative Gold & Cream background waves matching Rollify branding */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none opacity-90">
        <svg viewBox="0 0 1440 320" fill="none" className="w-full h-auto">
          <path
            d="M0,192L48,181.3C96,171,192,149,288,160C384,171,480,213,576,218.7C672,224,768,192,864,165.3C960,139,1056,117,1152,128C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            fill="#F59E0B"
          />
          <path
            d="M0,256L48,245.3C96,235,192,213,288,213.3C384,213,480,235,576,250.7C672,267,768,277,864,261.3C960,245,1056,203,1152,192C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            fill="#FFFDF9"
          />
        </svg>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200/80 p-6 sm:p-8">
          {/* Logo Header */}
          <div className="flex flex-col items-center mb-6">
            <RollifyLogo size="lg" />
            <p className="text-xs text-stone-500 mt-3 font-medium text-center">
              Cafe POS & Cloud Management Terminal
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-stone-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('pin'); setError(''); }}
              className={clsx(
                'flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5',
                mode === 'pin' ? 'bg-white text-rollify-charcoal shadow-sm' : 'text-stone-500 hover:text-stone-800'
              )}
            >
              <KeyRound className="w-3.5 h-3.5 text-rollify-gold" />
              Quick PIN Pad
            </button>
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); }}
              className={clsx(
                'flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5',
                mode === 'password' ? 'bg-white text-rollify-charcoal shadow-sm' : 'text-stone-500 hover:text-stone-800'
              )}
            >
              <Lock className="w-3.5 h-3.5 text-rollify-red" />
              Password Login
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium text-center animate-shake">
              {error}
            </div>
          )}

          {/* Mode: Quick PIN Pad */}
          {mode === 'pin' && (
            <div>
              {/* PIN display dots */}
              <div className="flex justify-center items-center gap-4 py-4 mb-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      'w-4 h-4 rounded-full border-2 transition-all duration-150',
                      pin.length > idx
                        ? 'bg-rollify-red border-rollify-red scale-110'
                        : 'border-stone-300 bg-stone-50'
                    )}
                  />
                ))}
              </div>

              {/* Number Pad Grid */}
              <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    disabled={isLoading}
                    className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 text-stone-900 font-bold text-xl border border-stone-200/80 transition-all flex items-center justify-center active:scale-95 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  disabled={isLoading || pin.length === 0}
                  className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 text-stone-500 font-bold text-xs uppercase tracking-wider border border-stone-200/80 transition flex items-center justify-center"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  disabled={isLoading}
                  className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 text-stone-900 font-bold text-xl border border-stone-200/80 transition flex items-center justify-center active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinDelete}
                  disabled={isLoading || pin.length === 0}
                  className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80 transition flex items-center justify-center active:scale-95 disabled:opacity-50"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Mode: Standard Username / Password */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 mb-6">
              <Input
                label="Username or Email"
                placeholder="admin or admin@rollify.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<UserIcon className="w-4 h-4" />}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>
          )}

          {/* Instant 1-Click Fast Staff PIN Switcher */}
          <div className="pt-4 border-t border-stone-100">
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 text-center">
              Quick Staff Sign-In (PIN)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickStaffLogin('ADMIN', '1111', 'admin')}
                className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition"
              >
                <span className="block text-xs font-bold text-purple-900">Admin</span>
                <span className="block text-[10px] text-purple-600 font-mono">PIN: 1111</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickStaffLogin('MANAGER', '2222', 'manager')}
                className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition"
              >
                <span className="block text-xs font-bold text-blue-900">Manager</span>
                <span className="block text-[10px] text-blue-600 font-mono">PIN: 2222</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickStaffLogin('CASHIER', '3333', 'cashier')}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition"
              >
                <span className="block text-xs font-bold text-emerald-900">Cashier</span>
                <span className="block text-[10px] text-emerald-600 font-mono">PIN: 3333</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickStaffLogin('WAITER', '4444', 'waiter')}
                className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition"
              >
                <span className="block text-xs font-bold text-amber-900">Waiter</span>
                <span className="block text-[10px] text-amber-600 font-mono">PIN: 4444</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickStaffLogin('KITCHEN', '5555', 'kitchen')}
                className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-left transition col-span-2 sm:col-span-1"
              >
                <span className="block text-xs font-bold text-orange-900">Kitchen</span>
                <span className="block text-[10px] text-orange-600 font-mono">PIN: 5555</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="relative z-10 text-center py-4 text-xs font-semibold text-white/80">
        Rollify — A Community of Flavours • Cafe POS Terminal System
      </footer>
    </div>
  );
};
