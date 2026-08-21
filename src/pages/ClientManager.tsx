import React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, Users, X, DollarSign, MapPin, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Client {
  id: string;
  name: string;
  cuit: string;
  phone: string;
  address: string;
  province: string;
  locality: string;
  email: string;
  balance: number;
}

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

export function ClientManager() {
  const { tenantId, userRole } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cuit: '',
    phone: '',
    email: '',
    address: '',
    province: PROVINCES[5], // Defaulting to Córdoba just as an example
    locality: '',
    balance: 0
  });

  const canEdit = userRole === 'admin' || userRole === 'seller';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, `tenants/${tenantId}/clients`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientData: Client[] = [];
      snapshot.forEach((doc) => {
        clientData.push({ id: doc.id, ...doc.data() } as Client);
      });
      // Sort clients alphabetically by name
      clientData.sort((a, b) => a.name.localeCompare(b.name));
      setClients(clientData);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        cuit: client.cuit,
        phone: client.phone,
        email: client.email,
        address: client.address,
        province: client.province,
        locality: client.locality,
        balance: client.balance
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        cuit: '',
        phone: '',
        email: '',
        address: '',
        province: PROVINCES[5],
        locality: '',
        balance: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const clientData = {
        ...formData,
        balance: Number(formData.balance)
      };

      if (editingClient) {
        await setDoc(doc(db, `tenants/${tenantId}/clients`, editingClient.id), clientData);
      } else {
        await addDoc(collection(db, `tenants/${tenantId}/clients`), clientData);
      }
      handleCloseModal();
    } catch (error: any) {
      console.error("Error saving client:", error);
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    if (window.confirm('¿Estás seguro de eliminar este cliente? Se perderá su cuenta corriente.')) {
      try {
        await deleteDoc(doc(db, `tenants/${tenantId}/clients`, id));
      } catch (error: any) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cuit.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Directorio de Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona los datos y saldos de cuentas corrientes.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#3AAFA9] sm:text-sm"
              placeholder="Buscar por nombre, email o CUIT..."
            />
          </div>
          {canEdit && (
            <button 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto bg-[#3AAFA9] hover:bg-[#2B7A78] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Cliente</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">CUIT / Documento</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Ubicación</th>
                <th className="px-4 py-3 font-medium text-right">Cuenta Corriente</th>
                {canEdit && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>No se encontraron clientes.</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const hasDebt = client.balance > 0;
                  const hasCredit = client.balance < 0;
                  
                  return (
                    <tr key={client.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-[#3AAFA9]/10 text-[#3AAFA9] flex items-center justify-center font-bold text-lg shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{client.name}</p>
                            <p className="text-xs text-slate-500">{client.email || 'Sin email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{client.cuit || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{client.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]" title={`${client.locality}, ${client.province}`}>
                            {client.locality ? `${client.locality}` : 'Sin localidad'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-semibold ${hasDebt ? 'text-red-600' : hasCredit ? 'text-green-600' : 'text-slate-700'}`}>
                          ${Math.abs(client.balance).toLocaleString()}
                        </div>
                        <span className="text-xs text-slate-400">
                          {hasDebt ? 'A cobrar' : hasCredit ? 'A favor' : 'Al día'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link 
                              to={`/historial?search=${encodeURIComponent(client.name)}`}
                              className="p-1 text-slate-400 hover:text-[#3AAFA9] transition-colors"
                              title="Ver Historial de Ventas"
                            >
                              <FileText className="w-4 h-4" />
                            </Link>
                            <button onClick={() => handleOpenModal(client)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button onClick={() => handleDelete(client.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Info */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Datos Principales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Razón Social / Nombre Completo *</label>
                      <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Construcciones SA" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">CUIT / DNI</label>
                      <input type="text" value={formData.cuit} onChange={(e) => setFormData({...formData, cuit: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm font-mono" placeholder="Ej: 30-12345678-9" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Teléfono</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: 351 123 4567" />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Correo Electrónico</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="ejemplo@correo.com" />
                    </div>
                  </div>
                </div>

                {/* Address Info */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Ubicación</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Dirección</label>
                      <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Av. Colón 1234" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Provincia *</label>
                      <select required value={formData.province} onChange={(e) => setFormData({...formData, province: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm bg-white">
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Localidad</label>
                      <input type="text" value={formData.locality} onChange={(e) => setFormData({...formData, locality: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Córdoba Capital" />
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Cuenta Corriente</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Saldo Inicial (Positivo = A Cobrar, Negativo = A Favor)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <DollarSign className="h-4 w-4 text-slate-400" />
                        </div>
                        <input required type="number" step="0.01" value={formData.balance} onChange={(e) => setFormData({...formData, balance: e.target.value})} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm font-mono" />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">Si el cliente te debe dinero, ingresa un número positivo. Si tiene saldo a favor, usa el signo negativo (-).</p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#3AAFA9] hover:bg-[#2B7A78] rounded-lg transition-colors shadow-sm">
                  {editingClient ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
