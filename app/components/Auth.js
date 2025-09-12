'use client';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClientComponentClient();

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState('sign-in'); // sign-in, sign-up

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      toast.success('¡Has iniciado sesión con éxito!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
      toast.success('¡Registro exitoso! Revisa tu email para confirmar tu cuenta.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isSigningIn = view === 'sign-in';

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-neutral-900 rounded-xl border border-neutral-800">
      <h2 className="text-xl font-bold text-white mb-4">
        {isSigningIn ? 'Iniciar Sesión' : 'Registrarse'}
      </h2>
      <form onSubmit={isSigningIn ? handleSignIn : handleSignUp} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 rounded bg-neutral-800 text-neutral-200 w-full"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 rounded bg-neutral-800 text-neutral-200 w-full"
          required
        />
        <button
          type="submit"
          className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded text-neutral-100 transition-colors"
        >
          {isSigningIn ? 'Iniciar Sesión' : 'Registrarse'}
        </button>
      </form>
      <button
        onClick={() => setView(isSigningIn ? 'sign-up' : 'sign-in')}
        className="text-neutral-500 mt-4 text-sm"
      >
        {isSigningIn ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Inicia sesión'}
      </button>
    </div>
  );
}