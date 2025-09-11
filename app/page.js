'use client';
import { useState, useEffect } from 'react';
import {
  createClientComponentClient
} from '@supabase/auth-helpers-nextjs';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const supabase = createClientComponentClient();
  const [cryptoData, setCryptoData] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState('bitcoin');
  const [alertType, setAlertType] = useState('above');
  const [alertValue, setAlertValue] = useState('');
  const [email, setEmail] = useState('');

  const cryptoNames = ['bitcoin', 'ethereum', 'ripple', 'cardano', 'solana'];

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        router.push('/');
      }
    };
    fetchSession();
  }, [supabase, router]);

  useEffect(() => {
    const fetchCryptoData = async () => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,cardano,solana&vs_currencies=usd'
      );
      const data = await response.json();
      setCryptoData(data);
    };

    fetchCryptoData();
    const interval = setInterval(fetchCryptoData, 10000); // 10 segundos
    return () => clearInterval(interval);
  }, []);

  const handleRegisterAlert = async e => {
    e.preventDefault();
    console.log('Botón de alerta presionado'); // <-- Esta es la línea que añadimos
    if (!session) {
      alert('Debes iniciar sesión para registrar una alerta.');
      return;
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: session.user.email,
          coin: selectedCoin,
          alert_type: alertType,
          alert_value: parseFloat(alertValue)
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('¡Alerta registrada con éxito! Revisa tu email.');
        setAlertValue('');
      } else {
        alert('Error al registrar la alerta: ' + data.message);
      }
    } catch (error) {
      console.error('Error al registrar la alerta:', error);
      alert('Error de conexión. Por favor, inténtalo de nuevo.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Trading Dashboard</h1>
        {session && (
          <div className={styles.userContainer}>
            <span className={styles.userEmail}>{session.user.email}</span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.dataContainer}>
          {cryptoNames.map(name => (
            <div key={name} className={styles.cryptoCard}>
              <h2>{name.charAt(0).toUpperCase() + name.slice(1)}</h2>
              {cryptoData[name] && (
                <p>
                  Precio: ${' '}
                  {cryptoData[name].usd
                    ? cryptoData[name].usd.toLocaleString()
                    : 'Cargando...'}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className={styles.formContainer}>
          <h2>Registrar una nueva alerta</h2>
          <form onSubmit={handleRegisterAlert} className={styles.alertForm}>
            <label htmlFor="coin">Selecciona la moneda:</label>
            <select
              id="coin"
              value={selectedCoin}
              onChange={e => setSelectedCoin(e.target.value)}
            >
              {cryptoNames.map(name => (
                <option key={name} value={name}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>

            <label htmlFor="alertType">Tipo de alerta:</label>
            <select
              id="alertType"
              value={alertType}
              onChange={e => setAlertType(e.target.value)}
            >
              <option value="above">Por encima de</option>
              <option value="below">Por debajo de</option>
            </select>

            <label htmlFor="alertValue">Valor del precio:</label>
            <input
              id="alertValue"
              type="number"
              step="0.01"
              value={alertValue}
              onChange={e => setAlertValue(e.target.value)}
              required
            />

            <button type="submit" className={styles.submitButton}>
              Registrar Alerta
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}







