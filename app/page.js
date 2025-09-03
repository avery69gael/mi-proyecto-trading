"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Datos de ejemplo (luego se conectarán a tu IA/backend)
    const exampleData = [
      { date: "2025-08-25", price: 61000, proba: 0.62, signal: "BUY" },
      { date: "2025-08-26", price: 61800, proba: 0.58, signal: "BUY" },
      { date: "2025-08-27", price: 60500, proba: 0.45, signal: "SELL" },
      { date: "2025-08-28", price: 61200, proba: 0.51, signal: "HOLD" },
      { date: "2025-08-29", price: 62000, proba: 0.65, signal: "BUY" },
    ];
    setData(exampleData);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-4 text-center">
        📊 Dashboard IA - Trading
      </h1>

      {/* Gráfico */}
      <div className="mb-6 rounded-2xl shadow bg-white p-4">
        <h2 className="text-xl font-semibold mb-2">Bitcoin (BTC/USDT)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#2563eb"
              name="Precio"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla de señales */}
      <div className="rounded-2xl shadow bg-white p-4">
        <h2 className="text-xl font-semibold mb-2">Señales recientes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Precio</th>
              <th className="text-left p-2">Probabilidad ↑</th>
              <th className="text-left p-2">Señal IA</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{row.date}</td>
                <td className="p-2">${row.price}</td>
                <td className="p-2">{(row.proba * 100).toFixed(1)}%</td>
                <td className="p-2 font-bold">
                  {row.signal === "BUY" && (
                    <span className="text-green-600">BUY 🚀</span>
                  )}
                  {row.signal === "SELL" && (
                    <span className="text-red-600">SELL 📉</span>
                  )}
                  {row.signal === "HOLD" && (
                    <span className="text-gray-600">HOLD ⚖️</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA monetización */}
      <div className="text-center mt-6">
        <button className="px-6 py-2 text-lg bg-blue-600 text-white rounded-2xl shadow hover:bg-blue-700 transition">
          🔒 Accede al Plan Premium
        </button>
        <p className="text-gray-500 text-sm mt-2">
          Desbloquea señales avanzadas y análisis en tiempo real
        </p>
      </div>
    </div>
  );
}
