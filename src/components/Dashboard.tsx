import { 
  Banknote, 
  Package, 
  TrendingUp, 
  ClipboardList,
  Plus
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const dailySalesData = [
  { day: '1', amount: 20000 }, { day: '2', amount: 35000 }, { day: '3', amount: 48000 },
  { day: '4', amount: 55000 }, { day: '5', amount: 33000 }, { day: '6', amount: 35000 },
  { day: '7', amount: 62000 }, { day: '8', amount: 45000 }, { day: '9', amount: 78000 },
  { day: '10', amount: 45000 }, { day: '11', amount: 55000 }, { day: '12', amount: 50000 },
  { day: '13', amount: 53000 }, { day: '14', amount: 72000 }, { day: '15', amount: 51000 },
  { day: '16', amount: 65000 }, { day: '17', amount: 78000 }, { day: '18', amount: 68000 },
  { day: '19', amount: 75000 }, { day: '20', amount: 52000 }, { day: '21', amount: 95000 },
  { day: '22', amount: 102000 }, { day: '23', amount: 75000 }, { day: '24', amount: 71000 },
  { day: '25', amount: 82000 }, { day: '26', amount: 88000 },
];

const inventoryData = [
  { name: 'Eléctricas', value: 400 },
  { name: 'Manuales', value: 300 },
  { name: 'Medición', value: 300 },
  { name: 'Seguridad', value: 200 },
  { name: 'Almacenamiento', value: 100 },
];
const COLORS = ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

const topProducts = [
  { code: 'C0001001', name: 'Martillo de Uña Pro', qty: 37, total: '$1.250.000' },
  { code: 'C0001002', name: 'Taladro Inalámbrico 20V', qty: 20, total: '$150.000' },
  { code: 'C0001003', name: 'Juego de Destornilladores', qty: 10, total: '$100.000' },
  { code: 'C0001004', name: 'Sierra Circular Pro', qty: 3, total: '$55.000' },
  { code: 'C0001005', name: 'Caja de Herramientas Metálica', qty: 2, total: '$50.000' },
];

const recentOrders = [
  { id: '500011', client: 'Carlos Vargas', date: '12/Jul/2024', total: '$1.250.000', status: 'Enviado' },
  { id: '500022', client: 'Constructora Alfa', date: '20/Jul/2024', total: '$550.000', status: 'Pendiente' },
  { id: '500023', client: 'Ferretería Central', date: '22/Jul/2024', total: '$555.000', status: 'Pendiente' },
  { id: '500024', client: 'Juan Pérez', date: '12/Jul/2024', total: '$110.000', status: 'Enviado' },
  { id: '500025', client: 'Obras y Servicios', date: '12/Jul/2024', total: '$1.250.000', status: 'Pendiente' },
];

export function Dashboard() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard de Gestión - Julio 2024</h1>
          <p className="text-sm text-slate-500 mt-1">Resumen general del estado de la empresa.</p>
        </div>
        <button className="w-full sm:w-auto bg-gradient-to-r from-[#3AAFA9] to-[#2B7A78] hover:from-[#2B7A78] hover:to-[#1f5c5a] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-md flex items-center justify-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Registrar gasto</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          icon={Banknote} 
          title="Ventas Totales del Mes" 
          value="$1.250.000" 
          subtitle="Ventas acumuladas" 
          iconBg="bg-blue-100" 
          iconColor="text-blue-600" 
        />
        <KpiCard 
          icon={Package} 
          title="Stock Actual de Artículos" 
          value="450" 
          subtitle="Total de ítems" 
          iconBg="bg-slate-100" 
          iconColor="text-slate-600" 
        />
        <KpiCard 
          icon={TrendingUp} 
          title="Margen de Ganancia Promedio" 
          value="28%" 
          subtitle="Pesos Argentinos" 
          iconBg="bg-orange-100" 
          iconColor="text-orange-600" 
        />
        <KpiCard 
          icon={ClipboardList} 
          title="Pedidos Pendientes" 
          value="12" 
          subtitle="Para entrega hoy" 
          iconBg="bg-amber-100" 
          iconColor="text-amber-600" 
        />
      </div>

      {/* Charts & Tables Section 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Ventas Diarias - Tendencia del Mes</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#475569" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#475569" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                  labelFormatter={(label) => `Día ${label}`}
                />
                <Area type="monotone" dataKey="amount" stroke="#475569" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Productos Más Vendidos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="pb-3 font-medium">Producto</th>
                  <th className="pb-3 font-medium text-right">Cant.</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-3">
                      <div className="font-medium text-slate-800 truncate max-w-[120px]" title={p.name}>{p.name}</div>
                      <div className="text-xs text-slate-400">{p.code}</div>
                    </td>
                    <td className="py-3 text-right font-medium text-slate-700">{p.qty}</td>
                    <td className="py-3 text-right font-semibold text-slate-800">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tables & Charts Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Pedidos Recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 bg-slate-50 rounded-t-lg">
                  <th className="px-4 py-3 font-medium rounded-tl-lg">ID</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium rounded-tr-lg">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500">{o.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{o.client}</td>
                    <td className="px-4 py-3 text-slate-500">{o.date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{o.total}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        o.status === 'Enviado' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Status Pie Chart */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Estado del Inventario</h2>
          <div className="flex items-center h-[250px]">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {inventoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-50% flex flex-col justify-center space-y-2 pl-4">
              {inventoryData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, subtitle, iconBg, iconColor }: { icon: any, title: string, value: string, subtitle: string, iconBg: string, iconColor: string }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
