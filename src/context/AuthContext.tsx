import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  tenantId: string | null;
  userRole: string | null;
  tenantData: any | null;
  setTenantId: (id: string | null) => void;
  setUserRole: (role: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  tenantId: null,
  userRole: null,
  tenantData: null,
  setTenantId: () => {},
  setUserRole: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const savedTenantId = localStorage.getItem('activeTenantId');
        if (savedTenantId) {
          try {
            const roleDoc = await getDoc(doc(db, `tenants/${savedTenantId}/users/${currentUser.uid}`));
            if (roleDoc.exists()) {
              setTenantId(savedTenantId);
              setUserRole(roleDoc.data().role);
            } else {
              setTenantId(null);
              setUserRole(null);
            }
          } catch (e) {
            setTenantId(null);
            setUserRole(null);
            localStorage.removeItem('activeTenantId');
          }
        }
      } else {
        setTenantId(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to tenant data changes
  useEffect(() => {
    if (!tenantId) {
      setTenantData(null);
      return;
    }
    
    const unsubscribe = onSnapshot(doc(db, 'tenants', tenantId), (docSnap) => {
      if (docSnap.exists()) {
        setTenantData(docSnap.data());
      } else {
        setTenantData(null);
      }
    }, (error) => {
      console.warn("Tenant listener error:", error);
    });
    
    return () => unsubscribe();
  }, [tenantId]);

  const handleSetTenantId = (id: string | null) => {
    setTenantId(id);
    if (id) {
      localStorage.setItem('activeTenantId', id);
    } else {
      localStorage.removeItem('activeTenantId');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, tenantId, userRole, tenantData, setTenantId: handleSetTenantId, setUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
