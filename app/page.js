"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";

export default function Dashboard() {
  const [coin, setCoin] = useState("bitcoin");
  const [price, setPrice] = useState(null);
  const [history, setHistory] = useState([]);
  const [signal, setSignal] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Calcular media móvil
  const movingAverage = (data, windowSize) => {
    return data.map((_, i) => {
      if (i < windowSize - 1) return { ...data[i], [`ma${windowSize}`]: null };
      const slice = data.slice(i - windowSize + 1, i + 1);
      const avg =
        slice.reduce((sum, item) => sum + item.price, 0) / windowSize;
      return { ...data[i], [`ma${windowSize}`]: avg };
    });
  };

  useEffect(() => {
    const controller = new AbortController(); // 👈 para cancelar peticiones viejas

    const fetchData = async () => {
      try {
        setLoading(true);
        setPrice(null);
        setHistory([]);
        setSignal("");

        // Precio actual
        const resPrice = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`,
          { cache: "no-store", signal: controller.signal }
        );
        const jsonPrice = await resPrice.json();
        setPrice(jsonPrice[coin]?.usd || null);

        // Histórico
        const resHistory = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=30`,
          { cache: "no-store", signal: controller.signal }
        );
        const jsonHistory = await resHistory.json();

        const formatted = jsonHistory.prices.map(([timestamp, p]) => {
          const date = new Date(timestamp);
          return {
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            price: p,
          };
        });

        // Medias móviles
        let withMA7 = movingAverage(formatted, 7);
        let withMA30 = movingAverage(withMA7, 30);

        setHistory(withMA30);

        // Señal
        const last = withMA30[withMA30.length - 1];
        if (last?.ma7 && last?.ma30) {
          if (last.ma7 > last.ma30) {
            setSignal("📈 Tendencia alcista");
          } else {
            setSignal("📉 Tendencia bajista");
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error cargando datos:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 🔹 Cancelar si se cambia de moneda antes de terminar
    return () => controller.abort();
  }, [coin]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-center mb-10 text-blue-700">
        🚀 Dashboard IA Trading
      </h1>

      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        {/* Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold capitalize">{coin}</h2>
            <p className="text-gray-600">
              Precio actual:{" "}
              <span className="font-semibold text-black">
                {loading ? "Cargando..." : price ? `$${price}` : "Sin datos"}
              </span>
            </p>
          </div>

          <select
            className="border rounded px-3 py-2 shadow-sm"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
          >
            <option value="bitcoin">Bitcoin (BTC)</option>
            <option value="ethereum">Ethereum (ETH)</option>
            <option value="solana">Solana (SOL)</option>
            <option value="dogecoin">Dogecoin (DOGE)</option>
          </select>
        </div>

        {/* Señal */}
        <div className="mb-6 text-xl font-semibold text-center">
          {loading
            ? "⏳ Cargando señal..."
            : signal
            ? signal.includes("alcista")
              ? <span className="text-green-600">{signal}</span>
              : <span className="text-red-600">{signal}</span>
            : "Sin datos"}
        </div>

        {/* Gráfico */}
        <div className="w-full h-96">
          {loading ? (
            <p className="text-center text-gray-500 mt-20">⏳ Cargando gráfico...</p>
          ) : history.length > 0 ? (
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid stroke="#eee" />
                <XAxis dataKey="date" />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} name="Precio" />
                <Line type="monotone" dataKey="ma7" stroke="#16a34a" strokeWidth={2} dot={false} name="MA7" />
                <Line type="monotone" dataKey="ma30" stroke="#dc2626" strokeWidth={2} dot={false} name="MA30" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 mt-20">No hay datos para mostrar</p>
          )}
        </div>
      </div>
    </div>
  );
}

