import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { Store, Receipt, Image as ImageIcon, CheckCircle2, Download, Database, Bell } from 'lucide-react';

interface TenantSettings {
  name: string;
  logoUrl?: string;
  currency: string;
  taxName?: string;
  taxRate?: number;
  receiptAddress?: string;
  receiptPhone?: string;
}

export function SettingsManager() {
  const { tenantId, userRole } = useAuth();
  const [settings, setSettings] = useState<TenantSettings>({
    name: '',
    logoUrl: '',
    currency: 'ARS',
    taxName: 'IVA',
    taxRate: 21,
    receiptAddress: '',
    receiptPhone: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de escritorio.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('¡Notificaciones Activadas!', {
          body: 'Recibirás alertas sobre stock bajo y deudas pendientes.',
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      if (!tenantId) return;
      try {
        const docRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings(prev => ({
            ...prev,
            name: data.name || '',
            logoUrl: data.logoUrl || '',
            currency: data.currency || 'ARS',
            taxName: data.taxName || 'IVA',
            taxRate: data.taxRate ?? 21,
            receiptAddress: data.receiptAddress || '',
            receiptPhone: data.receiptPhone || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || userRole !== 'admin') {
      alert('Solo los administradores pueden modificar los ajustes.');
      return;
    }
    
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const docRef = doc(db, 'tenants', tenantId);
      await updateDoc(docRef, {
        name: settings.name,
        logoUrl: settings.logoUrl,
        currency: settings.currency,
        taxName: settings.taxName,
        taxRate: settings.taxRate,
        receiptAddress: settings.receiptAddress,
        receiptPhone: settings.receiptPhone
      });
      setSuccessMsg('Ajustes guardados correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar los ajustes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!tenantId || userRole !== 'admin') {
      alert('Solo los administradores pueden exportar la base de datos.');
      return;
    }

    setIsExporting(true);
    try {
      const collectionsToExport = ['products', 'clients', 'suppliers', 'purchases', 'cash_sessions', 'sales', 'expenses', 'users'];
      const backupData: Record<string, any[]> = {};

      for (const collName of collectionsToExport) {
        const querySnapshot = await getDocs(collection(db, `tenants/${tenantId}/${collName}`));
        const docsData: any[] = [];
        querySnapshot.forEach((doc) => {
          docsData.push({ id: doc.id, ...doc.data() });
        });
        backupData[collName] = docsData;
      }

      // Add tenant basic info as well
      const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
      if (tenantSnap.exists()) {
        backupData['tenant_info'] = [{ id: tenantSnap.id, ...tenantSnap.data() }];
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${tenantId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Ocurrió un error al exportar la base de datos.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-slate-500">Cargando ajustes...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ajustes Generales</h1>
        <p className="text-slate-500">Configuración global de tu negocio</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 flex-1">
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Store className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Datos de la Empresa</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial</label>
              <input
                type="text"
                name="name"
                required
                value={settings.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda Principal</label>
              <input
                type="text"
                name="currency"
                required
                maxLength={3}
                value={settings.currency}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B] uppercase"
                placeholder="Ej: ARS, USD, MXN"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">URL del Logotipo</label>
              <div className="flex gap-4 items-start">
                {settings.logoUrl ? (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                    <img src={settings.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <input
                  type="url"
                  name="logoUrl"
                  value={settings.logoUrl}
                  onChange={handleChange}
                  placeholder="https://ejemplo.com/logo.png"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Facturación y Tickets */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Facturación e Impuestos</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Impuesto Base</label>
              <input
                type="text"
                name="taxName"
                value={settings.taxName}
                onChange={handleChange}
                placeholder="Ej: IVA, IGV"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tasa Impositiva (%)</label>
              <input
                type="number"
                name="taxRate"
                step="0.01"
                min="0"
                value={settings.taxRate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono para Tickets</label>
              <input
                type="text"
                name="receiptPhone"
                value={settings.receiptPhone}
                onChange={handleChange}
                placeholder="+54 11 1234-5678"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección para Tickets</label>
              <input
                type="text"
                name="receiptAddress"
                value={settings.receiptAddress}
                onChange={handleChange}
                placeholder="Av. Siempreviva 742"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B]"
              />
            </div>
          </div>
        </div>

        {/* Respaldo de Datos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Respaldo de Datos</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-slate-800 mb-1">Exportar Base de Datos</h3>
              <p className="text-sm text-slate-500 max-w-lg">
                Descarga una copia completa de toda la información de tu negocio (productos, clientes, ventas, compras, etc.) en formato JSON para tener un respaldo manual seguro.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleExportData}
              disabled={isExporting || userRole !== 'admin'}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar a JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Notificaciones del Sistema</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-slate-800 mb-1">Alertas en Segundo Plano</h3>
              <p className="text-sm text-slate-500 max-w-lg">
                Recibe notificaciones en tu computadora cuando la pestaña esté minimizada, alertándote sobre stock bajo o deudas pendientes.
              </p>
            </div>
            
            {notificationPermission === 'granted' ? (
              <div className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium shadow-sm flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Activadas</span>
              </div>
            ) : notificationPermission === 'denied' ? (
              <div className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium shadow-sm shrink-0">
                Bloqueadas por el navegador
              </div>
            ) : (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="px-4 py-2 bg-[#E3222B] text-white rounded-lg font-medium hover:bg-[#c91d25] transition-colors shadow-sm flex items-center gap-2 shrink-0"
              >
                <Bell className="w-4 h-4" />
                <span>Activar Notificaciones</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm font-medium">
            {successMsg && (
              <span className="flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {successMsg}
              </span>
            )}
            {userRole !== 'admin' && (
              <span className="text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                Solo lectura. Necesitas rol de administrador para guardar cambios.
              </span>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isSaving || userRole !== 'admin'}
            className="px-6 py-2.5 bg-[#E3222B] text-white rounded-lg font-medium hover:bg-[#c91d25] transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Ajustes'}
          </button>
        </div>
      </form>
    </div>
  );
}
