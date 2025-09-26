'use client';

import { useState, useEffect, useRef } from "react";
// Se importa el cliente de Supabase desde el módulo principal, asumiendo que se creará la instancia manualmente.
import { createClient } from '@supabase/supabase-js'; 
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import toast, { Toaster } from "react-hot-toast";

// CORRECCIÓN: Usamos createClient ya que 'createBrowserClient' no se encuentra.
// NOTA: Para que esto funcione, DEBES configurar tus variables de entorno en el Canvas (SUPABASE_URL y SUPABASE_ANON_KEY).
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL'; 
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// En un entorno de React/Next.js, el cliente se inicializa así:
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Componente de autenticación
function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState('sign_in');

  const handleSignUp = async (e) => {
    e.preventDefault();
    // Usamos supabase.auth para la autenticación
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('¡Registro exitoso! Por favor, revisa tu email para confirmar tu cuenta.');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('¡Inicio de sesión exitoso!');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-neutral-900 rounded-xl border border-neutral-800 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4">
        {view === 'sign_in' ? 'Iniciar Sesión' : 'Registrarse'}
      </h2>
      <form onSubmit={view === 'sign_in' ? handleSignIn : handleSignUp} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          name="email"
          placeholder="Correo electrónico"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          required
          className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          required
          className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          {view === 'sign_in' ? 'Iniciar Sesión' : 'Registrarse'}
        </button>
      </form>
      <button
        onClick={() => setView(view === 'sign_in' ? 'sign_up' : 'sign_in')}
        className="mt-4 text-sm text-neutral-400 hover:text-white transition-colors"
      >
        {view === 'sign_in' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </div>
  );
}

