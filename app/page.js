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

  // 🔹 Función para calcular media móvil
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
    const fetchData = async () => {
      try {
        setPrice(null);
        setHistory([]);
        setSignal("");

        // Precio actual
        const resPrice = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`,
          { cache: "no-store" }
        );
        const jsonPrice = await resPrice.json();
        setPrice(jsonPrice[coin].usd);

        // Histórico (30 días para calcular MA30)
        const resHistory = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=30`,
          { cache: "no-store" }
        );
        const jsonHistory = await resHistory.json();

        const formatted = jsonHistory.prices.map(([timestamp, p]) => {
          const date = new Date(timestamp);
          return {
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            price: p,
          };
        });

        // Calcular medias móviles
        let withMA7 = movingAverage(formatted, 7);
        let withMA30 = movingAverage(withMA7, 30);

        setHistory(withMA30);

        // Señal alcista o bajista (último dato)
        const last = withMA30[withMA30.length - 1];
        if (last.ma7 && last.ma30) {
          if (last.ma7 > last.ma30) {
            setSignal("📈 Tendencia alcista (MA7 > MA30)");
          } else {
            setSignal("📉 Tendencia bajista (MA7 < MA30)");
          }
        }
      } catch (err) {
        console.error("Error cargando datos:", err);
      }
    };

    fetchData();
  }, [coin]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">📊 Dashboard IA Trading</h1>

      {/* 🔹 Selector de monedas */}
      <div className="mb-6">
        <label className="mr-2 font-semibold">Selecciona una moneda:</label>
        <select
          className="border rounded px-2 py-1"
          value={coin}
          onChange={(e) => setCoin(e.target.value)}
        >
          <option value="bitcoin">Bitcoin (BTC)</option>
          <option value="ethereum">Ethereum (ETH)</option>
          <option value="solana">Solana (SOL)</option>
          <option value="dogecoin">Dogecoin (DOGE)</option>
        </select>
      </div>

      {/* 🔹 Precio actual */}
      <p className="mb-2 text-lg">
        Precio actual de{" "}
        <span className="font-semibold capitalize">{coin}</span>:{" "}
        {price ? `$${price}` : "Cargando..."}
      </p>

      {/* 🔹 Señal */}
      <p className="mb-6 text-xl font-bold">
        {signal ? signal : "Calculando señal..."}
      </p>

      {/* 🔹 Gráfico */}
      <div className="w-full h-80 mb-6">
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="date" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} name="Precio" />
            <Line type="monotone" dataKey="ma7" stroke="#16a34a" strokeWidth={2} dot={false} name="MA7" />
            <Line type="monotone" dataKey="ma30" stroke="#dc2626" strokeWidth={2} dot={false} name="MA30" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

