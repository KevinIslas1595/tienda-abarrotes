# Guía para el dueño de la tienda

Cómo se conecta la base de datos, cómo cuidar tus datos y de dónde salieron los precios.
(Lo técnico está en el [README](README.md).)

## Respaldo de tus datos

El plan gratis de Firebase **no guarda copias de seguridad**. Una vez a la semana:
**Más → Respaldo → Descargar respaldo completo**. Se baja un archivo `.json` con todos
tus productos, ventas, entradas y cortes; guárdalo en Google Drive o mándatelo por WhatsApp.
Si algún día se borra algo, **Más → Respaldo → Restaurar un respaldo** lo vuelve a cargar.

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
6. Pega esos datos en `src/config.js` y sube el cambio a GitHub.

### Seguridad

Cada cuenta solo puede ver y cambiar **su propia** tienda (reglas en `firestore.rules`, probadas con el emulador de Firebase). Los datos de `src/config.js` no son secretos: solo dicen a qué proyecto conectarse.

Para que nadie más pueda crear cuentas en tu proyecto, cuando ya tengas la tuya: Firebase → Authentication → Configuración → **Acciones del usuario** → desmarca «Habilitar creación (registro)».

## De dónde salieron los precios del catálogo

- **Refrescos Coca-Cola:** lista del aumento del 4 de agosto de 2026 (Coca-Cola 600 ml a $22, lata $23…).
- **Lo demás:** precio de anaquel de Chedraui en línea (sin ofertas) en septiembre de 2026, redondeado a precio de tiendita. Las bolsitas chicas de botana se tomaron de Chedraui Supercito (su tienda de barrio).
- **Costo:** estimado con la ganancia típica de una tiendita por categoría (refrescos 18 %, abarrotes 12 %, botanas 25 %, dulces 30 %…; en promedio ~20 %, según la Alianza Nacional de Pequeños Comerciantes).
- **Códigos de barras:** de las fichas de producto de Chedraui. Si alguno no coincide con tu mercancía, al escanearlo la app te deja ligarlo al producto correcto.

Son precios de referencia: cámbialos por lo que te cobra tu proveedor.
