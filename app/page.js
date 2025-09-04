"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [coin, setCoin] = useState("bitcoin"); // moneda seleccionada
  const [price, setPrice] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔹 Resetear valores al cambiar moneda
        setPrice(null);
        setHistory([]);

        // Precio actual
        const resPrice = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`,
          { cache: "no-store" } // evita usar datos viejos
        );
        const jsonPrice = await resPrice.json();
        setPrice(jsonPrice[coin].usd);

        // Histórico de 7 días
        const resHistory = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7`,
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

        setHistory(formatted);
      } catch (err) {
        console.error("Error cargando datos:", err);
      }
    };

    fetchData();
  }, [coin]); // 👈 se actualiza cada vez que cambias de moneda

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

      {/* 🔹 Mostrar precio actual */}
      <p className="mb-6 text-lg">
        Precio actual de{" "}
        <span className="font-semibold capitalize">{coin}</span>:{" "}
        {price ? `$${price}` : "Cargando..."}
      </p>

      {/* 🔹 Gráfico histórico */}
      <div className="w-full h-64 mb-6">
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="date" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