// Componente principal de la página
export default function Home() {
  const [coin, setCoin] = useState("bitcoin");
  const [data, setData] = useState([]);
  const [price, setPrice] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [signal, setSignal] = useState(null);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [session, setSession] = useState(null); // Estado para la sesión del usuario

  // Estado para el formulario de email (no implementado completamente sin backend/API Key)
  const [emailAlertType, setEmailAlertType] = useState("priceAbove");
  const [emailAlertValue, setEmailAlertValue] = useState("");

  const abortRef = useRef(null);
  const retryTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const backoffRef = useRef(0);

  // ---------- Manejo de sesión de usuario ----------
  useEffect(() => {
    // Comprueba la sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Escucha los cambios de estado de la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---------- utils ----------
  const saveToLocal = (key, value) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {}
  };
  const readFromLocal = (key) => {
    try {
      if (typeof window !== "undefined") {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      }
    } catch {
      return null;
    }
  };

  function calculateRSI(pricesArray, period = 14) {
    if (!pricesArray || pricesArray.length <= period) {
      return pricesArray.map(() => ({ rsi: null }));
    }
    const rsiData = [];
    for (let i = period; i < pricesArray.length; i++) {
      const window = pricesArray.slice(i - period, i + 1);
      let gains = 0;
      let losses = 0;
      for (let j = 1; j <= period; j++) {
        const change = window[j].price - window[j - 1].price;
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiData.push({ date: window[window.length - 1].date, rsi: Number((100 - 100 / (1 + rs)).toFixed(2)) });
    }
    return rsiData;
  }

  function makeLinearForecast(pricesArray, days = 7) {
    if (!pricesArray || pricesArray.length === 0) return [];
    const n = pricesArray.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = pricesArray.slice();

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    const m =
      x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) /
      (x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) || 1);
    const b = meanY - m * meanX;

    return Array.from({ length: days }, (_, i) => {
      const xi = n + i;
      return { date: `Día +${i + 1}`, forecast: m * xi + b };
    });
  }

  function formatNumber(num) {
    if (num === null || num === undefined) return "-";
    if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return Number(num).toFixed(2);
  }

  function formatAlertText(a, coin) {
    switch (a.type) {
      case "priceAbove":
        return `${coin.toUpperCase()} > ${a.value}`;
      case "priceBelow":
        return `${coin.toUpperCase()} < ${a.value}`;
      case "rsiAbove":
        return `RSI > ${a.value}`;
      case "rsiBelow":
        return `RSI < ${a.value}`;
      default:
        return `${a.type} ${a.value}`;
    }
  }

  // ---------- inicialización ----------
  useEffect(() => {
    const savedAlerts = readFromLocal("alerts");
    if (savedAlerts) setAlerts(savedAlerts);

    const savedHistory = readFromLocal("signals_history");
    if (savedHistory) setHistory(savedHistory);
  }, []);

  useEffect(() => saveToLocal("alerts", alerts), [alerts]);
  useEffect(() => saveToLocal("signals_history", history), [history]);

  // ---------- fetch de datos refactorizado ----------
  async function fetchHistoricalData(coin, signal) {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin}/market-chart?vs_currency=usd&days=30&interval=daily`,
      { signal }
    );
    if (!response.ok) throw new Error("Histórico falló");
    const json = await response.json();
    return json.prices.map((p, i, arr) => {
      const date = new Date(p[0]).toLocaleDateString();
      const priceVal = p[1];
      const ma7 =
        i >= 6 ? arr.slice(i - 6, i + 1).reduce((a, b) => a + b[1], 0) / 7 : null;
      const ma30 =
        i >= 29 ? arr.slice(i - 29, i + 1).reduce((a, b) => a + b[1], 0) / 30 : null;
      return { date, price: priceVal, ma7, ma30 };
    });
  }

  async function fetchCurrentPrice(coin, signal) {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`,
      { signal }
    );
    if (!response.ok) throw new Error("Precio falló");
    const json = await response.json();
    return json?.[coin]?.usd ?? null;
  }

  async function fetchMarketData(coin, signal) {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}&order=market_cap_desc&per_page=1&page=1`,
      { signal }
    );
    if (!response.ok) throw new Error("Datos de mercado fallaron");
    const json = await response.json();
    const info = json?.[0] ?? {};
    return {
      marketCap: info.market_cap ?? null,
      volume: info.total_volume ?? null,
      btcDominance: coin === "bitcoin" ? 100 : null,
    };
  }

  async function doFetch(currentCoin) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const [formatted, currentPrice, extra] = await Promise.all([
        fetchHistoricalData(currentCoin, controller.signal),
        fetchCurrentPrice(currentCoin, controller.signal),
        fetchMarketData(currentCoin, controller.signal),
      ]);

      const rsiData = calculateRSI(formatted);
      const dataWithRSI = formatted.map((d, i) => ({
        ...d,
        rsi: rsiData[i] ? rsiData[i].rsi : null,
      }));

      let computedSignal = null;
      if (dataWithRSI.length >= 30) {
        const lastDataPoint = dataWithRSI.at(-1);
        const lastRSI = lastDataPoint.rsi;
        const ma7Val = lastDataPoint.ma7;
        const ma30Val = lastDataPoint.ma30;

        let recommendation = "Mantener";
        let probability = 55;
        if (ma7Val > ma30Val && lastRSI < 70) {
          recommendation = "Comprar";
          probability = 70;
        } else if (ma7Val < ma30Val && lastRSI > 30) {
          recommendation = "Vender";
          probability = 70;
        }
        computedSignal = {
          time: new Date().toLocaleTimeString(),
          recommendation,
          probability,
          rsi: lastRSI,
          ma7: ma7Val,
          ma30: ma30Val,
        };
        setHistory((prev) => [computedSignal, ...prev].slice(0, 50));
      }
      setSignal(computedSignal);
      setForecast(makeLinearForecast(formatted.map((p) => p.price), 7));
      setData(dataWithRSI);
      setPrice(currentPrice ?? formatted.at(-1)?.price ?? null);
      setExtraData(extra);
      saveToLocal(`cached_${currentCoin}`, {
        formatted: dataWithRSI,
        currentPrice: currentPrice ?? formatted.at(-1)?.price ?? null,
        extra,
        computedSignal,
      });

      setLastUpdate(new Date().toLocaleTimeString());
      backoffRef.current = 0;
    } catch (err) {
      const cached = readFromLocal(`cached_${currentCoin}`);
      if (cached) {
        setData(cached.formatted || []);
        setPrice(cached.currentPrice ?? null);
        setExtraData(cached.extra ?? {});
        setSignal(cached.computedSignal ?? null);
        setError("Mostrando datos en caché");
      } else {
        setError("Error de red");
      }
      const backoff = Math.min(30000, 2000 * Math.pow(2, backoffRef.current));
      backoffRef.current++;
      retryTimerRef.current = setTimeout(() => doFetch(currentCoin), backoff);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      doFetch(coin);
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin]);

  // ---------- alertas ----------
  useEffect(() => {
    if (!alerts.length || (!price && !signal)) return;
    const now = Date.now();
    alerts.forEach((a) => {
      let triggered = false;
      if (a.type === "priceAbove" && price > a.value) triggered = true;
      if (a.type === "priceBelow" && price < a.value) triggered = true;
      if (a.type === "rsiAbove" && signal?.rsi > a.value) triggered = true;
      if (a.type === "rsiBelow" && signal?.rsi < a.value) triggered = true;
      if (triggered && (!a.lastTriggeredAt || now - a.lastTriggeredAt > 300000)) {
        toast(`Alerta: ${formatAlertText(a, coin)}`);
        setAlerts((prev) =>
          prev.map((p) => (p.id === a.id ? { ...p, lastTriggeredAt: now } : p))
        );
      }
    });
    // eslint-disable-next-line
  }, [price, signal]);

  function addAlert(type, value) {
    if (isNaN(value)) return;
    const newAlert = { id: Date.now(), type, value: Number(value) };
    setAlerts((prev) => [...prev, newAlert]);
  }

  function removeAlert(id) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  // Función para enviar el email de alerta (solo placeholder)
  const handleRegisterAlert = async () => {
    const currentEmail = document.getElementById("emailInput").value;
    const currentAlertType = document.getElementById("alertTypeEmail").value;
    const currentAlertValue = parseFloat(document.getElementById("alertValueEmail").value);

    if (!currentEmail || !currentAlertType || isNaN(currentAlertValue)) {
      toast.error("Por favor, rellena todos los campos.");
      return;
    }

    // Esto sería una llamada a una API real (como Gemini) o un backend.
    // Como no tenemos un backend para enviar emails, solo notificamos al usuario.
    toast.success(`Alerta por email registrada (Simulada): ${currentEmail} para ${coin.toUpperCase()}`);
  };

  // Función para cerrar sesión
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('No se pudo cerrar la sesión.');
    } else {
      toast.success('Sesión cerrada con éxito.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
      <Toaster position="bottom-right" />
      <header className="bg-neutral-900 p-4 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">Trading Dashboard</h1>
        {session && (
          <div className="flex items-center gap-4">
            <p className="text-neutral-400 text-sm">Sesión iniciada como: {session.user.email}</p>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* Condición para mostrar el dashboard o el formulario de autenticación */}
      {!session ? (
        <main className="p-6 flex items-center justify-center min-h-screen-auth h-screen">
          <Auth />
        </main>
      ) : (
        <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {loading && <p className="lg:col-span-3 p-6 text-center text-neutral-500">Cargando datos de {coin}...</p>}
          {error && <p className="lg:col-span-3 p-6 text-center text-red-500">{error}</p>}

          <div className="lg:col-span-3">
              <label htmlFor="coin-select" className="block text-sm font-medium text-neutral-400 mb-2">
                Selecciona la Criptomoneda
              </label>
              <select
                  id="coin-select"
                  value={coin}
                  onChange={(e) => setCoin(e.target.value)}
                  className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/3"
              >
                  <option value="bitcoin">Bitcoin (BTC)</option>
                  <option value="ethereum">Ethereum (ETH)</option>
                  <option value="solana">Solana (SOL)</option>
                  <option value="tether">Tether (USDT)</option>
              </select>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Precio Actual</h2>
            <p className="text-3xl mt-2 text-blue-400 font-mono">{price ? `$${price}` : "—"}</p>
            <p className="text-sm mt-2 text-neutral-500">Última actualización: {lastUpdate}</p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Datos de Mercado</h2>
            <p className="text-neutral-400">Volumen 24h: <span className="text-neutral-200 font-medium">${formatNumber(extraData.volume)}</span></p>
            <p className="text-neutral-400">Capitalización: <span className="text-neutral-200 font-medium">${formatNumber(extraData.marketCap)}</span></p>
            <p className="text-neutral-400">Dominancia BTC: <span className="text-neutral-200 font-medium">{extraData.btcDominance ?? "—"}%</span></p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Señal IA</h2>
            {signal ? (
              <>
                <p className="text-neutral-400">Recomendación: <span className={`font-bold ${signal.recommendation === 'Comprar' ? 'text-green-500' : signal.recommendation === 'Vender' ? 'text-red-500' : 'text-yellow-500'}`}>{signal.recommendation}</span></p>
                <p className="text-neutral-400">Probabilidad: <span className="text-neutral-200 font-medium">{signal.probability}%</span></p>
                <p className="text-neutral-400">RSI: <span className="text-neutral-200 font-medium">{signal.rsi}</span></p>
              </>
            ) : (
              <p className="text-neutral-400">— Esperando datos para generar señal —</p>
            )}
          </div>

          <div className="lg:col-span-2 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Histórico de Precios y Medias Móviles (30 Días)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" stroke="#666" tickFormatter={(v) => v.slice(0, 5)} />
                <YAxis domain={["dataMin", "dataMax"]} stroke="#666" orientation="right" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '4px' }}
                    formatter={(value) => [`$${value.toFixed(2)}`, value.name]}
                />
                <Line type="monotone" dataKey="price" stroke="#00d4ff" name="Precio" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ma7" stroke="#82ca9d" name="MA7" dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="ma30" stroke="#f6ad55" name="MA30" dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Índice de Fuerza Relativa (RSI, 14 días)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} stroke="#666" orientation="right" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '4px' }}
                    formatter={(value) => [value, 'RSI']}
                />
                <Line type="monotone" dataKey="rsi" stroke="#66bb6a" name="RSI" strokeWidth={2} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Sobrecompra", position: "insideTopRight", fill: "#ef4444", fontSize: 12 }} />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Sobreventa", position: "insideBottomLeft", fill: "#22c55e", fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800">
            <h2 className="text-xl font-bold text-white mb-4">Gestión de Alertas Locales</h2>
            <div className="flex flex-wrap gap-3 items-center p-3 bg-neutral-800 rounded-lg">
              <select
                id="alertType"
                className="p-2 rounded bg-neutral-700 text-neutral-200 border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="priceAbove">Precio {'>'} X</option>
                <option value="priceBelow">Precio {'<'} X</option>
                <option value="rsiAbove">RSI {'>'} X</option>
                <option value="rsiBelow">RSI {'<'} X</option>
              </select>
              <input
                id="alertValue"
                type="number"
                step="any"
                className="p-2 rounded bg-neutral-700 text-neutral-200 w-24 border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Valor"
              />
              <button
                onClick={() => {
                  const type = document.getElementById("alertType").value;
                  const value = parseFloat(document.getElementById("alertValue").value);
                  addAlert(type, value);
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-semibold transition-colors shadow-md"
              >
                Añadir Alerta
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {alerts.length === 0 && <li className="text-neutral-500">No hay alertas activas.</li>}
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between items-center bg-neutral-800 p-3 rounded-lg text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors"
                >
                  <span className="font-medium">{formatAlertText(a, coin)}</span>
                  <button onClick={() => removeAlert(a.id)} className="text-red-400 hover:text-red-300 transition-colors font-semibold">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800">
            <h2 className="text-xl font-bold text-white mb-4">Simulación de Alertas por Email</h2>
            <p className="text-sm text-neutral-500 mb-4">Esta función simula el registro de una alerta que en una aplicación real enviaría un correo (no funcional aquí).</p>
            <div className="flex flex-col md:flex-row flex-wrap gap-4 items-start p-3 bg-neutral-800 rounded-lg">
              <input
                id="emailInput"
                type="email"
                placeholder="Introduce tu email"
                className="p-2 rounded bg-neutral-700 text-neutral-200 w-full md:w-auto flex-grow border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <select
                  id="alertTypeEmail"
                  className="p-2 rounded bg-neutral-700 text-neutral-200 border border-neutral-600"
                >
                  <option value="priceAbove">Precio {'>'} X</option>
                  <option value="priceBelow">Precio {'<'} X</option>
                  <option value="rsiAbove">RSI {'>'} X</option>
                  <option value="rsiBelow">RSI {'<'} X</option>
                </select>
                <input
                  id="alertValueEmail"
                  type="number"
                  step="any"
                  className="p-2 rounded bg-neutral-700 text-neutral-200 w-24 border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Valor"
                />
                <button
                  onClick={handleRegisterAlert}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white font-semibold transition-colors shadow-md"
                >
                  Activar Simulación
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="p-6 text-center text-neutral-600 text-sm border-t border-neutral-900 mt-6">
        <p>Dashboard de Trading v2.0 | Datos de CoinGecko | Autenticación con Supabase</p>
        <p className="mt-1">Recuerda: El trading conlleva un riesgo.</p>
      </footer>
    </div>
  );
}
