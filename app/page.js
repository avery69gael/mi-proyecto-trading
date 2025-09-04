"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [prices, setPrices] = useState({});
  const [history, setHistory] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔹 1. Precios actuales de varias cryptos
        const resPrices = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd"
        );
        const jsonPrices = await resPrices.json();
        setPrices(jsonPrices);

        // 🔹 2. Histórico de cada cripto (últimos 7 días)
        const coins = ["bitcoin", "ethereum", "solana"];
        const historyData = {};

        for (let coin of coins) {
          const resHistory = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7`
          );
          const jsonHistory = await resHistory.json();

          historyData[coin] = jsonHistory.prices.map(([timestamp, price]) => {
            const date = new Date(timestamp);
            return {
              date: `${date.getDate()}/${date.getMonth() + 1}`,
              price: price,
            };
          });
        }

        setHistory(historyData);
      } catch (err) {
        console.error("Error cargando datos:", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">📊 Dashboard IA Trading</h1>

      {/* 🔹 Mostrar precios actuales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold">Bitcoin (BTC)</h2>
          <p className="text-green-600 text-2xl">
            {prices.bitcoin ? `$${prices.bitcoin.usd}` : "Cargando..."}
          </p>
        </div>
        <div className="p-4 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold">Ethereum (ETH)</h2>
          <p className="text-green-600 text-2xl">
            {prices.ethereum ? `$${prices.ethereum.usd}` : "Cargando..."}
          </p>
        </div>
        <div className="p-4 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold">Solana (SOL)</h2>
          <p className="text-green-600 text-2xl">
            {prices.solana ? `$${prices.solana.usd}` : "Cargando..."}
          </p>
        </div>
      </div>

      {/* 🔹 Gráfico de cada cripto */}
      {["bitcoin", "ethereum", "solana"].map((coin) => (
        <div key={coin} className="mb-10">
          <h2 className="text-2xl font-bold mb-4">
            {coin.charAt(0).toUpperCase() + coin.slice(1)} (últimos 7 días)
          </h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={history[coin]}>
                <CartesianGrid stroke="#ccc" />
                <XAxis dataKey="date" />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={
                    coin === "bitcoin"
                      ? "#f7931a"
                      : coin === "ethereum"
                      ? "#3c3c3d"
                      : "#14f195"
                  }
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
