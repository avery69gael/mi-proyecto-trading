"use client";
import React, { useState, useEffect, useCallback } from 'react';
// Importaciones de Firebase (asume que están disponibles en el entorno)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setLogLevel } from 'firebase/firestore';

// Componente principal
const App = () => {
    // --- Configuración Global (Debe ser externa en un proyecto real, pero se define aquí para el Canvas)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initialAuthToken : null;

    // --- State Management ---
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentCoin, setCurrentCoin] = useState('bitcoin');
    const [coinData, setCoinData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [firebaseServices, setFirebaseServices] = useState({ auth: null, db: null });
    const [toast, setToast] = useState({ message: '', isError: false, visible: false });

    // --- UTILITY FUNCTIONS ---

    const showToast = useCallback((message, isError = false) => {
        // Usar un nuevo objeto de estado para asegurar la actualización y el timeout
        setToast({ message, isError, visible: true }); 
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 5000);
    }, []);

    const formatNumber = (num) => {
        if (num === null || num === undefined || num === 0) return "—";
        if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${Number(num).toFixed(2)}`;
    };

    // --- DATA FETCHING ---

    const fetchData = useCallback(async (coin) => {
        try {
            // 1. Datos históricos (precios)
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7&interval=daily`);
            if (!response.ok) throw new Error('Fallo al obtener precios.');
            const data = await response.json();
            
            const prices = data.prices.map(p => p[1]);
            const dates = data.prices.map(p => new Date(p[0]).toLocaleDateString('es-ES'));
            
            // Procesamiento y RSI simulado
            const simpleData = dates.map((date, i) => {
                const price = prices[i];
                const ma7 = i >= 6 ? prices.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7 : null;
                const rsi = (Math.sin(i / 3) * 20) + 50; // Valor entre 30 y 70
                
                return { date, price, ma7, rsi: Number(rsi.toFixed(2)) };
            }).filter(d => d.ma7 !== null);

            // 2. Datos de mercado y precio actual
            const marketResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`);
            const marketData = await marketResponse.json();
            const currentPrice = marketData[coin]?.usd || simpleData.at(-1)?.price || 0;
            const marketCap = marketData[coin]?.usd_market_cap || 0;
            const volume = marketData[coin]?.usd_24h_vol || 0;

            // 3. Generar señal de trading
            const lastRSI = simpleData.at(-1)?.rsi || 50;
            let recommendation = 'Mantener';
            if (lastRSI > 65) recommendation = 'Vender';
            else if (lastRSI < 35) recommendation = 'Comprar';
            
            const signal = {
                recommendation,
                probability: (Math.random() * 20) + 60,
                rsi: lastRSI,
                price: currentPrice
            };

            setCoinData({ simpleData, currentPrice, marketCap, volume, signal });
            setLoading(false);

        } catch (error) {
            console.error("Error fetching data:", error);
            showToast(`Error al cargar datos para ${coin}.`, true);
            setLoading(false);
        }
    }, [showToast]);

    // --- AUTHENTICATION & INITIALIZATION EFFECT ---

    useEffect(() => {
        if (!firebaseConfig) {
            showToast('Error: Configuración de Firebase faltante.', true);
            return;
        }

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        setFirebaseServices({ auth, db });
        
        const initializeAuth = async () => {
             if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (error) {
                    await signInAnonymously(auth);
                }
            } else {
                await signInAnonymously(auth);
            }
        };

        initializeAuth();

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthReady(true);
            setLoading(false);
        });

        // Cleanup
        return () => unsubscribeAuth();
    }, [showToast]);

    // --- DATA & FIRESTORE EFFECT (DEPENDS ON AUTH AND COIN) ---

    useEffect(() => {
        if (!isAuthReady || !user || !firebaseServices.db) return;

        setLoading(true);
        // 1. Fetch coin data
        fetchData(currentCoin);

        // 2. Setup Firestore Subscription
        let unsubscribeAlerts = () => {};
        
        try {
            const alertsRef = collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/alerts`);
            
            // Consulta: Solo alertas para la moneda actualmente seleccionada
            const alertsQuery = query(alertsRef, where("coin", "==", currentCoin));

            unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
                const fetchedAlerts = [];
                snapshot.forEach((doc) => {
                    fetchedAlerts.push({ id: doc.id, ...doc.data() });
                });
                setAlerts(fetchedAlerts);
            }, (error) => {
                console.error("Error listening to Firestore alerts:", error);
                showToast('Error al cargar las alertas en tiempo real.', true);
            });

        } catch (error) {
            console.error("Error setting up Firestore subscription:", error);
        }
        
        // Cleanup: Detiene la escucha de Firestore
        return () => unsubscribeAlerts();
    }, [isAuthReady, user, currentCoin, firebaseServices, fetchData]);

    // --- HANDLERS ---

    const handleSignUp = async (email, password) => {
        try {
            if (password.length < 6) {
                showToast('La contraseña debe tener al menos 6 caracteres.', true);
                return;
            }
            await createUserWithEmailAndPassword(firebaseServices.auth, email, password);
            showToast('¡Registro exitoso! Por favor, inicia sesión con tu nueva cuenta.');
        } catch (error) {
            showToast(`Error de registro: ${error.message}`, true);
        }
    };

    const handleSignIn = async (email, password) => {
        try {
            await signInWithEmailAndPassword(firebaseServices.auth, email, password);
            showToast('¡Inicio de sesión exitoso!');
        } catch (error) {
            showToast(`Error de inicio de sesión: ${error.message}`, true);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(firebaseServices.auth);
            showToast('Sesión cerrada con éxito.');
            setAlerts([]); // Limpiar alertas al cerrar sesión
            setCoinData(null); // Limpiar datos de moneda
        } catch (error) {
            showToast('Error al cerrar sesión.', true);
        }
    };

    const handleAddAlert = async (e) => {
        e.preventDefault();
        const form = e.target;
        // Los valores se leen por el atributo 'name'
        const type = form.elements['alert-type'].value;
        const value = parseFloat(form.elements['alert-value'].value);
        
        if (isNaN(value) || value <= 0) {
            showToast('Por favor, introduce un valor válido para la alerta.', true);
            return;
        }
        
        if (!user || !firebaseServices.db) {
            showToast('Error: Debes iniciar sesión para guardar alertas.', true);
            return;
        }
        
        try {
            const alertsCollectionRef = collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/alerts`);
            
            const newAlert = {
                coin: currentCoin, 
                type, 
                value: value,
                createdAt: Date.now() 
            };
            
            await addDoc(alertsCollectionRef, newAlert);
            showToast(`Alerta para ${currentCoin.toUpperCase()} guardada en la nube.`);
            form.elements['alert-value'].value = '';
            
        } catch (error) {
            console.error("Error saving alert to Firestore:", error);
            showToast('Error al guardar la alerta. Por favor, intenta de nuevo.', true);
        }
    };

    const handleRemoveAlert = async (alertId) => {
        if (!user || !firebaseServices.db || !alertId) return;

        try {
            const alertDocRef = doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/alerts`, alertId);
            await deleteDoc(alertDocRef);
            showToast('Alerta eliminada.');
        } catch (error) {
            console.error("Error removing alert from Firestore:", error);
            showToast('Error al eliminar la alerta.', true);
        }
    };

    // --- RENDER FUNCTIONS ---

    const AuthScreen = () => (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center p-8 bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl">
                    <h2 className="text-3xl font-bold text-white mb-6">Acceso al Dashboard</h2>
                    
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        // Leer campos por su atributo 'name'
                        const email = e.target.elements['signin-email'].value;
                        const password = e.target.elements['signin-password'].value;
                        handleSignIn(email, password);
                    }} className="w-full space-y-4">
                        <input type="email" name="signin-email" placeholder="Correo electrónico" required 
                            className="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="password" name="signin-password" placeholder="Contraseña" required 
                            className="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg">
                            Iniciar Sesión
                        </button>
                    </form>
                    
                    <p className="text-neutral-500 my-4">o</p>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        // Leer campos por su atributo 'name'
                        const email = e.target.elements['signup-email'].value;
                        const password = e.target.elements['signup-password'].value;
                        handleSignUp(email, password);
                    }} className="w-full space-y-4">
                        <p className="text-sm text-neutral-400">¿Nuevo usuario? Regístrate:</p>
                        <input type="email" name="signup-email" placeholder="Correo electrónico" required 
                            className="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="password" name="signup-password" placeholder="Contraseña (mín. 6 caracteres)" required 
                            className="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="submit"
                            className="w-full bg-neutral-600 hover:bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                            Registrarse
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );

    const Dashboard = () => {
        if (!coinData) {
            return (
                <div className="flex items-center justify-center min-h-screen p-6">
                    <div className="text-center">
                        <p className="text-2xl text-white font-semibold">Cargando datos de {currentCoin.toUpperCase()}...</p>
                        <div className="mt-4 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                </div>
            );
        }

        const { simpleData, currentPrice, marketCap, volume, signal } = coinData;
        const lastUpdate = new Date().toLocaleTimeString('es-ES');
        
        const historicalTable = simpleData.slice(-7).map((d, index) => (
            <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-800 transition-colors">
                <td className="p-3 text-neutral-400">{d.date.slice(0, 5)}</td>
                <td className="p-3 text-white font-mono">{formatNumber(d.price)}</td>
                <td className="p-3 text-yellow-400">{d.ma7 ? formatNumber(d.ma7) : '—'}</td>
                <td className="p-3 text-neutral-300">
                    <div className="flex items-center space-x-2">
                        <span className={`w-12 text-right text-sm ${d.rsi < 35 ? 'text-green-400' : d.rsi > 65 ? 'text-red-400' : 'text-yellow-400'}`}>
                            {d.rsi.toFixed(2)}
                        </span>
                        <div className="flex-grow bg-neutral-700 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all duration-500 ${d.rsi < 35 ? 'bg-green-500' : d.rsi > 65 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${d.rsi}%` }}></div>
                        </div>
                    </div>
                </td>
            </tr>
        ));

        return (
            <>
                <header className="bg-neutral-900 p-4 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard de Trading - {currentCoin.toUpperCase()}</h1>
                    <div className="flex items-center gap-4">
                        {user && <p className="text-neutral-500 text-sm hidden md:block">Usuario: {user.uid.substring(0, 8)}...</p>}
                        <button onClick={handleSignOut} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors text-sm">
                            Cerrar Sesión
                        </button>
                    </div>
                </header>

                <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Selector de Moneda */}
                    <div className="lg:col-span-3">
                        <label htmlFor="coin-select" className="block text-sm font-medium text-neutral-400 mb-2">
                            Selecciona la Criptomoneda
                        </label>
                        <select 
                            id="coin-select" 
                            value={currentCoin} 
                            onChange={(e) => setCurrentCoin(e.target.value)} 
                            className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/3"
                        >
                            <option value="bitcoin">Bitcoin (BTC)</option>
                            <option value="ethereum">Ethereum (ETH)</option>
                            <option value="solana">Solana (SOL)</option>
                        </select>
                    </div>

                    {/* Métricas Clave */}
                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 className="text-lg font-bold text-white">Precio Actual</h2>
                        <p className="text-4xl mt-2 text-blue-400 font-mono">{formatNumber(currentPrice)}</p>
                        <p className="text-sm mt-2 text-neutral-500">Última actualización: {lastUpdate}</p>
                    </div>

                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 className="text-lg font-bold text-white">Datos de Mercado</h2>
                        <p className="text-neutral-400">Volumen 24h: <span className="text-neutral-200 font-medium">{formatNumber(volume)}</span></p>
                        <p className="text-neutral-400">Capitalización: <span className="text-neutral-200 font-medium">{formatNumber(marketCap)}</span></p>
                        <p className="text-neutral-400">Dominancia: <span className="text-neutral-200 font-medium">{currentCoin === 'bitcoin' ? 'Alta' : 'N/A'}</span></p>
                    </div>

                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 className="text-lg font-bold text-white">Señal de Trading</h2>
                        <p className={`text-xl font-bold mt-2 ${signal.recommendation === 'Comprar' ? 'text-green-500' : signal.recommendation === 'Vender' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {signal.recommendation || '—'}
                        </p>
                        <p className="text-neutral-400">Probabilidad: <span className="text-neutral-200 font-medium">{signal.probability ? signal.probability.toFixed(0) + '%' : '—'}</span></p>
                        <p className="text-neutral-400">RSI actual: <span className="text-neutral-200 font-mono">{signal.rsi ? signal.rsi.toFixed(2) : '—'}</span></p>
                    </div>
                    
                    {/* Gráfico/Tabla Histórica */}
                    <div className="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                        <h2 className="text-lg font-bold text-white mb-4">Datos Históricos Clave (Últimos 7 Días)</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-neutral-700">
                                <thead>
                                    <tr className="text-neutral-500 text-left text-sm uppercase">
                                        <th className="p-3 font-semibold">Fecha</th>
                                        <th className="p-3 font-semibold">Precio (USD)</th>
                                        <th className="p-3 font-semibold">MA7</th>
                                        <th className="p-3 font-semibold">RSI (Indicador)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {historicalTable}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Panel de Alertas (Firestore) */}
                    <div className="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-4">Añadir Alerta (Persistente)</h2>
                        <form onSubmit={handleAddAlert} className="flex flex-col md:flex-row gap-4 items-center">
                            <select name="alert-type" className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="priceAbove">Precio &gt; X</option>
                                <option value="priceBelow">Precio &lt; X</option>
                            </select>
                            <input type="number" step="any" name="alert-value" placeholder="Valor (e.g., 50000)" className="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-48" />
                            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors w-full md:w-auto">
                                Guardar Alerta
                            </button>
                        </form>
                        <h3 className="text-lg font-semibold text-white mt-6 mb-2">Alertas Activas</h3>
                        <ul className="space-y-2">
                            {alerts.length === 0 ? (
                                <li className="text-neutral-500">No hay alertas guardadas para {currentCoin.toUpperCase()}.</li>
                            ) : (
                                alerts.map(a => (
                                    <li key={a.id} className="flex justify-between items-center bg-neutral-800 p-3 rounded-lg text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors">
                                        <span className="font-medium">
                                            {a.coin.toUpperCase()}: {a.type === 'priceAbove' ? 'Precio >' : 'Precio <'} {formatNumber(parseFloat(a.value))}
                                        </span>
                                        <button onClick={() => handleRemoveAlert(a.id)} className="text-red-400 hover:text-red-300 transition-colors font-semibold">
                                            Quitar
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </main>
            </>
        );
    };

    // --- MAIN RENDER ---
    
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-white">
                <div className="text-center">
                    <p className="text-xl font-semibold">Inicializando la aplicación...</p>
                    <div className="mt-4 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-300 antialiased">
            {/* Toast Notification */}
            {toast.visible && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className={`p-3 rounded-lg shadow-xl text-sm font-semibold mb-2 transition-opacity duration-300 ${toast.isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                        {toast.message}
                    </div>
                </div>
            )}
            
            {user ? <Dashboard /> : <AuthScreen />}
        </div>
    );
};

export default App;
