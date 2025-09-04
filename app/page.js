"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";

export default function Dashboard() {
  const [coin, setCoin] = useState("bitcoin");
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [history, setHistory] = useState([]);
  const [signal, setSignal] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Calcular media móvil
  const movingAverage = (data, windowSize) => {
    return data.map((_, i) => {
      if (i < windowSize - 1) return { ...data[i], [`ma${windowSize}`]: null };
      const slice = data.slice(i - windowSize + 1, i + 1);
      const avg = slice.reduce((sum, item) => sum + item.price, 0) / windowSize;
      return { ...data[i], [`ma${windowSize}`]: avg };
    });
  };

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setPrevPrice(price);
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
          return { date: `${date.getDate()}/${date.getMonth() + 1}`, price: p };
        });

        // Medias móviles
        let withMA7 = movingAverage(formatted, 7);
        let withMA30 = movingAverage(withMA7, 30);

        setHistory(withMA30);

        // Señal
        const last = withMA30[withMA30.length - 1];
        if (last?.ma7 && last?.ma30) {
          setSignal(last.ma7 > last.ma30 ? "📈 Tendencia alcista" : "📉 Tendencia bajista");
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [coin]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-extrabold text-center mb-10 text-blue-700 tracking-tight">
        🚀 Dashboard IA Trading
      </h1>

      {/* Layout en tarjetas */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Tarjeta de Precio */}
        <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <h2 className="text-xl font-bold capitalize mb-2">{coin}</h2>
          <div
            className={`px-4 py-3 rounded-lg text-2xl font-semibold shadow-sm text-center ${
              price && prevPrice
                ? price > prevPrice
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {loading
              ? "⏳"
              : price
              ? `$${price.toLocaleString()}`
              : "Sin datos"}
          </div>
          <select
            className="mt-4 border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
          >
            <option value="bitcoin">Bitcoin (BTC)</option>
            <option value="ethereum">Ethereum (ETH)</option>
            <option value="solana">Solana (SOL)</option>
            <option value="dogecoin">Dogecoin (DOGE)</option>
          </select>
        </div>

        {/* Tarjeta de Señal */}
        <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold mb-4">Señal de Trading</h2>
          {loading ? (
            <div className="flex justify-center items-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : signal ? (
            signal.includes("alcista") ? (
              <span className="text-green-600 text-2xl font-semibold">{signal}</span>
            ) : (
              <span className="text-red-600 text-2xl font-semibold">{signal}</span>
            )
          ) : (
            <span className="text-gray-500">Sin datos</span>
          )}
        </div>

        {/* Tarjeta de Gráfico */}
        <div className="bg-white p-6 rounded-2xl shadow-lg col-span-1 md:col-span-3">
          <h2 className="text-xl font-bold mb-4">Gráfico de {coin}</h2>
          <div className="w-full h-96">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
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
    </div>
  );
}
