import React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, Briefcase, X, MapPin, User, Phone } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
}

export function SupplierManager() {
  const { tenantId, userRole } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    phone: '',
    address: ''
  });

  const canEdit = userRole === 'admin' || userRole === 'stock_keeper';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, `tenants/${tenantId}/suppliers`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const supplierData: Supplier[] = [];
      snapshot.forEach((doc) => {
        supplierData.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      // Sort suppliers alphabetically by name
      supplierData.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(supplierData);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact: supplier.contact,
        phone: supplier.phone,
        address: supplier.address
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact: '',
        phone: '',
        address: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const supplierData = { ...formData };

      if (editingSupplier) {
        await setDoc(doc(db, `tenants/${tenantId}/suppliers`, editingSupplier.id), supplierData);
      } else {
        await addDoc(collection(db, `tenants/${tenantId}/suppliers`), supplierData);
      }
      handleCloseModal();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    if (window.confirm('¿Estás seguro de eliminar este proveedor?')) {
      try {
        await deleteDoc(doc(db, `tenants/${tenantId}/suppliers`, id));
      } catch (error: any) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Directorio de Proveedores</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona los datos de los proveedores de tu inventario.</p>
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
              placeholder="Buscar por nombre o contacto..."
            />
          </div>
          {canEdit && (
            <button 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto bg-[#3AAFA9] hover:bg-[#2B7A78] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proveedor</span>
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
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                {canEdit && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                    <Briefcase className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>No se encontraron proveedores.</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-[#3AAFA9]/10 text-[#3AAFA9] flex items-center justify-center font-bold text-lg shrink-0">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{supplier.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-slate-600">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{supplier.contact || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{supplier.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]" title={supplier.address}>
                          {supplier.address || 'Sin dirección'}
                        </span>
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleOpenModal(supplier)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button onClick={() => handleDelete(supplier.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre / Razón Social *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Distribuidora Mayorista S.A." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del Contacto</label>
                  <input type="text" value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Juan Pérez" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Teléfono</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: 11 1234 5678" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Dirección</label>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#3AAFA9] focus:outline-none sm:text-sm" placeholder="Ej: Parque Industrial, Nave 4" />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#3AAFA9] hover:bg-[#2B7A78] rounded-lg transition-colors shadow-sm">
                  {editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
