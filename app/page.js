"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// Calcular RSI
function calculateRSI(data, period = 14) {
  if (!data || data.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let change = data[i].price - data[i - 1].price;
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  return (100 - 100 / (1 + rs)).toFixed(2);
}

// Formatear números
function formatNumber(num) {
  if (!num) return "-";
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

    // 🔄 resetear datos cada vez que se cambia de cripto
    setData([]);
    setPrice(null);
    setExtraData(null);
    setSignal(null);
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    async function fetchData() {
      try {
        // 1) Precios históricos
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Error al obtener precios históricos");
        const result = await res.json();

        const formatted = result.prices.map((p, i, arr) => {
          const date = new Date(p[0]).toLocaleDateString();
          const price = p[1];
          const ma7 =
            i >= 6 ? arr.slice(i - 6, i + 1).reduce((a, b) => a + b[1], 0) / 7 : null;
          const ma30 =
            i >= 29 ? arr.slice(i - 29, i + 1).reduce((a, b) => a + b[1], 0) / 30 : null;
          return { date, price, ma7, ma30 };
        });

        setData(formatted);
        setPrice(formatted.at(-1)?.price ?? null);

        // 2) Datos extra
        const resExtra = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${crypto}`,
          { signal: controller.signal }
        );
        if (!resExtra.ok) throw new Error("Error al obtener datos extra");
        const resultExtra = await resExtra.json();
        const info = resultExtra[0];
        let extra = {
          marketCap: info.market_cap,
          volume: info.total_volume,
          btcDominance: crypto === "bitcoin" ? 100 : null,
        };

        if (crypto !== "bitcoin") {
          try {
            const resGlobal = await fetch("https://api.coingecko.com/api/v3/global", {
              signal: controller.signal,
            });
            if (resGlobal.ok) {
              const global = await resGlobal.json();
              extra.btcDominance = global.data.market_cap_percentage.btc;
            }
          } catch (e) {
            console.warn("No se pudo obtener dominancia BTC:", e);
          }
        }
        setExtraData(extra);

        // 3) Señal IA
        if (formatted.length >= 30) {
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
        }

        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError(err.message || "Error al cargar datos");
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
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 shadow-lg p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold">🚀 Trading AI Dashboard</h1>
        <select
          className="bg-gray-900/70 p-2 rounded border border-gray-700"
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
          <p>⏳ Cargando {crypto}...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 text-center text-red-400">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Contenido */}
      {!loading && !error && data.length > 0 && (
        <>
          <main className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {price && (
              <div className="bg-gradient-to-br from-green-900/70 to-green-700/50 rounded-xl shadow-lg p-6">
                <h2 className="font-bold">💰 Precio</h2>
                <p className="text-2xl mt-2">${price.toFixed(2)}</p>
              </div>
            )}

            {extraData && (
              <div className="bg-gradient-to-br from-blue-900/70 to-blue-700/50 rounded-xl shadow-lg p-6">
                <h2 className="font-bold">📊 Mercado</h2>
                <p className="mt-2">Volumen 24h: ${formatNumber(extraData.volume)}</p>
                <p>Market Cap: ${formatNumber(extraData.marketCap)}</p>
                <p>Dominancia BTC: {extraData.btcDominance?.toFixed(2)}%</p>
              </div>
            )}

            {signal && (
              <div
                className={`rounded-xl shadow-lg p-6 ${
                  signal.recommendation.includes("Comprar")
                    ? "bg-gradient-to-br from-green-700 to-green-900"
                    : signal.recommendation.includes("Vender")
                    ? "bg-gradient-to-br from-red-700 to-red-900"
                    : "bg-gradient-to-br from-gray-700 to-gray-900"
                }`}
              >
                <h2 className="font-bold">🤖 Señal IA</h2>
                <p className="mt-2">{signal.recommendation}</p>
                <p>Probabilidad: {signal.probability}%</p>
                <p>RSI: {signal.rsi}</p>
                <p>MA7: {signal.ma7.toFixed(2)} | MA30: {signal.ma30.toFixed(2)}</p>
                {lastUpdate && <p className="text-sm mt-2">⏱ {lastUpdate}</p>}
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}






