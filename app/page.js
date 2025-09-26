'use client';

import { useState, useEffect, useRef } from "react";
// CORRECCIÓN: Usamos createBrowserClient y corregimos la importación
import { createBrowserClient } from '@supabase/supabase-js'; 
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

// CORRECCIÓN: La instancia se crea con createBrowserClient
const supabase = createBrowserClient();

// Componente de autenticación
function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState('sign_in');

  const handleSignUp = async (e) => {
    e.preventDefault();
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
  const [session, setSession] = useState(null); // Nuevo estado para la sesión del usuario

  // Estado para el formulario de email
  const [email, setEmail] = useState("");
  const [emailAlertType, setEmailAlertType] = useState("priceAbove");
  const [emailAlertValue, setEmailAlertValue] = useState("");

  const abortRef = useRef(null);
  const retryTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const backoffRef = useRef(0);

  // ---------- Manejo de sesión de usuario ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

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

  // Función para enviar el email de alerta de forma segura
  const handleRegisterAlert = async () => {
    const currentEmail = document.getElementById("emailInput").value;
    const currentAlertType = document.getElementById("alertTypeEmail").value;
    const currentAlertValue = parseFloat(document.getElementById("alertValueEmail").value);

    if (!currentEmail || !currentAlertType || isNaN(currentAlertValue)) {
      toast.error("Por favor, rellena todos los campos.");
      return;
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentEmail,
          coin: coin,
          alert_type: currentAlertType,
          alert_value: currentAlertValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar el email');
      }

      toast.success('Alerta por email registrada con éxito');
    } catch (error) {
      console.error('Error al registrar la alerta por email:', error);
      toast.error('No se pudo registrar la alerta por email.');
    }
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
        <main className="p-6 flex items-center justify-center min-h-screen-auth">
          <Auth />
        </main>
      ) : (
        <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {loading && <p className="p-6 text-center text-neutral-500">Cargando...</p>}
          {error && <p className="p-6 text-center text-red-500">{error}</p>}

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Precio Actual</h2>
            <p className="text-3xl mt-2 text-white">{price ? `$${price}` : "—"}</p>
            <p className="text-sm mt-2 text-neutral-400">Última actualización: {lastUpdate}</p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Datos de Mercado</h2>
            <p className="text-neutral-400">Volumen: ${formatNumber(extraData.volume)}</p>
            <p className="text-neutral-400">Capitalización: ${formatNumber(extraData.marketCap)}</p>
            <p className="text-neutral-400">Dominancia BTC: {extraData.btcDominance ?? "—"}%</p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Señal IA</h2>
            {signal ? (
              <>
                <p className="text-neutral-400">Recomendación: {signal.recommendation}</p>
                <p className="text-neutral-400">Probabilidad: {signal.probability}%</p>
                <p className="text-neutral-400">RSI: {signal.rsi}</p>
              </>
            ) : (
              <p className="text-neutral-400">—</p>
            )}
          </div>

          <div className="lg:col-span-2 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Histórico de Precios</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" stroke="#666" tickFormatter={(v) => v.slice(0, 5)} />
                <YAxis domain={["dataMin", "dataMax"]} stroke="#666" />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#8884d8" name="Precio" />
                <Line type="monotone" dataKey="ma7" stroke="#82ca9d" name="MA7" dot={false} />
                <Line type="monotone" dataKey="ma30" stroke="#f6ad55" name="MA30" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">RSI (14 días)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} stroke="#666" />
                <Tooltip />
                <Line type="monotone" dataKey="rsi" stroke="#66bb6a" name="RSI" />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Sobrecompra", position: "insideTopRight", fill: "#ef4444" }} />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Sobreventa", position: "insideBottomLeft", fill: "#22c55e" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-3 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Alertas Inteligentes</h2>
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <select
                id="alertType"
                className="p-2 rounded bg-neutral-800 text-neutral-200"
              >
                <option value="priceAbove">Precio {'>'} X</option>
                <option value="priceBelow">Precio {'<'} X</option>
                <option value="rsiAbove">RSI {'>'} X</option>
                <option value="rsiBelow">RSI {'<'} X</option>
              </select>
              <input
                id="alertValue"
                type="number"
                className="p-2 rounded bg-neutral-800 text-neutral-200 w-24"
                placeholder="Valor"
              />
              <button
                onClick={() => {
                  const type = document.getElementById("alertType").value;
                  const value = parseFloat(document.getElementById("alertValue").value);
                  addAlert(type, value);
                }}
                className="bg-neutral-700 hover:bg-neutral-600 px-3 py-2 rounded text-neutral-100 transition-colors"
              >
                Añadir
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between bg-neutral-800 p-2 rounded text-neutral-200"
                >
                  {formatAlertText(a, coin)}
                  <button onClick={() => removeAlert(a.id)} className="text-red-400">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="lg:col-span-3 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">Recibe Alertas por Email</h2>
            <p className="text-sm text-neutral-500 mb-4">Regístrate para recibir notificaciones cuando tus alertas se activen.</p>
            <div className="flex flex-col md:flex-row flex-wrap gap-4 items-start">
              <input
                id="emailInput"
                type="email"
                placeholder="Introduce tu email"
                className="p-2 rounded bg-neutral-800 text-neutral-200 w-full md:w-auto flex-grow"
              />
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <select
                  id="alertTypeEmail"
                  className="p-2 rounded bg-neutral-800 text-neutral-200"
                >
                  <option value="priceAbove">Precio {'>'} X</option>
                  <option value="priceBelow">Precio {'<'} X</option>
                  <option value="rsiAbove">RSI {'>'} X</option>
                  <option value="rsiBelow">RSI {'<'} X</option>
                </select>
                <input
                  id="alertValueEmail"
                  type="number"
                  className="p-2 rounded bg-neutral-800 text-neutral-200 w-24"
                  placeholder="Valor"
                />
                <button
                  onClick={handleRegisterAlert}
                  className="bg-neutral-700 hover:bg-neutral-600 px-3 py-2 rounded text-neutral-100 transition-colors"
                >
                  Activar Alerta
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="p-6 text-center text-neutral-600 text-sm">
        <p>La información en esta página es solo para fines informativos y no debe ser considerada asesoramiento financiero. El trading conlleva un alto riesgo de pérdida.</p>
        <p className="mt-2">© 2024 Trading Dashboard</p>
      </footer>
    </div>
  );
}
