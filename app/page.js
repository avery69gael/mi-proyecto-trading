"use client";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Toaster, toast } from "react-hot-toast";

export default function Home() {
  const [coin, setCoin] = useState("bitcoin");
  const [price, setPrice] = useState(null);
  const [data, setData] = useState([]);
  const [signal, setSignal] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Cargar alertas desde localStorage al iniciar
  useEffect(() => {
    const savedAlerts = localStorage.getItem("alerts");
    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
  }, []);

  // Guardar alertas cada vez que cambian
  useEffect(() => {
    localStorage.setItem("alerts", JSON.stringify(alerts));
  }, [alerts]);

  // Obtener datos de la API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resPrice = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`
        );
        const priceData = await resPrice.json();
        setPrice(priceData[coin].usd);

        const resHistory = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=30`
        );
        const history = await resHistory.json();

        const formatted = history.prices.map((p, i) => ({
          date: new Date(p[0]).toLocaleDateString(),
          price: p[1],
        }));
        setData(formatted);

        // Calcular medias móviles
        const ma = (arr, range) =>
          arr.map((_, i) => {
            if (i < range) return null;
            const slice = arr.slice(i - range, i);
            return slice.reduce((a, b) => a + b.price, 0) / slice.length;
          });

        const ma7 = ma(formatted, 7);
        const ma30 = ma(formatted, 30);
        const rsi =
          100 -
          100 /
            (1 +
              (formatted.slice(-14).reduce((acc, val, i, arr) => {
                if (i === 0) return acc;
                const diff = val.price - arr[i - 1].price;
                return acc + (diff > 0 ? diff : 0);
              }, 0) /
                formatted
                  .slice(-14)
                  .reduce((acc, val, i, arr) => {
                    if (i === 0) return acc;
                    const diff = val.price - arr[i - 1].price;
                    return acc + (diff < 0 ? -diff : 0);
                  }, 0)));

        let recommendation = "Mantener";
        let probability = 50;

        if (rsi < 30 && ma7[ma7.length - 1] > ma30[ma30.length - 1]) {
          recommendation = "Comprar";
          probability = 75;
        } else if (rsi > 70 && ma7[ma7.length - 1] < ma30[ma30.length - 1]) {
          recommendation = "Vender";
          probability = 75;
        }

        setSignal({ rsi, ma7: ma7[ma7.length - 1], ma30: ma30[ma30.length - 1], recommendation, probability });

        // Predicción simple con regresión lineal
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
      } catch (error) {
        console.error("❌ Error al cargar datos:", error);
      }
    };

    fetchData();
  }, [coin]);

  // Comprobar alertas
  useEffect(() => {
    if (!price || !signal) return;

    alerts.forEach((alert) => {
      let triggered = false;

      if (alert.type === "priceAbove" && price > alert.value) triggered = true;
      if (alert.type === "priceBelow" && price < alert.value) triggered = true;
      if (alert.type === "rsiAbove" && signal.rsi > alert.value) triggered = true;
      if (alert.type === "rsiBelow" && signal.rsi < alert.value) triggered = true;

      if (triggered) {
        toast(`🚨 Alerta cumplida: ${alert.type} ${alert.value}`);
      }
    });
  }, [price, signal, alerts]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <Toaster position="top-right" />

      {/* Navbar */}
      <header className="p-6 bg-gray-900/80 backdrop-blur-md shadow-lg flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-2xl font-bold">🚀 CryptoSignals IA</h1>
        <select
          className="p-2 rounded bg-gray-800 border border-gray-600"
          onChange={(e) => setCoin(e.target.value)}
        >
          <option value="bitcoin">Bitcoin</option>
          <option value="ethereum">Ethereum</option>
          <option value="dogecoin">Dogecoin</option>
        </select>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Precio */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold">💰 Precio actual</h2>
          <p className="text-3xl mt-2">${price ?? "Cargando..."}</p>
        </div>

        {/* Señales IA */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold">🤖 Señal IA</h2>
          {signal ? (
            <p
              className={`text-2xl mt-2 font-bold ${
                signal.recommendation === "Comprar"
                  ? "text-green-400"
                  : signal.recommendation === "Vender"
                  ? "text-red-400"
                  : "text-yellow-400"
              }`}
            >
              {signal.recommendation} ({signal.probability}%)
            </p>
          ) : (
            <p>Cargando...</p>
          )}
        </div>
      </section>

      {/* Crear alerta */}
      <section className="p-6">
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
          <h2 className="text-lg font-semibold mb-2">⚡ Crear alerta</h2>
          <div className="flex gap-2">
            <select id="type" className="p-2 rounded bg-gray-700 text-white">
              <option value="priceAbove">Precio &gt; X</option>
              <option value="priceBelow">Precio &lt; X</option>
              <option value="rsiAbove">RSI &gt; X</option>
              <option value="rsiBelow">RSI &lt; X</option>
            </select>
            <input
              type="number"
              id="value"
              placeholder="Valor"
              className="p-2 rounded bg-gray-700 text-white"
            />
            <button
              onClick={() => {
                const type = document.getElementById("type").value;
                const value = parseFloat(document.getElementById("value").value);
                if (!isNaN(value)) {
                  setAlerts([...alerts, { type, value }]);
                  toast.success("✅ Alerta añadida");
                }
              }}
              className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded"
            >
              Añadir
            </button>
          </div>
        </div>
      </section>

      {/* Gráfico */}
      <section className="p-6">
        <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
          <h2 className="text-lg font-semibold mb-2">📈 Gráfico de precios</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={[...data, ...forecast]}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <Line type="monotone" dataKey="price" stroke="#3b82f6" dot={false} name="Precio real" />
              <Line type="monotone" dataKey="forecast" stroke="#f97316" dot={false} strokeDasharray="5 5" name="Predicción" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}







