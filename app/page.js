"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// 📌 Función para calcular RSI
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

// 📌 Formatear números grandes (ej: 1.2M, 3.4B)
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

  useEffect(() => {
    if (!crypto) return;
    const controller = new AbortController();

    async function fetchData() {
      try {
        // 📊 1) Precios históricos
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );
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

        // 📊 2) Datos adicionales
        const resExtra = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${crypto}`,
          { signal: controller.signal }
        );
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
          const global = await resGlobal.json();
          const btcDom = global.data.market_cap_percentage.btc;
          setExtraData((prev) => ({ ...prev, btcDominance: btcDom }));
        }

        // 📈 Indicadores
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
        if (err.name !== "AbortError") console.error(err);
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <header className="bg-gray-900 shadow-lg p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🚀 Trading AI Dashboard</h1>
        <select
          className="bg-gray-800 p-2 rounded"
          onChange={(e) => setCrypto(e.target.value)}
        >
          <option value="bitcoin">Bitcoin (BTC)</option>
          <option value="ethereum">Ethereum (ETH)</option>
          <option value="solana">Solana (SOL)</option>
          <option value="dogecoin">Dogecoin (DOGE)</option>
        </select>
      </header>

      {/* Grid principal */}
      <main className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Precio */}
        {price && (
          <div className="bg-gray-900 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold">💰 Precio Actual</h2>
            <p className="text-2xl font-semibold mt-2">${price.toFixed(2)}</p>
          </div>
        )}

        {/* Datos de mercado */}
        {extraData && (
          <div className="bg-gray-900 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold">📊 Datos de Mercado</h2>
            <p className="mt-2">Volumen 24h: ${formatNumber(extraData.volume)}</p>
            <p>Market Cap: ${formatNumber(extraData.marketCap)}</p>
            <p>Dominancia BTC: {extraData.btcDominance.toFixed(2)}%</p>
          </div>
        )}

        {/* Señal IA */}
        {signal && (
          <div
            className={`rounded-xl shadow-lg p-6 ${
              signal.recommendation.includes("Comprar")
                ? "bg-green-800"
                : signal.recommendation.includes("Vender")
                ? "bg-red-800"
                : "bg-gray-800"
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

      {/* Sección de gráficos */}
      <section className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de precio */}
        {data.length > 0 && (
          <div className="bg-gray-900 rounded-xl shadow-lg p-6">
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

        {/* Gráfico RSI */}
        {data.length > 0 && signal && (
          <div className="bg-gray-900 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4">📉 RSI</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.map((d, i, arr) => {
                if (i < 14) return { date: d.date, rsi: null };
                return {
                  date: d.date,
                  rsi: calculateRSI(arr.slice(i - 14, i + 1))
                };
              })}>
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
    </div>
  );
}



