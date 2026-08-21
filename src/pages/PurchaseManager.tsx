import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch, serverTimestamp, increment, addDoc, orderBy, where } from 'firebase/firestore';
import { Search, Plus, FileText, CheckCircle2, Truck, XCircle, Eye, Printer, MessageCircle, X, Search as SearchIcon, Scan, DollarSign, Clock, AlertTriangle } from 'lucide-react';

interface PurchaseItem {
  productId: string;
  code: string;
  name: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  itemTotal: number;
}

interface Purchase {
  id: string;
  folio: string;
  supplierId: string;
  supplierName: string;
  supplierContact?: string;
  date: any;
  estimatedDelivery?: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentCondition: string;
  status: string;
  notes?: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  purchase_price: number;
  stock_actual: number;
}

const STATUS_COLORS: Record<string, string> = {
  'Borrador': 'bg-slate-100 text-slate-700 border-slate-200',
  'Solicitado': 'bg-blue-100 text-blue-700 border-blue-200',
  'Recepción Parcial': 'bg-orange-100 text-orange-700 border-orange-200',
  'Recibido Completo': 'bg-green-100 text-green-700 border-green-200',
  'Cancelado': 'bg-red-100 text-red-700 border-red-200',
};

export function PurchaseManager() {
  const { tenantId } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [activePurchase, setActivePurchase] = useState<Purchase | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // New Purchase Form State
  const [supplierId, setSupplierId] = useState('');
  const [paymentCondition, setPaymentCondition] = useState('Crédito');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Receive Modal State
  const [receiveItems, setReceiveItems] = useState<Array<{productId: string, qty: number, updateCost: boolean}>>([]);

  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    if (!tenantId) return;

    // Fetch Active Cash Session
    const qSession = query(collection(db, `tenants/${tenantId}/cash_sessions`), where('status', '==', 'open'));
    const unsubSession = onSnapshot(qSession, (snapshot) => {
      if (!snapshot.empty) {
        setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveSession(null);
      }
    }, (error) => { console.warn("Session listener error:", error); });

    // Fetch Purchases
    const qPurchases = query(collection(db, `tenants/${tenantId}/purchases`), orderBy('date', 'desc'));
    const unsubPurchases = onSnapshot(qPurchases, (snapshot) => {
      const data: Purchase[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Purchase));
      setPurchases(data);
    }, (error) => { console.warn("Purchases listener error:", error); });

    // Fetch Suppliers
    const qSuppliers = query(collection(db, `tenants/${tenantId}/suppliers`));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data: Supplier[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
    }, (error) => { console.warn("Suppliers listener error:", error); });

    // Fetch Products
    const qProducts = query(collection(db, `tenants/${tenantId}/products`));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data: Product[] = [];
      snapshot.forEach(doc => {
        const p = doc.data();
        if (p.status === 'active') data.push({ id: doc.id, ...p } as Product);
      });
      setProducts(data);
    }, (error) => { console.warn("Products listener error:", error); });

    return () => {
      unsubSession();
      unsubPurchases();
      unsubSuppliers();
      unsubProducts();
    };
  }, [tenantId]);
  
  // Scanner integration for new purchase modal
  useEffect(() => {
    if (!isModalOpen) return;
    
    let barcodeBuffer = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 0) {
          const scannedProduct = products.find(p => p.code === barcodeBuffer);
          if (scannedProduct) {
            addProductToCart(scannedProduct);
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeBuffer = '';
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimeout);
    };
  }, [isModalOpen, products]);

  const addProductToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === p.id);
      if (existing) {
        return prev.map(item => 
          item.productId === p.id 
            ? { ...item, quantityOrdered: item.quantityOrdered + 1, itemTotal: (item.quantityOrdered + 1) * item.unitCost }
            : item
        );
      }
      return [...prev, {
        productId: p.id,
        code: p.code,
        name: p.name,
        quantityOrdered: 1,
        quantityReceived: 0,
        unitCost: p.purchase_price,
        itemTotal: p.purchase_price
      }];
    });
    setProductSearch('');
  };

  const updateCartItem = (productId: string, field: keyof PurchaseItem, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const updated = { ...item, [field]: value };
        updated.itemTotal = updated.quantityOrdered * updated.unitCost;
        return updated;
      }
      return item;
    }));
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const tax = 0; // Configurable if needed
  const total = subtotal + tax;

  const handleCreatePurchase = async () => {
    if (!tenantId || !supplierId || cart.length === 0) return;
    setIsProcessing(true);
    
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      const newPurchaseRef = doc(collection(db, `tenants/${tenantId}/purchases`));
      
      // Generate Folio OC-YYYYMMDD-XXX
      const today = new Date();
      const randomPart = Math.floor(100 + Math.random() * 900);
      const folio = `OC-${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${randomPart}`;

      await setDoc(newPurchaseRef, {
        folio,
        supplierId: supplier?.id || '',
        supplierName: supplier?.name || '',
        supplierContact: supplier?.phone || '',
        date: serverTimestamp(),
        estimatedDelivery,
        items: cart,
        subtotal,
        tax,
        total,
        paymentCondition,
        status: 'Solicitado',
        notes
      });
      
      // Update supplier balance if it's credit
      if (paymentCondition === 'Crédito' && supplier) {
        await updateDoc(doc(db, `tenants/${tenantId}/suppliers`, supplier.id), {
          balance: increment(total)
        });
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Error al crear orden de compra');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSupplierId('');
    setPaymentCondition('Crédito');
    setEstimatedDelivery('');
    setNotes('');
    setCart([]);
  };

  const openReceiveModal = (purchase: Purchase) => {
    setActivePurchase(purchase);
    setReceiveItems(purchase.items.map(item => ({
      productId: item.productId,
      qty: item.quantityOrdered - item.quantityReceived,
      updateCost: false
    })));
    setIsReceiveModalOpen(true);
  };

  const handleReceiveMerchandise = async () => {
    if (!tenantId || !activePurchase) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(db);
      
      const newItems = [...activePurchase.items];
      let allReceived = true;
      
      for (const receiveItem of receiveItems) {
        if (receiveItem.qty > 0) {
          // Update purchase item
          const itemIndex = newItems.findIndex(i => i.productId === receiveItem.productId);
          if (itemIndex >= 0) {
            newItems[itemIndex].quantityReceived += receiveItem.qty;
          }
          
          // Update product stock
          const prodRef = doc(db, `tenants/${tenantId}/products`, receiveItem.productId);
          const updateData: any = {
            stock_actual: increment(receiveItem.qty)
          };
          
          // Update cost if checked
          if (receiveItem.updateCost) {
            const purchaseItem = newItems.find(i => i.productId === receiveItem.productId);
            if (purchaseItem) {
              updateData.purchase_price = purchaseItem.unitCost;
            }
          }
          
          batch.update(prodRef, updateData);
        }
      }
      
      for (const item of newItems) {
        if (item.quantityReceived < item.quantityOrdered) {
          allReceived = false;
        }
      }
      
      const purchaseRef = doc(db, `tenants/${tenantId}/purchases`, activePurchase.id);
      batch.update(purchaseRef, {
        items: newItems,
        status: allReceived ? 'Recibido Completo' : 'Recepción Parcial'
      });
      
      // Register cash expense if it was "Contado"
      if (activePurchase.paymentCondition === 'Contado' && activeSession) {
        // Calculate the total for received items
        let receivedValue = 0;
        for (const rItem of receiveItems) {
          if (rItem.qty > 0) {
            const pItem = activePurchase.items.find(i => i.productId === rItem.productId);
            if (pItem) receivedValue += rItem.qty * pItem.unitCost;
          }
        }
        
        if (receivedValue > 0) {
          const expenseRef = doc(collection(db, `tenants/${tenantId}/expenses`));
          batch.set(expenseRef, {
            description: `Pago compra ${activePurchase.folio} a ${activePurchase.supplierName}`,
            amount: receivedValue,
            date: serverTimestamp(),
            sessionId: activeSession.id
          });
        }
      }
      
      await batch.commit();
      setIsReceiveModalOpen(false);
      setActivePurchase(null);
    } catch (error) {
      console.error(error);
      alert('Error al recibir mercadería');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPurchase = async (purchase: Purchase) => {
    if (!tenantId || !window.confirm('¿Está seguro de cancelar este pedido?')) return;
    
    try {
      const purchaseRef = doc(db, `tenants/${tenantId}/purchases`, purchase.id);
      await updateDoc(purchaseRef, { status: 'Cancelado' });
      
      // Reverse balance if credit
      if (purchase.paymentCondition === 'Crédito') {
        await updateDoc(doc(db, `tenants/${tenantId}/suppliers`, purchase.supplierId), {
          balance: increment(-purchase.total)
        });
      }
    } catch (error) {
      console.error(error);
      alert('Error al cancelar pedido');
    }
  };

  const handleWhatsApp = (purchase: Purchase) => {
    const text = `Hola, te envío la orden de compra ${purchase.folio} por un total de $${purchase.total.toLocaleString()}.`;
    const url = `https://wa.me/${purchase.supplierContact?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.folio.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const productSearchResults = productSearch 
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch))
    : [];

  // KPIs
  const currentMonth = new Date().getMonth();
  const totalMonth = purchases
    .filter(p => p.date && new Date(p.date.seconds * 1000).getMonth() === currentMonth && p.status !== 'Cancelado')
    .reduce((sum, p) => sum + p.total, 0);
    
  const pendingOrders = purchases.filter(p => p.status === 'Solicitado' || p.status === 'Recepción Parcial').length;
  
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Pedidos y Compras</h1>
          <p className="text-slate-500">Gestión de abastecimiento a proveedores</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#E3222B] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#c91d25] transition-colors flex items-center shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Pedido
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Compras del Mes</p>
            <h3 className="text-2xl font-bold text-slate-800">${totalMonth.toLocaleString('es-AR')}</h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mr-4">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Pedidos Pendientes</p>
            <h3 className="text-2xl font-bold text-slate-800">{pendingOrders}</h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Deuda Proveedores (Cta Cte)</p>
            <h3 className="text-2xl font-bold text-slate-800">${totalSupplierDebt.toLocaleString('es-AR')}</h3>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por folio o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#3AAFA9] focus:ring-1 focus:ring-[#3AAFA9]"
          />
        </div>
        <div className="flex gap-2">
          {['Todos', 'Borrador', 'Solicitado', 'Recepción Parcial', 'Recibido Completo', 'Cancelado'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Folio</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Fecha</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Proveedor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Estado</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Total</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron órdenes de compra.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{purchase.folio}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {purchase.date ? new Date(purchase.date.seconds * 1000).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-800">{purchase.supplierName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[purchase.status]}`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      ${purchase.total.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setActivePurchase(purchase); setIsViewModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleWhatsApp(purchase)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {(purchase.status === 'Solicitado' || purchase.status === 'Recepción Parcial') && (
                          <button 
                            onClick={() => openReceiveModal(purchase)}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" 
                            title="Recibir Mercadería"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                        {(purchase.status === 'Solicitado' || purchase.status === 'Borrador') && (
                          <button 
                            onClick={() => handleCancelPurchase(purchase)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Cancelar"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Nuevo Pedido de Compra</h2>
              <button onClick={() => {setIsModalOpen(false); resetForm();}} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#3AAFA9] focus:ring-1 focus:ring-[#3AAFA9]"
                  >
                    <option value="">Seleccione un proveedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Condición de Pago</label>
                  <select
                    value={paymentCondition}
                    onChange={(e) => setPaymentCondition(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#3AAFA9] focus:ring-1 focus:ring-[#3AAFA9]"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito / Cuenta Corriente</option>
                    <option value="Anticipo">Anticipo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Est. Entrega</label>
                  <input
                    type="date"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#3AAFA9] focus:ring-1 focus:ring-[#3AAFA9]"
                  />
                </div>
              </div>

              {/* Product Search */}
              <div className="mb-6 relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Agregar Productos</label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o escanear código..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#3AAFA9] focus:ring-1 focus:ring-[#3AAFA9] bg-white"
                  />
                </div>
                {productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productSearchResults.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => addProductToCart(p)}
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.code}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700">${p.purchase_price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Producto</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-24">Cant.</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-32">Costo Un.</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-32">Total</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map(item => (
                      <tr key={item.productId}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantityOrdered}
                            onChange={(e) => updateCartItem(item.productId, 'quantityOrdered', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-[#3AAFA9]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={item.unitCost}
                            onChange={(e) => updateCartItem(item.productId, 'unitCost', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-[#3AAFA9]"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          ${item.itemTotal.toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeCartItem(item.productId)} className="text-slate-400 hover:text-red-500">
                            <X className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                          No hay productos en el pedido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between mb-2 text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm text-slate-600">
                    <span>Impuestos</span>
                    <span>${tax.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-slate-800 pt-2 border-t border-slate-100">
                    <span>Total</span>
                    <span>${total.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white">
              <button
                onClick={() => {setIsModalOpen(false); resetForm();}}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePurchase}
                disabled={isProcessing || cart.length === 0 || !supplierId}
                className="px-6 py-2 bg-[#E3222B] text-white rounded-lg font-medium hover:bg-[#c91d25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isProcessing ? 'Generando...' : 'Emitir Orden de Compra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recepción */}
      {isReceiveModalOpen && activePurchase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Recibir Mercadería</h2>
                <p className="text-sm text-slate-500">Orden {activePurchase.folio}</p>
              </div>
              <button onClick={() => setIsReceiveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Producto</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center">Faltante</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-32">Cant. Recibida</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 w-32 text-center">Actualizar Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePurchase.items.map((item, index) => {
                    const remaining = item.quantityOrdered - item.quantityReceived;
                    const rItem = receiveItems.find(r => r.productId === item.productId);
                    if (remaining <= 0) return null;
                    
                    return (
                      <tr key={item.productId}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">Costo orden: ${item.unitCost}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600">
                          {remaining}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={rItem?.qty || 0}
                            onChange={(e) => {
                              const val = Math.min(remaining, Math.max(0, Number(e.target.value)));
                              setReceiveItems(prev => prev.map(r => r.productId === item.productId ? { ...r, qty: val } : r));
                            }}
                            className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-[#3AAFA9]"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={rItem?.updateCost || false}
                            onChange={(e) => {
                              setReceiveItems(prev => prev.map(r => r.productId === item.productId ? { ...r, updateCost: e.target.checked } : r));
                            }}
                            className="w-4 h-4 text-[#3AAFA9] rounded focus:ring-[#3AAFA9]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p>Al confirmar, el stock de los productos indicados se incrementará automáticamente en el catálogo de inventario.</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReceiveMerchandise}
                disabled={isProcessing || receiveItems.every(r => r.qty === 0)}
                className="px-6 py-2 bg-[#3AAFA9] text-white rounded-lg font-medium hover:bg-[#2B7A78] transition-colors flex items-center disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle / Imprimir */}
      {isViewModalOpen && activePurchase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Orden de Compra: {activePurchase.folio}</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Imprimir / Guardar PDF"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button onClick={() => { setIsViewModalOpen(false); setActivePurchase(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto print:p-0">
              <div className="flex justify-between mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">PROVEEDOR</h3>
                  <p className="font-medium text-lg text-slate-800">{activePurchase.supplierName}</p>
                  <p className="text-slate-500">{activePurchase.supplierContact || 'Sin contacto'}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">DETALLES</h3>
                  <p className="text-slate-800"><span className="text-slate-500 mr-2">Fecha:</span> {activePurchase.date ? new Date(activePurchase.date.seconds * 1000).toLocaleDateString() : '-'}</p>
                  <p className="text-slate-800"><span className="text-slate-500 mr-2">Condición:</span> {activePurchase.paymentCondition}</p>
                  <p className="text-slate-800"><span className="text-slate-500 mr-2">Estado:</span> {activePurchase.status}</p>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse mb-8">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-slate-800">
                    <th className="py-3 font-semibold w-16">Cód</th>
                    <th className="py-3 font-semibold">Descripción</th>
                    <th className="py-3 font-semibold text-center w-24">Cant</th>
                    <th className="py-3 font-semibold text-center w-24">Recibida</th>
                    <th className="py-3 font-semibold text-right w-32">Precio Un.</th>
                    <th className="py-3 font-semibold text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activePurchase.items.map(item => (
                    <tr key={item.productId}>
                      <td className="py-3 text-sm text-slate-600">{item.code}</td>
                      <td className="py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 text-center text-slate-600">{item.quantityOrdered}</td>
                      <td className="py-3 text-center text-slate-600">{item.quantityReceived}</td>
                      <td className="py-3 text-right text-slate-600">${item.unitCost.toLocaleString('es-AR')}</td>
                      <td className="py-3 text-right font-medium text-slate-800">${item.itemTotal.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
                    <span>Subtotal</span>
                    <span>${activePurchase.subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
                    <span>IVA</span>
                    <span>${activePurchase.tax.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between py-3 text-lg font-bold text-slate-800 border-b-2 border-slate-800">
                    <span>Total</span>
                    <span>${activePurchase.total.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
