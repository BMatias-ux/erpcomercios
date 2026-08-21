import React from "react";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InventoryManager } from './pages/InventoryManager';
import { QuickPOS } from './pages/QuickPOS';

import { ClientManager } from './pages/ClientManager';
import { SupplierManager } from './pages/SupplierManager';
import { CashSessionManager } from './pages/CashSessionManager';
import { SalesReports } from './pages/SalesReports';
import { PurchaseManager } from './pages/PurchaseManager';
import { SettingsManager } from './pages/SettingsManager';

import { SalesHistory } from './pages/SalesHistory';

function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-[#F4F5F8]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 lg:ml-64 flex flex-col w-full min-w-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-auto bg-[#F4F5F8]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/inventario" element={<InventoryManager />} />
                    <Route path="/tpv" element={<QuickPOS />} />
                    <Route path="/pedidos" element={<PurchaseManager />} />
                    <Route path="/clientes" element={<ClientManager />} />
                    <Route path="/proveedores" element={<SupplierManager />} />
                    <Route path="/contabilidad" element={<CashSessionManager />} />
                    <Route path="/reportes" element={<SalesReports />} />
                    <Route path="/historial" element={<SalesHistory />} />
                    <Route path="/ajustes" element={<SettingsManager />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
