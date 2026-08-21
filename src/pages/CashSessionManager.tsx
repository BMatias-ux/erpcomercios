import React from "react";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, serverTimestamp, orderBy, where, writeBatch, increment } from 'firebase/firestore';
import { Wallet, Plus, X, Lock, Calculator, ArrowDownCircle, ArrowUpCircle, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';

interface CashSession {
  id: string;
  openedAt: any;
  closedAt?: any;
  initial_amount: number;
  final_amount: number; // This acts as the expected amount (computed by sales/expenses)
  declared_amount?: number;
  difference?: number;
  status: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: any;
  sessionId: string;
}

export function CashSessionManager() {
  const { tenantId, userRole } = useAuth();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  
  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  
  // Forms state
  const [initialAmount, setInitialAmount] = useState<number | ''>('');
  const [expenseData, setExpenseData] = useState({ description: '', amount: '' });
  const [declaredAmount, setDeclaredAmount] = useState<number | ''>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const canManage = userRole === 'admin' || userRole === 'seller';

  useEffect(() => {
    if (!tenantId) return;

    // Fetch all sessions (we'll sort in client if orderBy fails due to missing index, but let's try orderBy first)
    const q = query(
      collection(db, `tenants/${tenantId}/cash_sessions`),
      orderBy('openedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData: CashSession[] = [];
      let active: CashSession | null = null;
      
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as CashSession;
        sessionData.push(data);
        if (data.status === 'open') {
          active = data;
        }
      });
      
      setSessions(sessionData);
      setActiveSession(active);
    }, (error) => {
      console.error("Error fetching sessions:", error);
      // Fallback without orderBy if index is missing
      if (error.message.includes('index')) {
        const fallbackQ = query(collection(db, `tenants/${tenantId}/cash_sessions`));
        onSnapshot(fallbackQ, (fallbackSnap) => {
          const sessionData: CashSession[] = [];
          let active: CashSession | null = null;
          fallbackSnap.forEach((doc) => {
            const data = { id: doc.id, ...doc.data() } as CashSession;
            sessionData.push(data);
            if (data.status === 'open') {
              active = data;
            }
          });
          sessionData.sort((a, b) => {
            const timeA = a.openedAt?.toMillis() || 0;
            const timeB = b.openedAt?.toMillis() || 0;
            return timeB - timeA;
          });
          setSessions(sessionData);
          setActiveSession(active);
        });
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsProcessing(true);
    
    try {
      const amount = Number(initialAmount) || 0;
      await addDoc(collection(db, `tenants/${tenantId}/cash_sessions`), {
        openedAt: serverTimestamp(),
        initial_amount: amount,
        final_amount: amount,
        status: 'open'
      });
      setInitialAmount('');
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeSession) return;
    setIsProcessing(true);

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
    } catch (error: any) {
      alert('Error al registrar gasto: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeSession) return;
    setIsProcessing(true);

    try {
      const actualDeclared = Number(declaredAmount) || 0;
      const difference = actualDeclared - activeSession.final_amount;

      await updateDoc(doc(db, `tenants/${tenantId}/cash_sessions`, activeSession.id), {
        status: 'closed',
        closedAt: serverTimestamp(),
        declared_amount: actualDeclared,
        difference: difference
      });

      setDeclaredAmount('');
      setIsCloseModalOpen(false);
    } catch (error: any) {
      alert('Error al cerrar caja: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    return timestamp.toDate().toLocaleString('es-AR');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Control de Caja Diaria</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona aperturas, gastos y arqueo (cierre) de caja.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          {errorMsg}
        </div>
      )}

      {/* Active Session Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Wallet className="w-6 h-6 text-[#3AAFA9]" />
          <h2 className="text-xl font-semibold text-slate-800">Caja Actual</h2>
        </div>

        {!activeSession ? (
          <div className="max-w-md">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 flex items-center">
                No hay ninguna caja abierta en este momento.
              </p>
            </div>
            
            {canManage && (
              <form onSubmit={handleOpenSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto Inicial en Caja ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    placeholder="Ej: 5000.00"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3AAFA9] focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-white shadow-sm flex justify-center items-center ${
                    isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isProcessing ? 'Procesando...' : 'Abrir Caja Diaria'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Estado</p>
              <div className="flex items-center text-green-600 font-bold">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                ABIERTA
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Desde: {formatDate(activeSession.openedAt)}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Saldo Inicial</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(activeSession.initial_amount)}</p>
            </div>

            <div className="p-4 bg-[#3AAFA9]/10 rounded-xl border border-[#3AAFA9]/20">
              <p className="text-xs font-semibold text-[#2B7A78] uppercase tracking-wider mb-1">Saldo Esperado (Sistema)</p>
              <p className="text-2xl font-bold text-[#3AAFA9]">{formatCurrency(activeSession.final_amount)}</p>
              <p className="text-[10px] text-[#2B7A78] mt-1">Suma de ventas e ingresos menos gastos</p>
            </div>

            <div className="flex flex-col gap-3 justify-center">
              {canManage && (
                <>
                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center border border-slate-200"
                  >
                    <ArrowDownCircle className="w-4 h-4 mr-2 text-slate-500" />
                    Registrar Gasto
                  </button>
                  <button
                    onClick={() => setIsCloseModalOpen(true)}
                    className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors flex items-center justify-center shadow-sm"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Cerrar y Arquear
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Historial de Sesiones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Apertura</th>
                <th className="px-4 py-3 font-medium">Cierre</th>
                <th className="px-4 py-3 font-medium text-right">Saldo Inicial</th>
                <th className="px-4 py-3 font-medium text-right">Total Sistema</th>
                <th className="px-4 py-3 font-medium text-right">Monto Declarado</th>
                <th className="px-4 py-3 font-medium text-right">Diferencia</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sessions.filter(s => s.status !== 'open').length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <Calculator className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>No hay historial de cajas cerradas.</p>
                  </td>
                </tr>
              ) : (
                sessions.filter(s => s.status !== 'open').map((session) => (
                  <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(session.openedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(session.closedAt)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(session.initial_amount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(session.final_amount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(session.declared_amount || 0)}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {(session.difference ?? 0) === 0 ? (
                        <span className="text-slate-400">Cuadre exacto</span>
                      ) : (session.difference ?? 0) > 0 ? (
                        <span className="text-green-600">+{formatCurrency(session.difference!)}</span>
                      ) : (
                        <span className="text-red-600">{formatCurrency(session.difference!)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        CERRADA
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <ArrowDownCircle className="w-5 h-5 mr-2 text-slate-500" />
                Registrar Gasto
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
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
                    isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isProcessing ? 'Registrando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {isCloseModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white">
              <h2 className="text-lg font-bold flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Arqueo y Cierre de Caja
              </h2>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCloseSession} className="p-6 space-y-6">
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Según el sistema, el saldo esperado es:</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(activeSession.final_amount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ¿Cuánto dinero físico/efectivo contaste realmente? (Monto Declarado)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    value={declaredAmount}
                    onChange={e => setDeclaredAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3AAFA9] focus:outline-none font-mono text-lg"
                  />
                </div>
              </div>

              {declaredAmount !== '' && (
                <div className={`p-4 rounded-lg border ${
                  Number(declaredAmount) - activeSession.final_amount === 0 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : Number(declaredAmount) - activeSession.final_amount > 0 
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <p className="text-sm font-medium mb-1">Diferencia de Arqueo:</p>
                  <p className="text-xl font-bold flex items-center">
                    {Number(declaredAmount) - activeSession.final_amount === 0 && <CheckCircle2 className="w-5 h-5 mr-2" />}
                    {Number(declaredAmount) - activeSession.final_amount > 0 && <span className="mr-1">+</span>}
                    {formatCurrency(Number(declaredAmount) - activeSession.final_amount)}
                  </p>
                  <p className="text-xs mt-1 opacity-80">
                    {Number(declaredAmount) - activeSession.final_amount === 0 && '¡Cuadre perfecto!'}
                    {Number(declaredAmount) - activeSession.final_amount > 0 && 'Sobra dinero en la caja con respecto al sistema.'}
                    {Number(declaredAmount) - activeSession.final_amount < 0 && 'Falta dinero en la caja con respecto al sistema.'}
                  </p>
                </div>
              )}

              <div className="pt-2 flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsCloseModalOpen(false)}
                  className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessing || declaredAmount === ''}
                  className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
                    isProcessing || declaredAmount === '' ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 shadow-md'
                  }`}
                >
                  {isProcessing ? 'Cerrando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
