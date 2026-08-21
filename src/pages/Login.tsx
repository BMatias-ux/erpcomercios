import React from "react";
import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            <span className="text-[#E3222B] font-bold text-2xl italic">FX</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          {isLogin ? 'Ingresa a tu cuenta' : 'Crea una cuenta'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleEmailAuth}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[#E3222B] focus:border-[#E3222B] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Contraseña</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[#E3222B] focus:border-[#E3222B] sm:text-sm"
                />
              </div>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#E3222B] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E3222B]"
              >
                {isLogin ? 'Ingresar' : 'Registrarse'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">O continuar con</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleAuth}
                className="w-full inline-flex justify-center py-2 px-4 border border-slate-300 rounded-md shadow-sm bg-white text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                Google
              </button>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-[#E3222B] hover:text-red-700">
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
