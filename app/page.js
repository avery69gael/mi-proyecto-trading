"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [btcPrice, setBtcPrice] = useState(null);
  const [data, setData] = useState([]);

  // 🔹 Llamada a la API de CoinGecko
  useEffect(() => {
    const fetchBTC = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const json = await res.json();
        setBtcPrice(json.bitcoin.usd);

        // Simulación de histórico con datos random alrededor del precio actual
        const fakeData = Array.from({ length: 10 }).map((_, i) => ({
          name: `T${i + 1}`,
          value: json.bitcoin.usd + (Math.random() * 2000 - 1000),
        }));
        setData(fakeData);
      } catch (err) {
        console.error("Error cargando BTC:", err);
      }
    };

    fetchBTC();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">📈 Dashboard IA Trading</h1>
      <p className="mb-6">Precio actual de Bitcoin: {btcPrice ? `$${btcPrice}` : "Cargando..."}</p>

      <div className="w-full h-64 mb-6">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

