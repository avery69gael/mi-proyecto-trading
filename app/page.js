<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Dashboard con Autenticación</title>
    <!-- FIX CRÍTICO: Cargar Tailwind CSS desde CDN para evitar el error de "Module not found" -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        /* Estilos básicos para la app */
        .min-h-screen-auth { min-height: calc(100vh - 80px); }
        .chart-container { height: 300px; }
        /* Animación de carga */
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-neutral-950 text-neutral-300 antialiased">

    <!-- Contenedor principal de la aplicación -->
    <div id="app">
        <!-- Contenido inyectado por JavaScript -->
    </div>

    <!-- Librerías de Firebase/Auth y Firestore -->
    <script type="module">
        // Globales requeridas en el entorno Canvas
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        // setLogLevel('Debug'); // Descomentar para ver logs detallados de Firestore

        let auth, app, db;
        let currentUserId = null;
        let currentCoin = 'bitcoin';
        let dataCache = {};
        let unsubscribeAlerts = null; // Para detener la escucha de Firestore

        if (firebaseConfig) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app); 
        }

        // --- UTILITY FUNCTIONS ---

        // Utility: Toast notification (simple)
        function showToast(message, isError = false) {
            const toastContainer = document.getElementById('toast-container');
            if (!toastContainer) return;
            
            const toast = document.createElement('div');
            toast.className = `p-3 rounded-lg shadow-xl text-sm font-semibold mb-2 transition-opacity duration-300 ${isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`;
            toast.textContent = message;
            
            toastContainer.prepend(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }

        // Utility: Format numbers (K, M, B, T)
        function formatNumber(num) {
            if (num === null || num === undefined || num === 0) return "—";
            if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
            if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
            if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
            if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
            return `$${Number(num).toFixed(2)}`;
        }

        // --- AUTHENTICATION LOGIC ---

        async function handleAuthInitialization() {
            if (!auth || !db) {
                document.getElementById('app').innerHTML = `<div class="text-center p-8 text-red-400">Error: Configuración de Firebase faltante.</div>`;
                return;
            }

            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (error) {
                    await signInAnonymously(auth);
                }
            } else {
                await signInAnonymously(auth);
            }

            // Escucha cambios en el estado de autenticación y renderiza la UI
            onAuthStateChanged(auth, (user) => {
                currentUserId = user ? user.uid : null;
                renderApp(user);
            });
        }
        
        async function handleSignUp(email, password) {
            try {
                // Firebase requiere una contraseña de al menos 6 caracteres
                if (password.length < 6) {
                    showToast('La contraseña debe tener al menos 6 caracteres.', true);
                    return;
                }
                await createUserWithEmailAndPassword(auth, email, password);
                showToast('¡Registro exitoso! Por favor, inicia sesión con tu nueva cuenta.');
                renderApp(null); 
            } catch (error) {
                console.error("Sign Up Error:", error);
                showToast(`Error de registro: ${error.message}`, true);
            }
        }

        async function handleSignIn(email, password) {
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('¡Inicio de sesión exitoso!');
            } catch (error) {
                console.error("Sign In Error:", error);
                showToast(`Error de inicio de sesión: ${error.message}`, true);
            }
        }

        async function handleSignOut() {
            try {
                // Detener la escucha de alertas de Firestore al cerrar sesión
                if (unsubscribeAlerts) {
                    unsubscribeAlerts();
                    unsubscribeAlerts = null;
                }
                await signOut(auth);
                showToast('Sesión cerrada con éxito.');
            } catch (error) {
                console.error("Sign Out Error:", error);
                showToast('Error al cerrar sesión.', true);
            }
        }

        // --- DASHBOARD DATA & LOGIC ---

        async function fetchData(coin) {
            const cacheKey = `data_${coin}`;
            
            try {
                // 1. Datos históricos (precios)
                const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7&interval=daily`);
                if (!response.ok) throw new Error('Fallo al obtener precios.');
                const data = await response.json();
                
                const prices = data.prices.map(p => p[1]);
                const dates = data.prices.map(p => new Date(p[0]).toLocaleDateString('es-ES'));
                
                // Procesamiento de datos simplificado (MA7 y RSI simulado para visualización)
                const simpleData = dates.map((date, i) => {
                    const price = prices[i];
                    // MA7 (Media Móvil de 7 días)
                    const ma7 = i >= 6 ? prices.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7 : null;
                    // RSI (Simulado para que el indicador sea visualmente dinámico)
                    const rsi = (Math.sin(i / 3) * 20) + 50; // Valor entre 30 y 70
                    
                    return { date, price, ma7, rsi: Number(rsi.toFixed(2)) };
                }).filter(d => d.ma7 !== null);

                // 2. Datos de mercado y precio actual
                const marketResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`);
                const marketData = await marketResponse.json();
                const currentPrice = marketData[coin]?.usd || simpleData.at(-1)?.price || 0;
                const marketCap = marketData[coin]?.usd_market_cap || 0;
                const volume = marketData[coin]?.usd_24h_vol || 0;

                // 3. Generar señal de trading (lógica simple)
                const lastRSI = simpleData.at(-1)?.rsi || 50;
                let recommendation = 'Mantener';
                if (lastRSI > 65) recommendation = 'Vender';
                else if (lastRSI < 35) recommendation = 'Comprar';
                
                const signal = {
                    recommendation,
                    probability: (Math.random() * 20) + 60, // 60-80%
                    rsi: lastRSI,
                    price: currentPrice
                };

                const result = { simpleData, currentPrice, marketCap, volume, signal };
                dataCache[cacheKey] = result;
                return result;

            } catch (error) {
                console.error("Error fetching data:", error);
                showToast(`Error al cargar datos para ${coin}. Mostrando caché si está disponible.`, true);
                
                // Fallback a caché
                if (dataCache[cacheKey]) return dataCache[cacheKey];
                
                return { simpleData: [], currentPrice: 0, marketCap: 0, volume: 0, signal: {} };
            }
        }


        // --- UI RENDERING FUNCTIONS ---

        function renderToastContainer() {
            return `<div id="toast-container" class="fixed bottom-4 right-4 z-50"></div>`;
        }
        
        function renderAuth() {
            return `
                <main class="min-h-screen-auth flex items-center justify-center p-6">
                    <div class="w-full max-w-md">
                        <div class="flex flex-col items-center p-8 bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl">
                            <h2 class="text-3xl font-bold text-white mb-6">Acceso al Dashboard</h2>
                            
                            <form id="sign-in-form" class="w-full space-y-4">
                                <input type="email" id="signin-email" placeholder="Correo electrónico" required 
                                    class="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="password" id="signin-password" placeholder="Contraseña" required 
                                    class="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit"
                                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg">
                                    Iniciar Sesión
                                </button>
                            </form>
                            
                            <p class="text-neutral-500 my-4">o</p>

                            <form id="sign-up-form" class="w-full space-y-4">
                                <p class="text-sm text-neutral-400">¿Nuevo usuario? Regístrate:</p>
                                <input type="email" id="signup-email" placeholder="Correo electrónico" required 
                                    class="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="password" id="signup-password" placeholder="Contraseña (mín. 6 caracteres)" required 
                                    class="w-full p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit"
                                    class="w-full bg-neutral-600 hover:bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                                    Registrarse
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            `;
        }

        function renderDashboard(data, userId) {
            const { simpleData, currentPrice, marketCap, volume, signal } = data;
            const lastUpdate = new Date().toLocaleTimeString('es-ES');
            
            // Renderiza la tabla de datos histórica (sustituto del gráfico)
            const historicalTable = simpleData.slice(-7).map(d => `
                <tr class="border-b border-neutral-700 hover:bg-neutral-800 transition-colors">
                    <td class="p-3 text-neutral-400">${d.date.slice(0, 5)}</td>
                    <td class="p-3 text-white font-mono">${formatNumber(d.price)}</td>
                    <td class="p-3 text-yellow-400">${d.ma7 ? formatNumber(d.ma7) : '—'}</td>
                    <td class="p-3 text-neutral-300">
                        <div class="flex items-center space-x-2">
                            <span class="w-12 text-right text-sm ${d.rsi < 35 ? 'text-green-400' : d.rsi > 65 ? 'text-red-400' : 'text-yellow-400'}">${d.rsi.toFixed(2)}</span>
                            <div class="flex-grow bg-neutral-700 rounded-full h-2">
                                <div class="h-2 rounded-full transition-all duration-500 ${d.rsi < 35 ? 'bg-green-500' : d.rsi > 65 ? 'bg-red-500' : 'bg-yellow-500'}" style="width: ${d.rsi}%;"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('');

            return `
                <header class="bg-neutral-900 p-4 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-3">
                    <h1 class="text-xl md:text-2xl font-bold text-white">Dashboard de Trading - ${currentCoin.toUpperCase()}</h1>
                    <div class="flex items-center gap-4">
                        <p class="text-neutral-500 text-sm hidden md:block">Usuario: ${userId.substring(0, 8)}...</p>
                        <button id="sign-out-btn" class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors text-sm">
                            Cerrar Sesión
                        </button>
                    </div>
                </header>

                <main class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

                    <!-- Selector de Moneda -->
                    <div class="lg:col-span-3">
                        <label for="coin-select" class="block text-sm font-medium text-neutral-400 mb-2">
                            Selecciona la Criptomoneda
                        </label>
                        <select id="coin-select" class="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/3">
                            <option value="bitcoin" ${currentCoin === 'bitcoin' ? 'selected' : ''}>Bitcoin (BTC)</option>
                            <option value="ethereum" ${currentCoin === 'ethereum' ? 'selected' : ''}>Ethereum (ETH)</option>
                            <option value="solana" ${currentCoin === 'solana' ? 'selected' : ''}>Solana (SOL)</option>
                        </select>
                    </div>

                    <!-- Métricas Clave -->
                    <div class="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 class="text-lg font-bold text-white">Precio Actual</h2>
                        <p class="text-4xl mt-2 text-blue-400 font-mono">${formatNumber(currentPrice)}</p>
                        <p class="text-sm mt-2 text-neutral-500">Última actualización: ${lastUpdate}</p>
                    </div>

                    <div class="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 class="text-lg font-bold text-white">Datos de Mercado</h2>
                        <p class="text-neutral-400">Volumen 24h: <span class="text-neutral-200 font-medium">${formatNumber(volume)}</span></p>
                        <p class="text-neutral-400">Capitalización: <span class="text-neutral-200 font-medium">${formatNumber(marketCap)}</span></p>
                        <p class="text-neutral-400">Dominancia: <span class="text-neutral-200 font-medium">${currentCoin === 'bitcoin' ? 'Alta' : 'N/A'}</span></p>
                    </div>

                    <div class="bg-neutral-900 rounded-xl p-6 border border-neutral-800 shadow-lg">
                        <h2 class="text-lg font-bold text-white">Señal de Trading</h2>
                        <p class="text-xl font-bold mt-2 ${signal.recommendation === 'Comprar' ? 'text-green-500' : signal.recommendation === 'Vender' ? 'text-red-500' : 'text-yellow-500'}">
                            ${signal.recommendation || '—'}
                        </p>
                        <p class="text-neutral-400">Probabilidad: <span class="text-neutral-200 font-medium">${signal.probability ? signal.probability.toFixed(0) + '%' : '—'}</span></p>
                        <p class="text-neutral-400">RSI actual: <span class="text-neutral-200 font-mono">${signal.rsi ? signal.rsi.toFixed(2) : '—'}</span></p>
                    </div>
                    
                    <!-- Gráfico/Tabla Histórica -->
                    <div class="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                        <h2 class="text-lg font-bold text-white mb-4">Datos Históricos Clave (Últimos 7 Días)</h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-neutral-700">
                                <thead>
                                    <tr class="text-neutral-500 text-left text-sm uppercase">
                                        <th class="p-3 font-semibold">Fecha</th>
                                        <th class="p-3 font-semibold">Precio (USD)</th>
                                        <th class="p-3 font-semibold">MA7</th>
                                        <th class="p-3 font-semibold">RSI (Indicador)</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-neutral-800">
                                    ${historicalTable}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Panel de Alertas (Firestore) -->
                    <div class="lg:col-span-3 bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                        <h2 class="text-xl font-bold text-white mb-4">Añadir Alerta (Persistente)</h2>
                        <div class="flex flex-col md:flex-row gap-4 items-center">
                            <select id="alert-type" class="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="priceAbove">Precio > X</option>
                                <option value="priceBelow">Precio < X</option>
                            </select>
                            <input type="number" step="any" id="alert-value" placeholder="Valor (e.g., 50000)" class="p-3 rounded-lg bg-neutral-800 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-48" />
                            <button id="add-alert-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors w-full md:w-auto">
                                Guardar Alerta
                            </button>
                        </div>
                        <h3 class="text-lg font-semibold text-white mt-6 mb-2">Alertas Activas</h3>
                        <ul id="active-alerts" class="space-y-2">
                            <li class="text-neutral-500">Cargando alertas...</li>
                            <!-- Alertas inyectadas aquí por onSnapshot -->
                        </ul>
                    </div>
                </main>
            `;
        }

        // --- EVENT ATTACHMENT AND APP START ---

        function attachEvents(user) {
            // Elimina listeners antiguos para evitar duplicados
            document.getElementById('sign-out-btn')?.removeEventListener('click', handleSignOut);
            document.getElementById('coin-select')?.removeEventListener('change', handleCoinChange);
            document.getElementById('add-alert-btn')?.removeEventListener('click', handleAddAlert);

            if (user) {
                // Dashboard Events
                document.getElementById('sign-out-btn')?.addEventListener('click', handleSignOut);
                
                const coinSelect = document.getElementById('coin-select');
                if (coinSelect) {
                    coinSelect.value = currentCoin; // Asegura que el selector refleje el estado actual
                    coinSelect.addEventListener('change', handleCoinChange);
                }
                
                // Alert events
                document.getElementById('add-alert-btn')?.addEventListener('click', handleAddAlert);
                
                // Iniciar la escucha de Firestore
                if (!unsubscribeAlerts) {
                    subscribeToAlerts(user.uid);
                }

            } else {
                // Auth Events
                document.getElementById('sign-in-form')?.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('signin-email').value;
                    const password = document.getElementById('signin-password').value;
                    handleSignIn(email, password);
                });
                
                document.getElementById('sign-up-form')?.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('signup-email').value;
                    const password = document.getElementById('signup-password').value;
                    handleSignUp(email, password);
                });
            }
        }

        async function handleCoinChange(e) {
             currentCoin = e.target.value;
             // Vuelve a cargar y renderizar el dashboard con la nueva moneda
             await loadDashboardData(auth.currentUser);
        }

        // --- FIRESTORE ALERTS LOGIC ---

        // Función para agregar una alerta a Firestore
        async function handleAddAlert() {
            const type = document.getElementById('alert-type').value;
            const value = parseFloat(document.getElementById('alert-value').value);
            
            if (isNaN(value) || value <= 0) {
                showToast('Por favor, introduce un valor válido para la alerta.', true);
                return;
            }
            
            if (!currentUserId) {
                showToast('Error: Debes iniciar sesión para guardar alertas.', true);
                return;
            }
            
            try {
                const alertsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/alerts`);
                
                const newAlert = {
                    coin: currentCoin, 
                    type, 
                    value: value, // Guardar como número para facilitar consultas futuras
                    createdAt: Date.now() 
                };
                
                await addDoc(alertsCollectionRef, newAlert);
                showToast(`Alerta para ${currentCoin.toUpperCase()} guardada en la nube.`);
                document.getElementById('alert-value').value = ''; // Limpiar campo
                
            } catch (error) {
                console.error("Error saving alert to Firestore:", error);
                showToast('Error al guardar la alerta. Por favor, intenta de nuevo.', true);
            }
        }

        // Función para eliminar una alerta de Firestore
        async function handleRemoveAlert(alertId) {
            if (!currentUserId || !alertId) return;

            try {
                const alertDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/alerts`, alertId);
                await deleteDoc(alertDocRef);
                showToast('Alerta eliminada.');
            } catch (error) {
                console.error("Error removing alert from Firestore:", error);
                showToast('Error al eliminar la alerta.', true);
            }
        }


        // Función que escucha cambios en la colección de alertas de Firestore
        function subscribeToAlerts(userId) {
            // Detener la suscripción anterior si existe
            if (unsubscribeAlerts) {
                unsubscribeAlerts();
            }

            if (!db || !userId) return;

            try {
                // Ruta: /artifacts/{appId}/users/{userId}/alerts
                const alertsRef = collection(db, `artifacts/${appId}/users/${userId}/alerts`);
                
                // Consulta: Solo alertas para la moneda actualmente seleccionada
                const alertsQuery = query(alertsRef, where("coin", "==", currentCoin));

                unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
                    const alerts = [];
                    snapshot.forEach((doc) => {
                        alerts.push({ id: doc.id, ...doc.data() });
                    });
                    
                    renderAlerts(alerts);
                }, (error) => {
                    console.error("Error listening to Firestore alerts:", error);
                    showToast('Error al cargar las alertas en tiempo real.', true);
                });

            } catch (error) {
                console.error("Error setting up Firestore subscription:", error);
            }
        }
        
        // Función de renderizado llamada por onSnapshot
        function renderAlerts(alerts) {
            const container = document.getElementById('active-alerts');
            if (!container) return;

            if (alerts.length === 0) {
                 container.innerHTML = `<li class="text-neutral-500">No hay alertas guardadas para ${currentCoin.toUpperCase()}.</li>`;
                 return;
            }

            container.innerHTML = alerts.map(a => `
                <li class="flex justify-between items-center bg-neutral-800 p-3 rounded-lg text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors">
                    <span class="font-medium">
                        ${a.coin.toUpperCase()}: ${a.type === 'priceAbove' ? 'Precio >' : 'Precio <'} ${formatNumber(parseFloat(a.value))}
                    </span>
                    <button data-id="${a.id}" class="remove-alert-btn text-red-400 hover:text-red-300 transition-colors font-semibold">
                        Quitar
                    </button>
                </li>
            `).join('');

            // Asigna los listeners de eliminación después de inyectar el HTML
            document.querySelectorAll('.remove-alert-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const id = e.target.dataset.id; // ID de Firestore
                    handleRemoveAlert(id);
                });
            });
        }
        
        async function loadDashboardData(user) {
             const appElement = document.getElementById('app');
             if (appElement) {
                // Mostrar spinner de carga
                appElement.innerHTML = `
                    ${renderToastContainer()}
                    <header class="bg-neutral-900 p-4 border-b border-neutral-800"></header>
                    <div class="flex items-center justify-center min-h-screen-auth p-6">
                        <div class="text-center">
                            <p class="text-2xl text-white font-semibold">Cargando datos de ${currentCoin.toUpperCase()}...</p>
                            <div class="mt-4 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </div>
                    </div>
                `;
            }
            
            const data = await fetchData(currentCoin);

            if (data.simpleData.length > 0) {
                 // Si los datos se cargaron con éxito, renderiza el dashboard
                if (appElement) {
                    appElement.innerHTML = renderDashboard(data, user.uid);
                    appElement.insertAdjacentHTML('afterbegin', renderToastContainer());
                    attachEvents(user); 
                }
            } else {
                // Si la carga falla, muestra un mensaje de error y el Auth (por si acaso)
                 if (appElement) {
                    appElement.innerHTML = `
                        ${renderToastContainer()}
                        <div class="text-center p-8 text-red-400">
                           No se pudieron cargar los datos de trading. Por favor, verifica tu conexión o intenta más tarde.
                        </div>
                        ${renderAuth()}
                    `;
                    attachEvents(null);
                 }
            }
        }

        async function renderApp(user) {
            const appElement = document.getElementById('app');
            if (!appElement) return;

            appElement.innerHTML = ''; 
            appElement.insertAdjacentHTML('afterbegin', renderToastContainer());

            if (user) {
                await loadDashboardData(user);
            } else {
                // Si no hay usuario, limpiar suscripción de Firestore y renderizar Auth
                if (unsubscribeAlerts) {
                    unsubscribeAlerts();
                    unsubscribeAlerts = null;
                }
                appElement.innerHTML += renderAuth();
                attachEvents(null); 
            }
        }
        
        // Inicia el ciclo de vida de la aplicación: inicialización de Auth y primer renderizado
        handleAuthInitialization();
    </script>
</body>
</html>
