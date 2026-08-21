import React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, writeBatch, serverTimestamp, where, increment, addDoc } from 'firebase/firestore';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Building2, CheckCircle2, User, Wallet, X } from 'lucide-react';

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

interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

interface Client {
  id: string;
  name: string;
  balance: number;
}

const PAYMENT_METHODS = [
  { id: 'Efectivo', icon: Banknote },
  { id: 'Tarjeta', icon: CreditCard },
  { id: 'Transferencia', icon: Building2 },
  { id: 'Cuenta Corriente', icon: ShoppingCart },
];

export function QuickPOS() {
  const { tenantId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [paymentMethod2, setPaymentMethod2] = useState('Tarjeta');
  const [paymentAmount1, setPaymentAmount1] = useState<number | ''>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseData, setExpenseData] = useState({ description: '', amount: '' });
  const [expenseProcessing, setExpenseProcessing] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    
    // Fetch active cash session
    const qSession = query(collection(db, `tenants/${tenantId}/cash_sessions`), where('status', '==', 'open'));
    const unsubSession = onSnapshot(qSession, (snapshot) => {
      if (!snapshot.empty) {
        setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveSession(null);
      }
    });

    // Fetch products
    const qProd = query(collection(db, `tenants/${tenantId}/products`));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const prodData: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Product;
        if (data.status === 'active') {
          prodData.push({ id: doc.id, ...data });
        }
      });
      setProducts(prodData);
    });

    // Fetch clients
    const qClient = query(collection(db, `tenants/${tenantId}/clients`));
    const unsubClient = onSnapshot(qClient, (snapshot) => {
      const clientData: Client[] = [];
      snapshot.forEach((doc) => {
        clientData.push({ id: doc.id, ...doc.data() } as Client);
      });
      clientData.sort((a, b) => a.name.localeCompare(b.name));
      setClients(clientData);
    });

    return () => {
      unsubSession();
      unsubProd();
      unsubClient();
    };
  }, [tenantId]);

  // Barcode Scanner Integration
  useEffect(() => {
    let barcodeBuffer = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is focused on an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 0) {
          const scannedProduct = products.find(p => p.code === barcodeBuffer);
          if (scannedProduct) {
            // Using functional state update so we don't need cart/addToCart in dependencies
            setCart(prev => {
              const existing = prev.find(item => item.product.id === scannedProduct.id);
              if (existing) {
                return prev.map(item => 
                  item.product.id === scannedProduct.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
                );
              }
              return [...prev, { product: scannedProduct, quantity: 1, discountPercent: 0 }];
            });
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        // Scanners typically send keystrokes in < 20ms intervals
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
  }, [products]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, discountPercent: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, discountPercent: Math.min(100, Math.max(0, discount)) }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const itemTotal = item.product.sale_price * item.quantity;
    const afterDiscount = itemTotal * (1 - item.discountPercent / 100);
    return sum + afterDiscount;
  }, 0);

  const amount1 = isSplitPayment ? Number(paymentAmount1) : cartTotal;
  const amount2 = isSplitPayment ? Math.max(0, cartTotal - amount1) : 0;

  const currentPayments = isSplitPayment 
    ? [
        { method: paymentMethod, amount: amount1 },
        { method: paymentMethod2, amount: amount2 }
      ].filter(p => p.amount > 0)
    : [{ method: paymentMethod, amount: cartTotal }];

  const handleCheckout = async () => {
    if (!tenantId || cart.length === 0) return;
    setIsProcessing(true);
    setSuccessMsg('');

    try {
      const batch = writeBatch(db);
      const selectedClient = clients.find(c => c.id === selectedClientId);
      
      // 1. Create Sale Document
      const saleItems = cart.map(item => ({
        productId: item.product.id || '',
        name: item.product.name || 'Sin nombre',
        quantity: item.quantity || 1,
        price: item.product.sale_price ?? 0
      }));

      const saleRef = doc(collection(db, `tenants/${tenantId}/sales`));
      batch.set(saleRef, {
        clientId: selectedClient ? selectedClient.id : 'consumidor_final',
        clientName: selectedClient ? selectedClient.name : 'Consumidor Final',
        type: 'sale',
        date: serverTimestamp(),
        total: cartTotal,
        payments: currentPayments,
        items: saleItems,
        status: 'completed'
      });

      // 2. Update Stock
      for (const item of cart) {
        const prodRef = doc(db, `tenants/${tenantId}/products`, item.product.id);
        const newStock = item.product.stock_actual - item.quantity;
        
        // We must update the entire product to pass validation rules (without id)
        const { id, ...productData } = item.product;
        batch.update(prodRef, {
          ...productData,
          stock_actual: newStock
        });
      }

      // 3. Update Client Balance if "Cuenta Corriente" is used
      const cuentaCorrienteAmount = currentPayments
        .filter(p => p.method === 'Cuenta Corriente')
        .reduce((sum, p) => sum + p.amount, 0);

      if (cuentaCorrienteAmount > 0 && selectedClient) {
        const clientRef = doc(db, `tenants/${tenantId}/clients`, selectedClient.id);
        batch.update(clientRef, {
          balance: increment(cuentaCorrienteAmount)
        });
      }

      // 4. Update Cash Session (only cash/other immediate payments)
      const immediateAmount = currentPayments
        .filter(p => p.method !== 'Cuenta Corriente')
        .reduce((sum, p) => sum + p.amount, 0);

      if (immediateAmount > 0 && activeSession) {
        const sessionRef = doc(db, `tenants/${tenantId}/cash_sessions`, activeSession.id);
        batch.update(sessionRef, {
          final_amount: increment(immediateAmount)
        });
      }

      await batch.commit();
      
      setCart([]);
      setSelectedClientId('');
      setPaymentMethod('Efectivo');
      setSuccessMsg('¡Venta registrada con éxito!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Error al procesar la venta: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeSession) return;
    setExpenseProcessing(true);

    try {
      const amount = Number(expenseData.amount);
      if (amount <= 0 || !expenseData.description) {
        throw new Error("Monto y descripción son requeridos");
      }

      const batch = writeBatch(db);

      // 1. Create Expense Document
      const expenseRef = doc(collection(db, `tenants/${tenantId}/expenses`));
      batch.set(expenseRef, {
        description: expenseData.description,
        amount: amount,
        date: serverTimestamp(),
        sessionId: activeSession.id
      });

      // 2. Subtract from active cash session
      const sessionRef = doc(db, `tenants/${tenantId}/cash_sessions`, activeSession.id);
      batch.update(sessionRef, {
        final_amount: increment(-amount)
      });

      await batch.commit();

      setExpenseData({ description: '', amount: '' });
      setIsExpenseModalOpen(false);
      setSuccessMsg('Gasto registrado exitosamente');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      console.error("Expense error:", error);
      alert('Error al registrar gasto: ' + error.message);
    } finally {
      setExpenseProcessing(false);
    }
  };

  const handleOpenSession = async () => {
    if (!tenantId) return;
    try {
      await addDoc(collection(db, `tenants/${tenantId}/cash_sessions`), {
        openedAt: serverTimestamp(),
        initial_amount: 0,
        final_amount: 0,
        status: 'open'
      });
      setSuccessMsg('Caja abierta exitosamente');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      alert('Error al abrir caja: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left Panel: Catalog */}
      <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de barras o nombre..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E3222B] text-slate-700"
            />
          </div>
          {!activeSession ? (
            <button 
              onClick={handleOpenSession}
              className="flex items-center justify-center space-x-2 bg-green-100 hover:bg-green-200 text-green-700 px-4 py-3 rounded-xl font-medium transition-colors border border-green-200 shrink-0"
            >
              <Wallet className="w-5 h-5" />
              <span>Abrir Caja</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-medium transition-colors border border-slate-200 shrink-0"
            >
              <Wallet className="w-5 h-5 text-slate-500" />
              <span>Registrar Gasto</span>
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm cursor-pointer hover:border-[#E3222B] hover:shadow-md transition-all flex flex-col"
              >
                <div className="aspect-square bg-slate-50 rounded-lg mb-3 overflow-hidden border border-slate-100 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-mono mb-1">{product.code}</p>
                  <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight">{product.name}</h3>
                </div>
                <div className="mt-2 flex justify-between items-end">
                  <span className="font-bold text-[#3AAFA9]">${product.sale_price.toLocaleString()}</span>
                  <span className={`text-xs ${product.stock_actual <= product.stock_minimum ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    Stock: {product.stock_actual}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white shadow-xl z-10">
        <div className="p-4 border-b border-slate-200 bg-slate-800 text-white flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Venta Actual
            </h2>
            <span className="bg-slate-700 px-2 py-1 rounded text-xs font-medium">
              {cart.length} ítems
            </span>
          </div>
          
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E3222B] text-sm text-white appearance-none"
            >
              <option value="">Consumidor Final</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-2 relative group">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-6">
                    <h4 className="text-sm font-medium text-slate-800 leading-tight">{item.product.name}</h4>
                    <p className="text-xs text-slate-500">${item.product.sale_price.toLocaleString()} c/u</p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-l-lg">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-r-lg">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent || ''}
                        onChange={(e) => updateDiscount(item.product.id, Number(e.target.value))}
                        placeholder="0"
                        className="w-14 text-right pr-4 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#E3222B]"
                      />
                      <span className="absolute right-1 top-1 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right font-semibold text-slate-800 text-sm border-t border-slate-200 pt-2 mt-1">
                  ${((item.product.sale_price * item.quantity) * (1 - item.discountPercent / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          {successMsg && (
            <div className="mb-4 bg-green-100 text-green-700 p-3 rounded-lg text-sm flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {successMsg}
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Método de Pago</label>
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isSplitPayment} 
                  onChange={(e) => setIsSplitPayment(e.target.checked)} 
                  className="rounded border-slate-300 text-[#E3222B] focus:ring-[#E3222B]"
                />
                <span>Dividir pago</span>
              </label>
            </div>
            
            {!isSplitPayment ? (
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    disabled={method.id === 'Cuenta Corriente' && !selectedClientId}
                    title={method.id === 'Cuenta Corriente' && !selectedClientId ? 'Debe seleccionar un cliente' : ''}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs font-medium transition-colors ${
                      paymentMethod === method.id
                        ? 'bg-[#E3222B] text-white border-[#E3222B]'
                        : method.id === 'Cuenta Corriente' && !selectedClientId
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <method.icon className="w-4 h-4 mr-1.5" />
                    {method.id}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E3222B] bg-white"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.id} value={m.id} disabled={m.id === 'Cuenta Corriente' && !selectedClientId}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-1/3">
                    <span className="absolute left-2 top-2 text-xs text-slate-500">$</span>
                    <input 
                      type="number" 
                      min="0"
                      value={paymentAmount1}
                      onChange={(e) => setPaymentAmount1(e.target.value ? Number(e.target.value) : '')}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#E3222B]"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <select 
                    value={paymentMethod2}
                    onChange={(e) => setPaymentMethod2(e.target.value)}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E3222B] bg-white"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.id} value={m.id} disabled={m.id === 'Cuenta Corriente' && !selectedClientId}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-1/3 bg-slate-100 border border-slate-200 rounded-lg flex items-center px-2 py-2 text-xs text-slate-600 font-medium">
                    <span className="text-slate-400 mr-1">$</span>
                    {amount2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
            
            {currentPayments.some(p => p.method === 'Cuenta Corriente') && !selectedClientId && (
              <p className="text-[10px] text-red-500 mt-1">Seleccione un cliente para usar cuenta corriente</p>
            )}
          </div>

          <div className="flex items-end justify-between mb-4">
            <span className="text-slate-500 font-medium">Total a cobrar</span>
            <span className="text-3xl font-bold text-slate-800">
              ${cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={!activeSession || cart.length === 0 || isProcessing || (currentPayments.some(p => p.method === 'Cuenta Corriente') && !selectedClientId) || amount1 + amount2 < cartTotal}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center ${
              !activeSession || cart.length === 0 || isProcessing || (currentPayments.some(p => p.method === 'Cuenta Corriente') && !selectedClientId) || amount1 + amount2 < cartTotal
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-[#3AAFA9] to-[#2B7A78] hover:from-[#2B7A78] hover:to-[#1f5c5a] hover:shadow-xl'
            }`}
          >
            {!activeSession ? 'Abre la caja primero' : isProcessing ? 'Procesando...' : 'Confirmar Venta'}
          </button>
        </div>
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-slate-500" />
                Registrar Gasto de Caja
              </h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRegisterExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto / Descripción</label>
                <input 
                  type="text" 
                  required
                  value={expenseData.description}
                  onChange={e => setExpenseData({...expenseData, description: e.target.value})}
                  placeholder="Ej: Flete, viáticos, compra insumos..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3AAFA9] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto Retirado ($)</label>
                <input 
                  type="number" 
                  required
                  min="0.01"
                  step="0.01"
                  value={expenseData.amount}
                  onChange={e => setExpenseData({...expenseData, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3AAFA9] focus:outline-none font-mono"
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={expenseProcessing}
                  className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
                    expenseProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {expenseProcessing ? 'Registrando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
