import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SocketProvider } from './context/SocketContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TablesPage } from './pages/TablesPage.js';
import { MenuPage } from './pages/MenuPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { POSOrderPage } from './pages/POSOrderPage.js';
import { OrdersListPage } from './pages/OrdersListPage.js';
import { KitchenDisplayPage } from './pages/KitchenDisplayPage.js';
import { BillingCheckoutPage } from './pages/BillingCheckoutPage.js';
import { DayClosingPage } from './pages/DayClosingPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { StaffShiftsPage } from './pages/StaffShiftsPage.js';
import { AnalyticsReportsPage } from './pages/AnalyticsReportsPage.js';
import { LoadingSpinner } from './components/ui/LoadingSpinner.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <LoadingSpinner text="Authenticating Rollify Terminal..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="pos" element={<POSOrderPage />} />
                <Route path="orders" element={<OrdersListPage />} />
                <Route path="kitchen" element={<KitchenDisplayPage />} />
                <Route path="kds" element={<Navigate to="/kitchen" replace />} />
                <Route path="billing" element={<BillingCheckoutPage />} />
                <Route path="day-closing" element={<DayClosingPage />} />
                <Route path="day-close" element={<Navigate to="/day-closing" replace />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="shifts" element={<StaffShiftsPage />} />
                <Route path="analytics" element={<AnalyticsReportsPage />} />
                <Route path="tables" element={<TablesPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="users" element={<UsersPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
};
