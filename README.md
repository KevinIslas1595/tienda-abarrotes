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

## Qué hace

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
- **Respaldo completo** de productos, ventas y cortes en un archivo, y restaurarlo cuando haga falta.

## Dónde se usa

- **Página web:** https://kevinislas1595.github.io/tienda-abarrotes/
- **Celular (cualquiera):** abre la página en Chrome (Android) o Safari (iPhone) → menú → «Instalar app» / «Agregar a inicio». Queda con su ícono como cualquier app.
- **App para Android (APK):** https://github.com/KevinIslas1595/tienda-abarrotes/releases/latest/download/mi-tienda.apk
  (al abrirla, Android pide permiso para «instalar apps de fuentes desconocidas»; es normal porque no viene de la Play Store).

Con el mismo correo y contraseña entras en todos tus aparatos y ves los mismos datos al mismo tiempo.

## Cómo está hecho

- **Vite + JavaScript sin framework.** Cada pantalla es un módulo (`src/vistas/`) y comparten el estado con eventos (`src/estado.js`).
- **Firebase Auth + Cloud Firestore** con caché persistente: la app cobra sin internet y sube los cambios al volver la señal.
- **Ventas atómicas:** cada cobro guarda en un solo lote la venta, el descuento de existencias (con `increment`, para que dos celulares no se pisen) y los totales del día.
- **Reportes baratos:** los totales del día se van sumando en `dias/{AAAA-MM-DD}`, así el corte no tiene que leer todas las ventas.
- **Seguridad:** reglas de Firestore que aíslan la tienda de cada cuenta, probadas contra el emulador.
- **Escáner:** `BarcodeDetector` nativo del teléfono y, si no hay, ZXing en WebAssembly (se descarga solo cuando se necesita).
- **PWA** instalable (`vite-plugin-pwa`) y **APK de Android** con Capacitor.
- **CI/CD con GitHub Actions:** en cada cambio corren las pruebas y, si pasan, se publica la página y se arma la APK.

## Correrlo en tu computadora

```bash
npm install
npm run dev            # en la PC, con la base de datos real
npm run dev:emulador   # en la PC, con el emulador de Firebase (datos de prueba)
npm run build          # página para GitHub Pages
npm test               # todas las pruebas (necesita Java 21 para el emulador)
```

Para el emulador: `npx firebase-tools emulators:start --only auth,firestore --project demo-tienda` (necesita Java 21; Firestore queda en el puerto 8085).

## Pruebas automáticas

`npm test` levanta el emulador de Firebase, arranca la app y corre (carpeta `pruebas/`, con Playwright):

- `prueba.mjs`: 46 comprobaciones de punta a punta (cobrar, granel, códigos nuevos, entradas, conteo, cancelaciones, Excel, respaldo, escáner encima de ventanas, sin internet, cambio de cuenta).
- `prueba-escaner.mjs` (aparte): el escáner con una cámara falsa que muestra un código (`video-codigo.mjs` crea el video).
- `prueba-reglas.mjs`: 7 casos de que una cuenta no pueda leer ni escribir la tienda de otra.

## Estructura de los datos

Cada cuenta tiene su tienda:

```
tiendas/{uid}                    nombre y categorías
tiendas/{uid}/productos/{id}     nombre, códigos, costo, precio, existencia, mínimo
tiendas/{uid}/ventas/{id}        cada cobro con sus artículos
tiendas/{uid}/dias/{AAAA-MM-DD}  totales del día (reportes rápidos y baratos)
tiendas/{uid}/movimientos/{id}   entradas de mercancía y ajustes de existencia
```

GitHub Actions corre las pruebas y publica la página (`.github/workflows/pagina.yml`) y arma la APK (`.github/workflows/android.yml`) en cada cambio a `main`.

## Para el dueño de la tienda

Cómo conectar Firebase, cuidar los datos (respaldos, seguridad) y de dónde salieron los precios: **[GUIA.md](GUIA.md)**.
