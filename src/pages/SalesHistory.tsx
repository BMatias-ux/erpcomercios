import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, serverTimestamp, where, increment } from 'firebase/firestore';
import { Search, FileText, ArrowLeftRight, CheckCircle2, XCircle, ChevronLeft, Eye, RefreshCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

interface Sale {
  id: string;
  clientId: string;
  clientName: string;
  type: 'sale' | 'credit_note';
  originalSaleId?: string;
  date: any;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  items?: Array<{ id: string; name: string; quantity: number; price: number }>;
  status: string;
}

export function SalesHistory() {
  const { tenantId, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [activeSession, setActiveSession] = useState<any>(null);

  // Modal State
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

    const qSales = query(
      collection(db, `tenants/${tenantId}/sales`),
      orderBy('date', 'desc')
    );

    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const salesData: Sale[] = [];
      snapshot.forEach(doc => {
        salesData.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(salesData);
    });

    return () => {
      unsubSession();
      unsubSales();
    };
  }, [tenantId]);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    return sales.filter(s => 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.clientName && s.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sales, searchTerm]);

  const handleOpenDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailOpen(true);
  };

  const handleCreateCreditNote = async (sale: Sale) => {
    if (!tenantId || !userRole || userRole !== 'admin') {
      alert('No tienes permisos para anular ventas.');
      return;
    }
    
    if (sale.type === 'credit_note' || sale.status === 'refunded') {
      alert('Esta venta ya fue anulada o es una nota de crédito.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas anular esta venta y generar una Nota de Crédito por $${sale.total.toLocaleString()}?`)) {
      return;
    }

    if (!activeSession) {
      alert('Debes tener una caja abierta para emitir una nota de crédito y procesar el rembolso.');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);

      // 1. Create Credit Note Document
      const cnRef = doc(collection(db, `tenants/${tenantId}/sales`));
      batch.set(cnRef, {
        clientId: sale.clientId,
        clientName: sale.clientName,
        type: 'credit_note',
        originalSaleId: sale.id,
        date: serverTimestamp(),
        total: sale.total,
        payments: sale.payments, // Keeping original payments reference for the credit note
        items: sale.items || [],
        status: 'completed'
      });

      // 2. Mark Original Sale as Refunded
      const origRef = doc(db, `tenants/${tenantId}/sales`, sale.id);
      batch.update(origRef, { status: 'refunded' });

      // 3. Restock Items
      if (sale.items) {
        for (const item of sale.items) {
          if (!item.id) continue;
          const prodRef = doc(db, `tenants/${tenantId}/products`, item.id);
          batch.update(prodRef, {
            stock_actual: increment(item.quantity)
          });
        }
      }

      // 4. Update Client Balance if "Cuenta Corriente" was used
      const cuentaCorrienteAmount = sale.payments
        ?.filter(p => p.method === 'Cuenta Corriente')
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      if (cuentaCorrienteAmount > 0 && sale.clientId !== 'consumidor_final') {
        const clientRef = doc(db, `tenants/${tenantId}/clients`, sale.clientId);
        batch.update(clientRef, {
          balance: increment(-cuentaCorrienteAmount) // Reduce the debt since the sale is annulled
        });
      }

      // 5. Update Cash Session (subtract immediate payments from final_amount)
      const immediateAmount = sale.payments
        ?.filter(p => p.method !== 'Cuenta Corriente')
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      if (immediateAmount > 0) {
        const sessionRef = doc(db, `tenants/${tenantId}/cash_sessions`, activeSession.id);
        batch.update(sessionRef, {
          final_amount: increment(-immediateAmount)
        });
      }

      await batch.commit();
      setIsDetailOpen(false);
      setSelectedSale(null);
    } catch (error) {
      console.error(error);
      alert('Error al generar la nota de crédito');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Historial de Ventas</h1>
          <p className="text-sm text-slate-500 mt-1">Consulta comprobantes, anula ventas y emite notas de crédito.</p>
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
              placeholder="Buscar por cliente o ID..."
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">ID Transacción</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-600">
                    {sale.date ? new Date(sale.date.seconds * 1000).toLocaleString('es-AR') : '...'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {sale.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sale.clientName}</td>
                  <td className="px-4 py-3">
                    {sale.type === 'credit_note' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        Nota de Crédito
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        Venta
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(sale.total)}</td>
                  <td className="px-4 py-3">
                    {sale.status === 'refunded' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                        Anulada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                        Completada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => handleOpenDetail(sale)}
                      className="p-2 text-slate-400 hover:text-[#3AAFA9] hover:bg-[#3AAFA9]/10 rounded-lg transition-colors"
                      title="Ver Detalles"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron transacciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {isDetailOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${selectedSale.type === 'credit_note' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                  {selectedSale.type === 'credit_note' ? <ArrowLeftRight className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {selectedSale.type === 'credit_note' ? 'Detalle de Nota de Crédito' : 'Detalle de Venta'}
                  </h2>
                  <p className="text-sm text-slate-500">ID: {selectedSale.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium uppercase">Cliente</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedSale.clientName}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium uppercase">Fecha</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedSale.date ? new Date(selectedSale.date.seconds * 1000).toLocaleString('es-AR') : '...'}
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-slate-800 mb-3">Artículos</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Producto</th>
                      <th className="px-4 py-2 font-medium text-right">Cant.</th>
                      <th className="px-4 py-2 font-medium text-right">Precio Unit.</th>
                      <th className="px-4 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSale.items?.map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-2">Métodos de Pago</h3>
                  <div className="space-y-1">
                    {selectedSale.payments?.map((p, i) => (
                      <div key={i} className="text-sm flex items-center space-x-2 text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>{p.method}: <strong>{formatCurrency(p.amount)}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-500 font-medium mb-1">Total Transacción</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(selectedSale.total)}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-xl">
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
              
              {selectedSale.type === 'sale' && selectedSale.status !== 'refunded' && userRole === 'admin' && (
                <button 
                  onClick={() => handleCreateCreditNote(selectedSale)}
                  disabled={isProcessing}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4" />
                  )}
                  <span>Anular y Emitir Nota de Crédito</span>
                </button>
              )}
              {selectedSale.status === 'refunded' && (
                <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                  Venta Anulada
                </span>
              )}
              {selectedSale.type === 'credit_note' && (
                <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                  Nota de Crédito Generada
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
