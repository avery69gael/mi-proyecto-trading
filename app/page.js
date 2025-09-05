"use client";
import { useState, useEffect } from "react";
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

export default function Home() {
  const [data, setData] = useState([]);
  const [crypto, setCrypto] = useState("bitcoin");
  const [price, setPrice] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Función para calcular RSI
  function calculateRSI(data, period = 14) {
    let gains = 0, losses = 0;
    for (let i = 1; i < period; i++) {
      const diff = data[i].price - data[i - 1].price;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period || 1;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  useEffect(() => {
    let controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1) Precios históricos
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=30&interval=daily`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Error precios históricos");
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
        if (!resExtra.ok) throw new Error("Error datos extra");
        const resultExtra = await resExtra.json();
        const info = resultExtra[0];
        setExtraData({
          marketCap: info.market_cap,
          volume: info.total_volume,
        });

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
          console.warn("⚠️ Error detectado:", err.message);

          // Retry automático en 2s
          setTimeout(() => {
            fetchData();
          }, 2000);

          // Mantener último dato en pantalla
          setError("⚠️ API saturada, reintentando...");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [crypto]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      {/* Navbar */}
      <header className="bg-gray-900 shadow-lg p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 transition-all">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left">
          🚀 Trading AI Dashboard
        </h1>
        <select
          className="bg-gray-800 p-2 rounded w-full md:w-auto"
          onChange={(e) => setCrypto(e.target.value)}
        >
          <option value="bitcoin">Bitcoin (BTC)</option>
          <option value="ethereum">Ethereum (ETH)</option>
          <option value="solana">Solana (SOL)</option>
          <option value="dogecoin">Dogecoin (DOGE)</option>
        </select>
      </header>

      <section className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Precio */}
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
          <h2 className="text-lg font-semibold mb-2">💰 Precio actual</h2>
          {price ? (
            <p className="text-2xl font-bold">${price.toFixed(2)}</p>
          ) : (
            <p>Cargando...</p>
          )}
        </div>

        {/* Datos extra */}
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
          <h2 className="text-lg font-semibold mb-2">📊 Datos de mercado</h2>
          {extraData.marketCap ? (
            <ul>
              <li>Market Cap: ${extraData.marketCap.toLocaleString()}</li>
              <li>Volumen 24h: ${extraData.volume.toLocaleString()}</li>
            </ul>
          ) : (
            <p>Cargando...</p>
          )}
        </div>

        {/* Señal IA */}
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 col-span-1 md:col-span-2">
          <h2 className="text-lg font-semibold mb-2">🤖 Señal IA</h2>
          {signal ? (
            <div>
              <p
                className={`text-xl font-bold ${
                  signal.recommendation.includes("Comprar")
                    ? "text-green-400"
                    : signal.recommendation.includes("Vender")
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                {signal.recommendation} ({signal.probability}% éxito)
              </p>
              <p className="text-sm text-gray-400">
                RSI: {signal.rsi.toFixed(2)} | MA7: {signal.ma7.toFixed(2)} | MA30:{" "}
                {signal.ma30.toFixed(2)}
              </p>
            </div>
          ) : (
            <p>Cargando...</p>
          )}
        </div>
      </section>

      {/* Gráficos */}
      <section className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all">
          <h2 className="text-lg font-semibold mb-2">📈 Precio y Medias</h2>
          {data.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#8884d8" dot={false} />
                <Line type="monotone" dataKey="ma7" stroke="#4ade80" dot={false} />
                <Line type="monotone" dataKey="ma30" stroke="#f87171" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>{error || "Cargando gráfico..."}</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-all">
          <h2 className="text-lg font-semibold mb-2">📉 RSI (Índice de Fuerza Relativa)</h2>
          {data.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data.map((d, i, arr) => ({
                  ...d,
                  rsi: i >= 14 ? calculateRSI(arr.slice(i - 14, i)) : null,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="rsi" stroke="#60a5fa" dot={false} />
                <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>{error || "Cargando RSI..."}</p>
          )}
        </div>
      </section>

      {/* Última actualización */}
      <footer className="p-4 text-center text-gray-400 text-sm">
        Última actualización: {lastUpdate || "Cargando..."}
      </footer>
    </main>
  );
}





