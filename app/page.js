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
} from "recharts";

export default function Home() {
  const [crypto, setCrypto] = useState("bitcoin");
  const [data, setData] = useState([]);
  const [forecast, setForecast] = useState([]); // 📊 predicción
  const [price, setPrice] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [signal, setSignal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  // RSI
  function calculateRSI(prices, period = 14) {
    if (prices.length < period) return 50;
    let gains = 0,
      losses = 0;
    for (let i = 1; i < period; i++) {
      const diff = prices[i].price - prices[i - 1].price;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period || 1;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // Fetch datos
  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1) Históricos
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
        setPrice(formatted.at(-1)?.price ?? null);

        // --- Predicción con regresión lineal ---
        if (formatted.length > 0) {
          const prices = formatted.map((p) => p.price);
          const n = prices.length;
          const x = [...Array(n).keys()];
          const y = prices;

          const meanX = x.reduce((a, b) => a + b, 0) / n;
          const meanY = y.reduce((a, b) => a + b, 0) / n;

          const m =
            x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) /
            x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
          const b = meanY - m * meanX;

          const future = [...Array(7).keys()].map((i) => {
            const xi = n + i;
            return {
              date: `Día +${i + 1}`,
              forecast: m * xi + b,
            };
          });

          setForecast(future);
        }

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
          const ma30 =
            formatted.slice(-30).reduce((a, b) => a + b.price, 0) / 30;
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

          const newSignal = {
            time: new Date().toLocaleTimeString(),
            recommendation,
            probability,
            rsi,
            ma7,
            ma30,
          };

          setSignal(newSignal);
          setHistory((prev) => [newSignal, ...prev].slice(0, 10));
        }

        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("⚠️ Error detectado:", err.message);
          setError("⚠️ API saturada, reintentando...");
          setTimeout(() => {
            fetchData();
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [crypto]);

  function formatNumber(num) {
    if (!num) return "-";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(2);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">📈 Crypto Dashboard</h1>

      {/* Selector */}
      <select
        className="p-2 rounded-lg text-black"
        value={crypto}
        onChange={(e) => setCrypto(e.target.value)}
      >
        <option value="bitcoin">Bitcoin</option>
        <option value="ethereum">Ethereum</option>
        <option value="dogecoin">Dogecoin</option>
        <option value="cardano">Cardano</option>
      </select>

      {/* Precio */}
      <div className="mt-4 bg-gray-800 p-4 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold">💰 Precio actual</h2>
        <p className="text-2xl">
          {price ? `$${price.toFixed(2)}` : "Cargando..."}
        </p>
        <p className="text-sm text-gray-400">
          Última actualización: {lastUpdate}
        </p>
      </div>

      {/* Extra Data */}
      <div className="mt-4 bg-gray-800 p-4 rounded-2xl shadow-lg grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg">📊 Volumen 24h</h3>
          <p>{formatNumber(extraData.volume)} USD</p>
        </div>
        <div>
          <h3 className="text-lg">🏦 Market Cap</h3>
          <p>{formatNumber(extraData.marketCap)} USD</p>
        </div>
      </div>

      {/* Señal IA */}
      {signal && (
        <div className="mt-4 bg-gray-800 p-4 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold">🤖 Señal IA</h2>
          <p
            className={`text-2xl font-bold ${
              signal.recommendation.includes("Comprar")
                ? "text-green-400"
                : signal.recommendation.includes("Vender")
                ? "text-red-400"
                : "text-yellow-400"
            }`}
          >
            {signal.recommendation} ({signal.probability}% éxito)
          </p>
          <p>RSI: {signal.rsi.toFixed(2)}</p>
          <p>
            MA7: {signal.ma7.toFixed(2)} | MA30: {signal.ma30.toFixed(2)}
          </p>
        </div>
      )}

      {/* Historial */}
      <section className="p-6">
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
          <h2 className="text-lg font-semibold mb-2">📜 Historial de Señales IA</h2>
          {history.length ? (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="p-2">Hora</th>
                  <th className="p-2">Recomendación</th>
                  <th className="p-2">Prob.</th>
                  <th className="p-2">RSI</th>
                  <th className="p-2">MA7</th>
                  <th className="p-2">MA30</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="p-2">{h.time}</td>
                    <td
                      className={`p-2 font-bold ${
                        h.recommendation.includes("Comprar")
                          ? "text-green-400"
                          : h.recommendation.includes("Vender")
                          ? "text-red-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {h.recommendation}
                    </td>
                    <td className="p-2">{h.probability}%</td>
                    <td className="p-2">{h.rsi.toFixed(2)}</td>
                    <td className="p-2">{h.ma7.toFixed(2)}</td>
                    <td className="p-2">{h.ma30.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No hay historial aún...</p>
          )}
        </div>
      </section>

      {/* Gráfico */}
      <div className="mt-6 bg-gray-800 p-4 rounded-2xl shadow-lg h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...data, ...forecast]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              dot={false}
              name="Precio real"
            />
            <Line
              type="monotone"
              dataKey="ma7"
              stroke="#22c55e"
              dot={false}
              name="MA7"
            />
            <Line
              type="monotone"
              dataKey="ma30"
              stroke="#eab308"
              dot={false}
              name="MA30"
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f97316"
              dot={false}
              strokeDasharray="5 5"
              name="Predicción"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {error && <p className="text-red-400 mt-4">{error}</p>}
    </main>
  );
}






