# Mi Tienda · inventario y cobros para tienda de abarrotes

**[Ver la app en línea](https://kevinislas1595.github.io/tienda-abarrotes/)** · **[Descargar para Android (APK)](https://github.com/KevinIslas1595/tienda-abarrotes/releases/latest/download/mi-tienda.apk)**

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-sin%20internet-5A0FC8?logo=pwa&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?logo=capacitor&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![Playwright](https://img.shields.io/badge/Pruebas-Playwright-2EAD33?logo=playwright&logoColor=white)

Sistema de punto de venta e inventario hecho para una tienda de abarrotes real en el Estado de México.
Escanea códigos de barras con la cámara del celular, funciona sin internet y se publica solo
(página web + app de Android) con GitHub Actions en cada cambio.

App para administrar una tienda de abarrotes desde el celular o la computadora:

- **Cobrar escaneando** el código de barras con la cámara del celular (varios productos seguidos), buscando por nombre o con un lector USB.
- **Cuenta con cambio**: efectivo, tarjeta o transferencia; botón de «Deshacer» por si te equivocas.
- **Productos a granel** (huevo, tortilla, azúcar…): por kilo o por importe («dame $20 de huevo»).
- **Inventario**: existencias, costo, precio y ganancia de cada producto; aviso de lo que se está acabando.
- **Llegó mercancía**: suma a la existencia y actualiza el costo si el proveedor lo subió.
- **Contar inventario**: escribes lo que hay en el anaquel y se corrige la existencia.
- **Corte del día**: vendido, ganancia, efectivo que debe haber en caja, productos más vendidos y resumen de 7 días, 30 días o el mes.
- **Todo se puede cambiar**: agregar, editar o borrar productos, categorías, precios en bloque (por ejemplo +5 % a los refrescos) y subir o bajar el inventario en Excel.
- **Funciona sin internet**: sigue cobrando y todo se sube solo cuando regresa la señal.
- **Catálogo inicial** con 88 productos típicos y precios aproximados del Estado de México (septiembre 2026).

## Dónde se usa

- **Página web:** https://kevinislas1595.github.io/tienda-abarrotes/
- **Celular (cualquiera):** abre la página en Chrome (Android) o Safari (iPhone) → menú → «Instalar app» / «Agregar a inicio». Queda con su ícono como cualquier app.
- **App para Android (APK):** https://github.com/KevinIslas1595/tienda-abarrotes/releases/latest/download/mi-tienda.apk
  (al abrirla, Android pide permiso para «instalar apps de fuentes desconocidas»; es normal porque no viene de la Play Store).

Con el mismo correo y contraseña entras en todos tus aparatos y ves los mismos datos al mismo tiempo.

## La base de datos: Firebase (de Google), gratis

Los datos se guardan en **Cloud Firestore**, con el plan gratuito **Spark** de Firebase:
no pide tarjeta y no se vence. Ninguna base de datos gratis es 100 % ilimitada, pero
los límites de Firebase se reinician cada día y una tiendita no se acerca a ellos:

| Límite diario gratis | Qué significa para la tienda |
| --- | --- |
| 20,000 escrituras | ~4,000 ventas al día (cada venta usa 3 a 6) |
| 50,000 lecturas | abrir la app muchas veces al día en varios aparatos |
| 1 GB guardado | años de ventas |

Si algún día se llegara al límite, la app sigue funcionando en el aparato y sube los datos al día siguiente. Nunca se cobra nada: el plan Spark no tiene tarjeta.

### Conectar Firebase (una sola vez)

1. Entra a https://console.firebase.google.com con tu cuenta de Google → **Crear un proyecto** → nombre `tienda-abarrotes` → puedes desactivar Google Analytics → **Crear**.
2. Menú **Seguridad → Authentication → Comenzar** → elige **Correo electrónico/contraseña** → actívalo → **Guardar**.
3. Menú **Bases de datos y almacenamiento → Firestore → Crear base de datos** → edición **Estándar** → ubicación la que sugiera → **Modo de producción** → **Crear**.
4. En Firestore, pestaña **Reglas** → borra lo que hay → pega el contenido del archivo `firestore.rules` → **Publicar**.
5. ⚙️ **Configuración del proyecto** → abajo, en «Tus apps», el ícono **`</>`** (Web) → nombre `tienda` → **Registrar app** → copia el bloque `firebaseConfig`.
6. Pega esos datos en `src/config.js` y sube el cambio a GitHub (o pásaselos a Claude para que lo haga).

### Seguridad

Cada cuenta solo puede ver y cambiar **su propia** tienda (reglas en `firestore.rules`, probadas con el emulador de Firebase). Los datos de `src/config.js` no son secretos: solo dicen a qué proyecto conectarse.

Para que nadie más pueda crear cuentas en tu proyecto, cuando ya tengas la tuya: Firebase → Authentication → Configuración → **Acciones del usuario** → desmarca «Habilitar creación (registro)».

## De dónde salieron los precios del catálogo

- **Refrescos Coca-Cola:** lista del aumento del 4 de agosto de 2026 (Coca-Cola 600 ml a $22, lata $23…).
- **Lo demás:** precio de anaquel de Chedraui en línea (sin ofertas) en septiembre de 2026, redondeado a precio de tiendita. Las bolsitas chicas de botana se tomaron de Chedraui Supercito (su tienda de barrio).
- **Costo:** estimado con la ganancia típica de una tiendita por categoría (refrescos 18 %, abarrotes 12 %, botanas 25 %, dulces 30 %…; en promedio ~20 %, según la Alianza Nacional de Pequeños Comerciantes).
- **Códigos de barras:** de las fichas de producto de Chedraui. Si alguno no coincide con tu mercancía, al escanearlo la app te deja ligarlo al producto correcto.

Son precios de referencia: cámbialos por lo que te cobra tu proveedor.

## Para programadores

Hecha con Vite + JavaScript (sin framework), Firebase (Auth + Firestore con caché sin conexión),
lector de códigos `barcode-detector` (ZXing en WebAssembly cuando el navegador no trae uno),
PWA con `vite-plugin-pwa` y Capacitor para la APK.

```bash
npm install
npm run dev            # en la PC, con la base de datos real
npm run dev:emulador   # en la PC, con el emulador de Firebase (datos de prueba)
npm run build          # página para GitHub Pages
```

Para el emulador: `npx firebase-tools emulators:start --only auth,firestore --project demo-tienda` (necesita Java 21; Firestore queda en el puerto 8085).

Pruebas automáticas (carpeta `pruebas/`, con Playwright y el emulador corriendo):

- `prueba.mjs`: 35 comprobaciones de punta a punta (cobrar, granel, códigos nuevos, entradas, conteo, cancelaciones, Excel, sin internet).
- `prueba-escaner.mjs`: el escáner con una cámara falsa que muestra un código (`video-codigo.mjs` crea el video).
- `prueba-reglas.mjs`: que una cuenta no pueda leer ni escribir la tienda de otra.

Estructura de los datos (cada cuenta tiene su tienda):

```
tiendas/{uid}                    nombre y categorías
tiendas/{uid}/productos/{id}     nombre, códigos, costo, precio, existencia, mínimo
tiendas/{uid}/ventas/{id}        cada cobro con sus artículos
tiendas/{uid}/dias/{AAAA-MM-DD}  totales del día (reportes rápidos y baratos)
tiendas/{uid}/movimientos/{id}   entradas de mercancía y ajustes de existencia
```

GitHub Actions publica la página (`.github/workflows/pagina.yml`) y arma la APK (`.github/workflows/android.yml`) en cada cambio a `main`.
