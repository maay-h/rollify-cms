import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  pinLogin: (pin: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'rollify_pos_auth_token';
const USER_KEY = 'rollify_pos_user_data';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Verify token on initial load
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        const json = await res.json();
        const userData = json?.data?.user || json?.data;
        if (json.success && userData && (userData.role || userData.id)) {
          const u: User = {
            id: userData.id || 'usr-1',
            username: userData.username || 'admin',
            email: userData.email || 'admin@rollify.in',
            role: (userData.role as UserRole) || 'ADMIN',
            fullName: userData.fullName || userData.full_name || 'System Admin',
            phone: userData.phone || '+91 98765 43210',
          };
          setUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        } else if (!json.success) {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (identifier: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
      });
      const data = await res.json();

      if (!data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      const newToken = data.data.token;
      const rawUser = data.data.user || data.data;
      const newUser: User = {
        id: rawUser.id,
        username: rawUser.username,
        email: rawUser.email,
        role: rawUser.role || 'ADMIN',
        fullName: rawUser.fullName || rawUser.full_name || rawUser.username || 'Staff User',
        phone: rawUser.phone,
      };

      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);

      return { success: true, role: newUser.role };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection error' };
    }
  };

  const pinLogin = async (pin: string) => {
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (!data.success) {
        return { success: false, error: data.error || 'Invalid PIN' };
      }

      const newToken = data.data.token;
      const rawUser = data.data.user || data.data;
      const newUser: User = {
        id: rawUser.id,
        username: rawUser.username,
        email: rawUser.email,
        role: rawUser.role || 'ADMIN',
        fullName: rawUser.fullName || rawUser.full_name || rawUser.username || 'Staff User',
        phone: rawUser.phone,
      };

      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);

      return { success: true, role: newUser.role };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Ignore logout request errors
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        pinLogin,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
