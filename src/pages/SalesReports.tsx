import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Package } from 'lucide-react';

interface Sale {
  id: string;
  total: number;
  date: any;
  payments: Array<{ method: string; amount: number }>;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

const COLORS = ['#3AAFA9', '#2B7A78', '#E3222B', '#17252A', '#8E8D8A', '#E27D60', '#85CDCA'];

export function SalesReports() {
  const { tenantId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    // Fetch all sales ordered by date
    const q = query(
      collection(db, `tenants/${tenantId}/sales`),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData: Sale[] = [];
      snapshot.forEach((doc) => {
        salesData.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(salesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sales:", error);
      // Fallback without orderBy if index is missing
      if (error.message.includes('index')) {
        const fallbackQ = query(collection(db, `tenants/${tenantId}/sales`));
        onSnapshot(fallbackQ, (fallbackSnap) => {
          const salesData: Sale[] = [];
          fallbackSnap.forEach((doc) => {
            salesData.push({ id: doc.id, ...doc.data() } as Sale);
          });
          salesData.sort((a, b) => {
            const timeA = a.date?.toMillis() || 0;
            const timeB = b.date?.toMillis() || 0;
            return timeA - timeB; // Ascending
          });
          setSales(salesData);
          setLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Process data for Daily Sales Chart
  const dailySalesData = useMemo(() => {
    const grouped = sales.reduce((acc: any, sale) => {
      if (!sale.date) return acc;
      const dateObj = sale.date.toDate();
      const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      if (!acc[dateStr]) {
        acc[dateStr] = 0;
      }
      acc[dateStr] += sale.total;
      return acc;
    }, {});

    return Object.keys(grouped).map(date => ({
      date,
      total: grouped[date]
    }));
  }, [sales]);

  // Process data for Top Selling Products Chart
  const topProductsData = useMemo(() => {
    const grouped = sales.reduce((acc: any, sale) => {
      if (!sale.items) return acc;
      sale.items.forEach(item => {
        if (!acc[item.name]) {
          acc[item.name] = 0;
        }
        acc[item.name] += item.quantity;
      });
      return acc;
    }, {});

    const sorted = Object.keys(grouped)
      .map(name => ({ name, quantity: grouped[name] }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // Top 5

    return sorted;
  }, [sales]);

  // Process data for Payment Methods Chart
  const paymentMethodsData = useMemo(() => {
    const grouped = sales.reduce((acc: any, sale) => {
      if (!sale.payments) return acc;
      sale.payments.forEach(payment => {
        if (!acc[payment.method]) {
          acc[payment.method] = 0;
        }
        acc[payment.method] += payment.amount;
      });
      return acc;
    }, {});

    return Object.keys(grouped).map(method => ({
      name: method,
      value: grouped[method]
    }));
  }, [sales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3AAFA9]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Reportes y Estadísticas</h1>
        <p className="text-sm text-slate-500 mt-1">Analiza el rendimiento de ventas y preferencias de pago.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Sales Line Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
          <div className="flex items-center mb-6">
            <TrendingUp className="w-5 h-5 text-[#3AAFA9] mr-2" />
            <h2 className="text-lg font-bold text-slate-800">Rendimiento de Ventas (Diario)</h2>
          </div>
          <div className="h-80 w-full">
            {dailySalesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(val) => `$${val}`} tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                    labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#3AAFA9" strokeWidth={3} dot={{ fill: '#2B7A78', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No hay datos de ventas disponibles</div>
            )}
          </div>
        </div>

        {/* Top Selling Products Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center mb-6">
            <Package className="w-5 h-5 text-[#3AAFA9] mr-2" />
            <h2 className="text-lg font-bold text-slate-800">Productos Más Vendidos (Top 5)</h2>
          </div>
          <div className="h-64 w-full">
            {topProductsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number) => [value, 'Unidades Vendidas']}
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="quantity" fill="#3AAFA9" radius={[4, 4, 0, 0]}>
                    {topProductsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm text-center">
                <p>No hay datos de productos.</p>
                <p className="text-xs opacity-70 mt-1">Asegúrate de haber registrado ventas nuevas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center mb-6">
            <PieChartIcon className="w-5 h-5 text-[#3AAFA9] mr-2" />
            <h2 className="text-lg font-bold text-slate-800">Distribución por Método de Pago</h2>
          </div>
          <div className="h-64 w-full">
            {paymentMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No hay datos de pagos disponibles</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
