"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [btcPrice, setBtcPrice] = useState(null);
  const [history, setHistory] = useState([]);

  // 🔹 Llamar a la API de CoinGecko
  useEffect(() => {
    const fetchBTC = async () => {
      try {
        // Precio actual
        const resPrice = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const jsonPrice = await resPrice.json();
        setBtcPrice(jsonPrice.bitcoin.usd);

        // Histórico de 7 días
        const resHistory = await fetch(
          "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7"
        );
        const jsonHistory = await resHistory.json();

        // Convertimos datos al formato que Recharts entiende
        const formatted = jsonHistory.prices.map(([timestamp, price]) => {
          const date = new Date(timestamp);
          return {
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            price: price,
          };
        });

        setHistory(formatted);
      } catch (err) {
        console.error("Error cargando BTC:", err);
      }
    };

    fetchBTC();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">📊 Dashboard IA Trading</h1>
      <p className="mb-6">Precio actual de Bitcoin: {btcPrice ? `$${btcPrice}` : "Cargando..."}</p>

      <div className="w-full h-64 mb-6">
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="date" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

