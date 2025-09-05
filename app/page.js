"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// 📌 Calcular RSI
function calculateRSI(data, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let change = data[i].price - data[i - 1].price;
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  return rsi.toFixed(2);
}

// 📌 Formatear números
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

export default function Home() {
  const [crypto, setCrypto] = useState("bitcoin");
  const [data, setData] = useState([]);
  const [price, setPrice] = useState(null);
  const [extraData, setExtraData] = useState(null);
  const [signal, setSignal] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!crypto) return;
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 📊 Datos históricos
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Error al obtener datos históricos");
        const result = await res.json();

        const formatted = result.prices.map((p, i, arr) => {
          const date = new Date(p[0]).toLocaleDateString();
          const price = p[1];
          const ma7 =
            i >= 6
              ? arr.slice(i - 6, i + 1).reduce((a, b) => a + b[1], 0) / 7
              : null;
          const ma30 =
            i >= 29
              ? arr.slice(i - 29, i + 1).reduce((a, b) => a + b[1], 0) / 30
              : null;
          return { date, price, ma7, ma30 };
        });

        setData(formatted);
        setPrice(formatted[formatted.length - 1].price);

        // 📊 Datos extra
        const resExtra = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${crypto}`,
          { signal: controller.signal }
        );
        if (!resExtra.ok) throw new Error("Error al obtener datos de mercado");
        const resultExtra = await resExtra.json();
        const info = resultExtra[0];
        setExtraData({
          marketCap: info.market_cap,
          volume: info.total_volume,
          btcDominance: crypto === "bitcoin" ? 100 : null,
        });

        if (crypto !== "bitcoin") {
          const resGlobal = await fetch(
            "https://api.coingecko.com/api/v3/global",
            { signal: controller.signal }
          );
          if (resGlobal.ok) {
            const global = await resGlobal.json();
            const btcDom = global.data.market_cap_percentage.btc;
            setExtraData((prev) => ({ ...prev, btcDominance: btcDom }));
          }
        }

        // 📈 Señal IA
        const ma7 = formatted.slice(-7).reduce((a, b) => a + b.price, 0) / 7;
        const ma30 = formatted.slice(-30).reduce((a, b) => a + b.price, 0) / 30;
        const rsi = calculateRSI(formatted.slice(-15));

        let recommendation = "Mantener ⚖️";
        let probability = 55;
        if (ma7 > ma30 && rsi < 70) {
          recommendation = "Comprar ✅";
          probability = rsi < 60 ? 75 : 65;
        } else if (ma7 < ma30 && rsi > 30) {
          recommendation = "Vender 🚨";
          probability = rsi > 50 ? 72 : 65;
        }

        setSignal({ recommendation, probability, rsi, ma7, ma30 });
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Error al cargar los datos");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [crypto]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      {/* Navbar con degradado */}
      <header className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 shadow-lg p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 transition-all duration-500">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left drop-shadow-lg">
          🚀 Trading AI Dashboard
        </h1>
        <select
          className="bg-gray-900/70 backdrop-blur-md p-2 rounded w-full md:w-auto border border-gray-700 hover:scale-105 transition-all duration-300"
          onChange={(e) => setCrypto(e.target.value)}
        >
          <option value="bitcoin">Bitcoin (BTC)</option>
          <option value="ethereum">Ethereum (ETH)</option>
          <option value="solana">Solana (SOL)</option>
          <option value="dogecoin">Dogecoin (DOGE)</option>
        </select>
      </header>

      {/* Loading */}
      {loading && (
        <div className="p-6 text-center animate-pulse">
          <p className="text-lg">⏳ Cargando datos...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 text-center text-red-400 animate-bounce">
          <p>❌ Error: {error}</p>
        </div>
      )}

      {/* Contenido */}
      {!loading && !error && (
        <>
          <main className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tarjeta Precio */}
            {price && (
              <div className="bg-gradient-to-br from-green-900/70 to-green-700/50 rounded-xl shadow-lg p-6 transform hover:scale-105 transition-all duration-300">
                <h2 className="text-lg font-bold">💰 Precio Actual</h2>
                <p className="text-2xl font-semibold mt-2">${price.toFixed(2)}</p>
              </div>
            )}

            {/* Tarjeta Mercado */}
            {extraData && (
              <div className="bg-gradient-to-br from-blue-900/70 to-blue-700/50 rounded-xl shadow-lg p-6 transform hover:scale-105 transition-all duration-300">
                <h2 className="text-lg font-bold">📊 Datos de Mercado</h2>
                <p className="mt-2">Volumen 24h: ${formatNumber(extraData.volume)}</p>
                <p>Market Cap: ${formatNumber(extraData.marketCap)}</p>
                <p>Dominancia BTC: {extraData.btcDominance.toFixed(2)}%</p>
              </div>
            )}

            {/* Tarjeta Señal IA */}
            {signal && (
              <div
                className={`rounded-xl shadow-lg p-6 transform hover:scale-105 transition-all duration-300 ${
                  signal.recommendation.includes("Comprar")
                    ? "bg-gradient-to-br from-green-700 via-green-800 to-green-900"
                    : signal.recommendation.includes("Vender")
                    ? "bg-gradient-to-br from-red-700 via-red-800 to-red-900"
                    : "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
                }`}
              >
                <h2 className="text-lg font-bold">🤖 Señal IA</h2>
                <p className="mt-2 font-semibold">{signal.recommendation}</p>
                <p>Probabilidad: {signal.probability}%</p>
                <p>RSI: {signal.rsi}</p>
                <p>
                  MA7: {signal.ma7.toFixed(2)} | MA30: {signal.ma30.toFixed(2)}
                </p>
                {lastUpdate && (
                  <p className="text-sm mt-2">⏱️ {lastUpdate}</p>
                )}
              </div>
            )}
          </main>

          {/* Gráficos */}
          <section className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Precio + MA */}
            {data.length > 0 && (
              <div className="bg-gray-900/80 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-500">
                <h2 className="text-lg font-bold mb-4">📈 Precio + MA</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data}>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ma7" stroke="#3399ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ma30" stroke="#ff3333" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* RSI */}
            {data.length > 0 && signal && (
              <div className="bg-gray-900/80 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-500">
                <h2 className="text-lg font-bold mb-4">📉 RSI</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.map((d, i, arr) => {
                      if (i < 14) return { date: d.date, rsi: null };
                      return {
                        date: d.date,
                        rsi: calculateRSI(arr.slice(i - 14, i + 1))
                      };
                    })}
                  >
                    <XAxis dataKey="date" hide />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rsi" stroke="#ffaa00" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}






