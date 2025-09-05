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
        // 📌 1) Precios históricos (para gráficos e indicadores)
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );
        const result = await res.json();

        const formatted = result.prices.map((p, i, arr) => {
          const date = new Date(p[0]).toLocaleDateString();
          const price = p[1];

          // Calcular medias móviles
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

        // 📌 2) Datos adicionales (market cap, volumen, dominancia BTC)
        const resExtra = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${crypto}`,
          { signal: controller.signal }
        );
        const resultExtra = await resExtra.json();
        const info = resultExtra[0];
        setExtraData({
          marketCap: info.market_cap,
          volume: info.total_volume,
          btcDominance: crypto === "bitcoin" ? 100 : null, // lo calculamos más abajo
        });

        // Si no es BTC, calcular dominancia con global data
        if (crypto !== "bitcoin") {
          const resGlobal = await fetch(
            "https://api.coingecko.com/api/v3/global",
            { signal: controller.signal }
          );
          const global = await resGlobal.json();
          const btcDom = global.data.market_cap_percentage.btc;
          setExtraData((prev) => ({
            ...prev,
            btcDominance: btcDom,
          }));
        }

        // 📊 Calcular medias móviles finales
        const ma7 = formatted.slice(-7).reduce((a, b) => a + b.price, 0) / 7;
        const ma30 = formatted.slice(-30).reduce((a, b) => a + b.price, 0) / 30;

        // 📊 Calcular RSI
        const rsi = calculateRSI(formatted.slice(-15));

        // 📈 Generar señal IA
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">📊 Dashboard Trading AI</h1>

      {/* Selector de cripto */}
      <select
        className="bg-gray-800 p-2 rounded mb-4"
        onChange={(e) => setCrypto(e.target.value)}
      >
        <option value="bitcoin">Bitcoin (BTC)</option>
        <option value="ethereum">Ethereum (ETH)</option>
        <option value="solana">Solana (SOL)</option>
        <option value="dogecoin">Dogecoin (DOGE)</option>
      </select>

      {/* Precio actual */}
      {price && (
        <div className="p-4 bg-gray-800 rounded mb-4">
          <h2 className="text-xl">💰 Precio actual: ${price.toFixed(2)}</h2>
        </div>
      )}

      {/* 📊 Extra Data */}
      {extraData && (
        <div className="p-4 bg-gray-800 rounded mb-4">
          <h2 className="text-xl mb-2">📊 Datos de Mercado</h2>
          <p>Volumen 24h: ${formatNumber(extraData.volume)}</p>
          <p>Market Cap: ${formatNumber(extraData.marketCap)}</p>
          <p>Dominancia BTC: {extraData.btcDominance.toFixed(2)}%</p>
        </div>
      )}

      {/* Señal IA */}
      {signal && (
        <div
          className={`p-4 rounded mb-4 ${
            signal.recommendation.includes("Comprar")
              ? "bg-green-700"
              : signal.recommendation.includes("Vender")
              ? "bg-red-700"
              : "bg-gray-700"
          }`}
        >
          <h2 className="text-xl">🤖 Señal IA</h2>
          <p>
            Recomendación: <span className="font-bold">{signal.recommendation}</span>
          </p>
          <p>Probabilidad de éxito: {signal.probability}%</p>
          <p>RSI: {signal.rsi}</p>
          <p>MA7: {signal.ma7.toFixed(2)} | MA30: {signal.ma30.toFixed(2)}</p>
          {lastUpdate && <p className="text-sm mt-2">⏱️ Última actualización: {lastUpdate}</p>}
        </div>
      )}

      {/* Gráfico de precio con MA7 y MA30 */}
      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ma7" stroke="#3399ff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ma30" stroke="#ff3333" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Gráfico RSI */}
      {data.length > 0 && signal && (
        <div className="mt-6">
          <h2 className="text-lg font-bold mb-2">📈 RSI (Relative Strength Index)</h2>
          <ResponsiveContainer width="100%" height={200}>
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
    </div>
  );
}


