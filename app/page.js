"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
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

export default function Home() {
  const [crypto, setCrypto] = useState("bitcoin");
  const [data, setData] = useState([]);
  const [price, setPrice] = useState(null);
  const [signal, setSignal] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!crypto) return;

    const controller = new AbortController();

    async function fetchData() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );
        const result = await res.json();

        const formatted = result.prices.map(p => ({
          date: new Date(p[0]).toLocaleDateString(),
          price: p[1],
        }));

        setData(formatted);
        setPrice(formatted[formatted.length - 1].price);

        // 📊 Calcular medias móviles
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

    // Llamar a la API al cargar
    fetchData();

    // ⏱️ Actualizar cada 60 segundos
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

      {/* Señal IA con colores dinámicos */}
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

      {/* Explicación RSI */}
      <div className="p-4 bg-gray-700 rounded mb-4">
        <h2 className="text-lg font-bold">ℹ️ ¿Qué es el RSI?</h2>
        <p className="text-sm mt-2">
          El <strong>RSI (Relative Strength Index)</strong> es un indicador técnico que mide la fuerza de una tendencia.
          Su valor va de <strong>0 a 100</strong>:
        </p>
        <ul className="list-disc list-inside mt-2 text-sm">
          <li><strong>RSI &gt; 70</strong> → Sobrecomprado (riesgo de caída)</li>
          <li><strong>RSI &lt; 30</strong> → Sobrevendido (posible rebote al alza)</li>
          <li><strong>40 ≤ RSI ≤ 60</strong> → Mercado neutro</li>
        </ul>
      </div>

      {/* Explicación Medias Móviles */}
      <div className="p-4 bg-gray-700 rounded mb-4">
        <h2 className="text-lg font-bold">ℹ️ ¿Qué son las Medias Móviles (MA)?</h2>
        <p className="text-sm mt-2">
          Las <strong>Medias Móviles (MA)</strong> suavizan el precio para identificar tendencias:
        </p>
        <ul className="list-disc list-inside mt-2 text-sm">
          <li><strong>MA7</strong> → Media de los últimos 7 días (tendencia corta)</li>
          <li><strong>MA30</strong> → Media de los últimos 30 días (tendencia larga)</li>
          <li>Cuando <strong>MA7 cruza por encima de MA30</strong> → Señal de <span className="text-green-400">compra</span></li>
          <li>Cuando <strong>MA7 cruza por debajo de MA30</strong> → Señal de <span className="text-red-400">venta</span></li>
        </ul>
      </div>

      {/* Gráfico */}
      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#00ff88" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
