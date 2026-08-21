import React from "react";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export function Onboarding() {
  const { user, setTenantId, setUserRole } = useAuth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      // Generate a tenant ID, here we just use a random string or let firestore generate, but doc() doesn't auto-generate unless we use collection()
      // Let's create a custom tenant ID or use a random one
      const tenantId = `t_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const batch = writeBatch(db);
      
      const tenantRef = doc(db, 'tenants', tenantId);
      batch.set(tenantRef, {
        name,
        currency,
        subscription_status: 'trial',
        createdAt: serverTimestamp()
      });

      const userRef = doc(db, `tenants/${tenantId}/users`, user.uid);
      batch.set(userRef, {
        email: user.email || 'sin-correo@flexxus.app',
        role: 'admin'
      });

      await batch.commit();
      
      setTenantId(tenantId);
      setUserRole('admin');
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Error al crear la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Bienvenido a Flexxus
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Configura tu distribuidora o corralón para comenzar.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleCreateTenant}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Nombre de la Empresa</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[#E3222B] focus:border-[#E3222B] sm:text-sm"
                  placeholder="Ej: Distribuidora del Norte"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Moneda Local</label>
              <div className="mt-1">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[#E3222B] focus:border-[#E3222B] sm:text-sm"
                >
                  <option value="ARS">Pesos Argentinos (ARS)</option>
                  <option value="COP">Pesos Colombianos (COP)</option>
                  <option value="MXN">Pesos Mexicanos (MXN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#E3222B] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E3222B]"
              >
                {loading ? 'Creando...' : 'Comenzar (Prueba de 14 días)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
