import { useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, PackageX, UserMinus, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';

interface NotificationItem {
  id: string;
  type: 'stock' | 'debt';
  title: string;
  message: string;
  link: string;
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { tenantId, tenantData } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Track notified IDs so we don't spam the browser push notifications
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Helper to trigger browser push notification
  const triggerPushNotification = (notif: NotificationItem) => {
    if (!('Notification' in window)) return;
    
    // Only show if permission is granted and we haven't shown it yet
    if (Notification.permission === 'granted' && !notifiedIdsRef.current.has(notif.id)) {
      notifiedIdsRef.current.add(notif.id);
      
      try {
        const notification = new Notification(notif.title, {
          body: notif.message,
          icon: '/favicon.ico', // You can replace with your actual icon
          tag: notif.id,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn("Could not show notification:", e);
      }
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    // Listen to low stock
    const productsQ = query(collection(db, `tenants/${tenantId}/products`));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const lowStock: NotificationItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.stock_actual <= data.stock_minimum) {
          const item: NotificationItem = {
            id: `stock-${doc.id}`,
            type: 'stock',
            title: 'Stock Mínimo',
            message: `${data.name} tiene ${data.stock_actual} unidades (Mín: ${data.stock_minimum}).`,
            link: '/inventario'
          };
          lowStock.push(item);
          triggerPushNotification(item);
        }
      });
      setNotifications(prev => {
        const others = prev.filter(n => n.type !== 'stock');
        return [...others, ...lowStock];
      });
    }, (error) => {
      console.warn("Products listener error (might be offline):", error);
    });

    // Listen to debts (cuenta corriente)
    const clientsQ = query(collection(db, `tenants/${tenantId}/clients`), where('balance', '>', 0));
    const unsubscribeClients = onSnapshot(clientsQ, (snapshot) => {
      const debts: NotificationItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const item: NotificationItem = {
          id: `debt-${doc.id}`,
          type: 'debt',
          title: 'Cuenta Corriente',
          message: `${data.name} adeuda $${data.balance.toLocaleString('es-AR')}.`,
          link: '/clientes'
        };
        debts.push(item);
        triggerPushNotification(item);
      });
      
      setNotifications(prev => {
        const others = prev.filter(n => n.type !== 'debt');
        return [...others, ...debts];
      });
    }, (error) => {
      console.warn("Clients listener error (might be offline):", error);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeClients();
    };
  }, [tenantId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center space-x-4 sm:space-x-6 w-full max-w-4xl">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* Branch Selector */}
        <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-md transition-colors">
          <span className="text-sm font-semibold text-slate-700 max-w-[150px] sm:max-w-[250px] truncate" title={tenantData?.name || 'Mi Comercio'}>
            {tenantData?.name || 'Mi Comercio'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
        </div>

        {/* Global Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#E3222B] focus:ring-1 focus:ring-[#E3222B] sm:text-sm transition-colors"
            placeholder="Buscar por nombre o código de artículo..."
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Notificaciones</h3>
                <span className="text-xs font-medium bg-[#3AAFA9]/10 text-[#2B7A78] px-2 py-1 rounded-full">
                  {notifications.length} alertas
                </span>
              </div>
              <div className="max-h-[24rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                    <Bell className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm">No tienes notificaciones pendientes.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notif) => (
                      <Link 
                        key={notif.id} 
                        to={notif.link}
                        onClick={() => setIsDropdownOpen(false)}
                        className="p-4 flex items-start hover:bg-slate-50 transition-colors block"
                      >
                        <div className={`p-2 rounded-full mr-3 shrink-0 ${
                          notif.type === 'stock' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {notif.type === 'stock' ? <PackageX className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
                          <p className="text-xs text-slate-500 mt-1 leading-snug">{notif.message}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="w-8 h-8 bg-[#3AAFA9] rounded-full flex items-center justify-center text-white font-medium text-sm shadow-sm cursor-pointer">
          CV
        </div>
      </div>
    </header>
  );
}
