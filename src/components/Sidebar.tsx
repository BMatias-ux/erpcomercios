import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  Truck,
  Calculator,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  X,
  FileText
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Punto de Venta', icon: Plus, path: '/tpv' },
  { name: 'Inventario', icon: Package, path: '/inventario' },
  { name: 'Pedidos', icon: ClipboardList, path: '/pedidos' },
  { name: 'Clientes', icon: Users, path: '/clientes' },
  { name: 'Proveedores', icon: Truck, path: '/proveedores' },
  { name: 'Caja Diaria', icon: Calculator, path: '/contabilidad' },
  { name: 'Historial Ventas', icon: FileText, path: '/historial' },
  { name: 'Reportes', icon: BarChart3, path: '/reportes' },
  { name: 'Ajustes', icon: Settings, path: '/ajustes' },
];

export function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { user, userRole, tenantData, setTenantId, setUserRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    setTenantId(null);
    setUserRole(null);
    navigate('/login');
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={cn(
        "w-64 bg-[#1E1E1E] text-slate-300 flex flex-col h-screen fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      {/* Logo Area */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          {tenantData?.logoUrl ? (
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-700 shrink-0">
              <img src={tenantData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 shrink-0">
              <span className="text-[#E3222B] font-bold text-xl italic">
                {tenantData?.name ? tenantData.name.substring(0, 2).toUpperCase() : 'FX'}
              </span>
            </div>
          )}
          <span className="text-white font-semibold text-xl tracking-wide truncate" title={tenantData?.name || 'Flexxus'}>
            {tenantData?.name || 'Flexxus'}
          </span>
        </div>
        
        {/* Close Button for Mobile */}
        <button 
          onClick={onClose}
          className="lg:hidden p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* User Profile */}
      <div className="px-6 pb-6 mb-4 border-b border-slate-700/50 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
          {user?.photoURL ? (
             <img src={user.photoURL} alt="User profile" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <Users className="w-5 h-5 text-slate-300" />
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-white text-sm font-medium truncate">{user?.displayName || user?.email?.split('@')[0] || 'Usuario'}</span>
          <span className="text-xs text-slate-400 capitalize">{userRole || 'Invitado'}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-slate-800 text-white border-l-4 border-[#E3222B]" 
                  : "hover:bg-slate-800/50 hover:text-white"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}

        <div className="pt-6 pb-2">
          <button onClick={() => { navigate('/tpv'); if(onClose) onClose(); }} className="w-full flex items-center justify-center space-x-2 bg-[#E3222B] hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Punto de Venta</span>
          </button>
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-700/50 space-y-1">
        <button onClick={() => { navigate('/ajustes'); if(onClose) onClose(); }} className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full hover:bg-slate-800/50 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
          <span>Ajustes</span>
        </button>
        <button onClick={handleLogout} className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
    </>
  );
}
