import React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, AlertTriangle, Package, X, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  stock_actual: number;
  stock_minimum: number;
  purchase_price: number;
  sale_price: number;
  unit: string;
  status: string;
  imageUrl: string;
}

const DEFAULT_CATEGORIES = ['Ferretería', 'Materiales pesados', 'Electricidad', 'Pinturas', 'Herramientas'];
const DEFAULT_UNITS = ['unidades', 'kg', 'metros', 'bolsas', 'palets'];

export function InventoryManager() {
  const { tenantId, userRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: DEFAULT_CATEGORIES[0],
    stock_actual: 0,
    stock_minimum: 5,
    purchase_price: 0,
    sale_price: 0,
    unit: DEFAULT_UNITS[0],
    status: 'active',
    imageUrl: ''
  });

  const uniqueCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...products.map(p => p.category)])).filter(Boolean);
  const uniqueUnits = Array.from(new Set([...DEFAULT_UNITS, ...products.map(p => p.unit)])).filter(Boolean);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const canEdit = userRole === 'admin' || userRole === 'stock_keeper';

  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, `tenants/${tenantId}/products`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prodData: Product[] = [];
      snapshot.forEach((doc) => {
        prodData.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prodData);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        name: product.name,
        category: product.category,
        stock_actual: product.stock_actual,
        stock_minimum: product.stock_minimum,
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        unit: product.unit,
        status: product.status,
        imageUrl: product.imageUrl || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        code: '',
        name: '',
        category: DEFAULT_CATEGORIES[0],
        stock_actual: 0,
        stock_minimum: 5,
        purchase_price: 0,
        sale_price: 0,
        unit: DEFAULT_UNITS[0],
        status: 'active',
        imageUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const productData = {
        ...formData,
        stock_actual: Number(formData.stock_actual),
        stock_minimum: Number(formData.stock_minimum),
        purchase_price: Number(formData.purchase_price),
        sale_price: Number(formData.sale_price)
      };

      if (editingProduct) {
        await setDoc(doc(db, `tenants/${tenantId}/products`, editingProduct.id), productData);
      } else {
        await addDoc(collection(db, `tenants/${tenantId}/products`), productData);
      }
      handleCloseModal();
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await deleteDoc(doc(db, `tenants/${tenantId}/products`, id));
      } catch (error: any) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Inventario y Stock</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona tus productos, herramientas y materiales.</p>
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
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E3222B] sm:text-sm"
              placeholder="Buscar por código o nombre..."
            />
          </div>
          {canEdit && (
            <button 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto bg-[#3AAFA9] hover:bg-[#2B7A78] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
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
                <th className="px-4 py-3 font-medium">Img / Cód.</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Precio Venta</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                {canEdit && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>No se encontraron productos.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLowStock = p.stock_actual <= p.stock_minimum;
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <span className="font-mono text-xs text-slate-500">{p.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">{p.category}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {isLowStock && <AlertTriangle className="w-4 h-4 text-amber-500" title="Stock por debajo del mínimo" />}
                          <span className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-slate-700'}`}>
                            {p.stock_actual}
                          </span>
                          <span className="text-xs text-slate-400">{p.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        ${p.sale_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleOpenModal(p)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {userRole === 'admin' && (
                              <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
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
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Basic Info */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Información Principal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Código (Barras/SKU) *</label>
                      <input required type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" placeholder="Ej: C0001001" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del Producto *</label>
                      <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" placeholder="Ej: Martillo de Uña Pro" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Categoría *</label>
                      <input required list="categories-list" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm bg-white" placeholder="Ej: Ferretería" />
                      <datalist id="categories-list">
                        {uniqueCategories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Imagen (URL o Archivo)</label>
                      <div className="flex space-x-2">
                        <input type="text" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" placeholder="https://..." />
                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-center transition-colors">
                          <ImageIcon className="w-4 h-4 text-slate-500" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                      </div>
                      {formData.imageUrl && (
                         <div className="mt-2 w-16 h-16 rounded border border-slate-200 overflow-hidden bg-slate-50">
                           <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                         </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Control de Stock</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Stock Actual *</label>
                      <input required type="number" min="0" step="0.01" value={formData.stock_actual} onChange={(e) => setFormData({...formData, stock_actual: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Stock Mínimo *</label>
                      <input required type="number" min="0" step="0.01" value={formData.stock_minimum} onChange={(e) => setFormData({...formData, stock_minimum: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Unidad *</label>
                      <input required list="units-list" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm bg-white" placeholder="Ej: unidades" />
                      <datalist id="units-list">
                        {uniqueUnits.map(u => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Estado *</label>
                      <select required value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm bg-white">
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Pricing Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Precios</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Precio de Compra (Costo) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-500">$</span>
                        <input required type="number" min="0" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Precio de Venta *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-500">$</span>
                        <input required type="number" min="0" step="0.01" value={formData.sale_price} onChange={(e) => setFormData({...formData, sale_price: e.target.value})} className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#E3222B] focus:outline-none sm:text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#E3222B] hover:bg-red-700 rounded-lg transition-colors shadow-sm">
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
