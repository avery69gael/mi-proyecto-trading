"use client";


import React, { useState, useEffect, useRef } from "react";

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


/*

  Dashboard extendido:

  - Precio actual + market data

  - MA7, MA30 y RSI

  - Predicción lineal (7 días)

  - Señal IA + historial

  - Alertas inteligentes (guardadas en localStorage)

  - Caché local + retry/backoff

  - Estilo visual con degradados y animaciones

*/


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


  const abortRef = useRef(null);

  const retryTimerRef = useRef(null);

  const debounceTimerRef = useRef(null);

  const backoffRef = useRef(0);


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

      `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=30&interval=daily`,

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


        let recommendation = "Mantener ⚖️";

        let probability = 55;

        if (ma7Val > ma30Val && lastRSI < 70) {

          recommendation = "Comprar ✅";

          probability = 70;

        } else if (ma7Val < ma30Val && lastRSI > 30) {

          recommendation = "Vender 🚨";

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

        setError("⚠️ Mostrando datos en caché");

      } else {

        setError("❌ Error de red");

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

        toast(`🚨 ${formatAlertText(a, coin)}`);

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


  // --- Nuevo código para la conexión con Supabase ---

  async function registerAlert(email, coin, type, value) {

    const supabaseUrl = https://fddsnlznyhhtueodxiwd.supabase.co 

    const supabaseKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHNubHpueWhodHVlb2R4aXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjU2ODksImV4cCI6MjA3MzEwMTY4OX0.EeFnjNIHCI6ovg-JtES2ceHJ74rVoW03b9Q5W2iJhV8 


    try {

      const response = await fetch(`${supabaseUrl}/rest/v1/user_alerts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'apikey': supabaseKey,

          'Authorization': `Bearer ${supabaseKey}`

        },

        body: JSON.stringify([{

          email: email,

          coin: coin,

          alert_type: type,

          alert_value: value

        }])

      });


      const data = await response.json();


      if (!response.ok) {

        throw new Error(data.message || 'Error al registrar la alerta.');

      }


      toast.success('✅ Alerta registrada con éxito!');

    } catch (error) {

      console.error('Error al registrar la alerta:', error);

      toast.error('❌ No se pudo registrar la alerta.');

    }

  }


  // --- Fin del nuevo código de Supabase ---


  // ---------- UI ----------

  return (

    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">

      <Toaster position="bottom-right" />

      <header className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-4 flex flex-col md:flex-row justify-between items-center gap-3 shadow-lg">

        <h1 className="text-xl md:text-2xl font-bold">🚀 Trading AI Dashboard</h1>

        <select

          value={coin}

          onChange={(e) => setCoin(e.target.value)}

          className="bg-gray-900/70 p-2 rounded border border-gray-700 text-white"

        >

          <option value="bitcoin">Bitcoin (BTC)</option>

          <option value="ethereum">Ethereum (ETH)</option>

          <option value="solana">Solana (SOL)</option>

          <option value="dogecoin">Dogecoin (DOGE)</option>

          <option value="cardano">Cardano (ADA)</option>

        </select>

      </header>


      {loading && <p className="p-6 text-center">⏳ Cargando...</p>}

      {error && <p className="p-6 text-center text-red-400">{error}</p>}


      <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="bg-green-900/40 rounded-xl p-6">

          <h2 className="text-lg font-bold">💰 Precio actual</h2>

          <p className="text-2xl mt-2">{price ? `$${price}` : "—"}</p>

          <p className="text-sm mt-2">Última actualización: {lastUpdate}</p>

        </div>


        <div className="bg-blue-900/40 rounded-xl p-6">

          <h2 className="text-lg font-bold">📊 Mercado</h2>

          <p>Volumen: ${formatNumber(extraData.volume)}</p>

          <p>Market Cap: ${formatNumber(extraData.marketCap)}</p>

          <p>Dominancia BTC: {extraData.btcDominance ?? "—"}%</p>

        </div>


        <div className="bg-gray-800 rounded-xl p-6">

          <h2 className="text-lg font-bold">🤖 Señal IA</h2>

          {signal ? (

            <>

              <p>{signal.recommendation}</p>

              <p>Prob: {signal.probability}%</p>

              <p>RSI: {signal.rsi}</p>

            </>

          ) : (

            <p>—</p>

          )}

        </div>


        {/* Gráfico principal */}

        <div className="lg:col-span-2 bg-gray-900 p-4 rounded-xl">

          <h2 className="text-lg font-bold">Histórico de precios y medias móviles</h2>

          <ResponsiveContainer width="100%" height={300}>

            <LineChart data={data}>

              <CartesianGrid strokeDasharray="3 3" stroke="#555" />

              <XAxis dataKey="date" stroke="#999" tickFormatter={(v) => v.slice(0, 5)} />

              <YAxis domain={["dataMin", "dataMax"]} stroke="#999" />

              <Tooltip />

              <Line type="monotone" dataKey="price" stroke="#8884d8" name="Precio" />

              <Line type="monotone" dataKey="ma7" stroke="#82ca9d" name="MA7" dot={false} />

              <Line type="monotone" dataKey="ma30" stroke="#f6ad55" name="MA30" dot={false} />

            </LineChart>

          </ResponsiveContainer>

        </div>


        {/* Gráfico RSI */}

        <div className="bg-gray-900 p-4 rounded-xl">

          <h2 className="text-lg font-bold">RSI (14 días)</h2>

          <ResponsiveContainer width="100%" height={200}>

            <LineChart data={data}>

              <CartesianGrid strokeDasharray="3 3" stroke="#555" />

              <XAxis dataKey="date" hide />

              <YAxis domain={[0, 100]} stroke="#999" />

              <Tooltip />

              <Line type="monotone" dataKey="rsi" stroke="#66bb6a" name="RSI" />

              <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" label={{ value: "Sobrecompra", position: "insideTopRight", fill: "red" }} />

              <ReferenceLine y={30} stroke="lime" strokeDasharray="3 3" label={{ value: "Sobreventa", position: "insideBottomLeft", fill: "lime" }} />

            </LineChart>

          </ResponsiveContainer>

        </div>


        {/* Alertas */}

        <div className="lg:col-span-3 bg-gray-900 p-4 rounded-xl">

          <h2 className="text-lg font-bold">⚡ Alertas</h2>

          <div className="flex flex-wrap gap-2 mt-2 items-center">

            <select id="alertType" className="p-2 rounded bg-gray-800">

              <option value="priceAbove">Precio &gt; X</option>

              <option value="priceBelow">Precio &lt; X</option>

              <option value="rsiAbove">RSI &gt; X</option>

              <option value="rsiBelow">RSI &lt; X</option>

            </select>

            <input

              id="alertValue"

              type="number"

              className="p-2 rounded bg-gray-800 w-24"

              placeholder="Valor"

            />

            <button

              onClick={() => {

                const type = document.getElementById("alertType").value;

                const value = parseFloat(document.getElementById("alertValue").value);

                addAlert(type, value);

              }}

              className="bg-blue-600 px-3 py-2 rounded"

            >

              Añadir

            </button>

          </div>

          <ul className="mt-3 space-y-2">

            {alerts.map((a) => (

              <li key={a.id} className="flex justify-between bg-gray-800 p-2 rounded">

                {formatAlertText(a, coin)}

                <button onClick={() => removeAlert(a.id)} className="text-red-400">

                  ❌

                </button>

              </li>

            ))}

          </ul>

        </div>

        

        {/* --- Nuevo código del formulario de email --- */}

        <div className="lg:col-span-3 bg-gray-900 p-4 rounded-xl">

            <h2 className="text-lg font-bold">📧 Recibe alertas por email</h2>

            <p className="text-sm text-gray-400 mb-4">Regístrate para recibir notificaciones por correo cuando tus alertas se activen, incluso cuando no estés en la web.</p>

            <div className="flex flex-col md:flex-row flex-wrap gap-4 items-start">

                <input

                    id="emailInput"

                    type="email"

                    placeholder="Introduce tu email"

                    className="p-2 rounded bg-gray-800 text-white w-full md:w-auto flex-grow"

                />

                <div className="flex flex-wrap gap-2 w-full md:w-auto">

                    <select id="alertTypeEmail" className="p-2 rounded bg-gray-800 text-white">

                        <option value="priceAbove">Precio > X</option>

                        <option value="priceBelow">Precio < X</option>

                        <option value="rsiAbove">RSI > X</option>

                        <option value="rsiBelow">RSI < X</option>

                    </select>

                    <input

                        id="alertValueEmail"

                        type="number"

                        className="p-2 rounded bg-gray-800 text-white w-24"

                        placeholder="Valor"

                    />

                    <button

                        onClick={() => {

                            const email = document.getElementById("emailInput").value;

                            const type = document.getElementById("alertTypeEmail").value;

                            const value = parseFloat(document.getElementById("alertValueEmail").value);

                            if (email && type && !isNaN(value)) {

                                registerAlert(email, coin, type, value);

                            } else {

                                toast.error("Por favor, rellena todos los campos.");

                            }

                        }}

                        className="bg-purple-600 hover:bg-purple-700 transition-colors px-3 py-2 rounded"

                    >

                        Activar Alerta

                    </button>

                </div>

            </div>

        </div>

        {/* --- Fin del nuevo código del formulario de email --- */}


      </main>


      <footer className="p-6 text-center text-gray-500 text-sm">

        <p>La información en esta página es solo para fines informativos y no debe ser considerada asesoramiento financiero. El trading conlleva un alto riesgo de pérdida.</p>

        <p className="mt-2">© 2024 Trading AI Dashboard</p>

      </footer>

    </div>

  );

}








