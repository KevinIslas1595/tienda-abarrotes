// Arranque de la app: sesión, datos en tiempo real, menú y pantallas.
import './estilos.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseListo } from './firebase.js';
import { estado, escuchar, emitir, ponerProductos, ponerTienda, CATEGORIAS_BASE } from './estado.js';
import { usarTienda, escucharTienda, escucharProductos, guardarTienda, hayPendientes } from './datos.js';
import { icono } from './iconos.js';
import { esc, aviso, confirmar } from './util.js';
import { montarLogin } from './vistas/login.js';
import * as cobrar from './vistas/cobrar.js';
import * as inventario from './vistas/inventario.js';
import * as ventas from './vistas/ventas.js';
import * as mas from './vistas/mas.js';

const RUTAS = { cobrar, inventario, ventas, mas };
const app = document.getElementById('app');
let desmontarVista = null;
let quitarDatos = [];

// ---------- Falta configurar Firebase ----------

function pantallaSinConfiguracion() {
  app.innerHTML = `
    <main class="login">
      <div class="login-caja">
        <div class="login-logo">${icono('tienda')}</div>
        <h1>Mi Tienda</h1>
        <p class="login-sub">Falta conectar la base de datos</p>
        <p>La app ya está lista, pero todavía no tiene los datos del proyecto de Firebase donde se guardará tu información.</p>
        <p class="ayuda">Se pegan en el archivo <code>src/config.js</code>. Las instrucciones están en el archivo <code>LEEME.md</code> del proyecto.</p>
      </div>
    </main>`;
}

// ---------- Estructura: barra de arriba, contenido y menú de abajo ----------

function armarPantalla() {
  app.innerHTML = `
    <header class="barra-superior">
      <div class="marca">${icono('tienda')}<span data-nombre-tienda>${esc(estado.tienda.nombre)}</span></div>
      <button type="button" class="chip-instalar" data-instalar hidden>${icono('descargar')} Instalar</button>
      <div class="sync" data-sync aria-live="polite"></div>
    </header>
    <main id="vista" class="contenido"></main>
    <nav class="menu-inferior" aria-label="Secciones">
      <a href="#/cobrar" data-ruta="cobrar">${icono('carrito')}<span>Cobrar</span></a>
      <a href="#/inventario" data-ruta="inventario">${icono('caja')}<span>Inventario</span></a>
      <a href="#/ventas" data-ruta="ventas">${icono('grafica')}<span>Ventas</span></a>
      <a href="#/mas" data-ruta="mas">${icono('menu')}<span>Más</span></a>
    </nav>`;
  app.querySelector('[data-instalar]').addEventListener('click', () => {
    location.hash = '#/mas';
    setTimeout(() => document.querySelector('[data-accion="instalar"]')?.click(), 50);
  });
  pintarSync();
  pintarInstalar();
}

function irARuta() {
  const vista = document.getElementById('vista');
  if (!vista) return;
  const ruta = location.hash.replace(/^#\/?/, '') || 'cobrar';
  const modulo = RUTAS[ruta] ?? RUTAS.cobrar;
  desmontarVista?.();
  window.scrollTo(0, 0);
  document.body.dataset.ruta = RUTAS[ruta] ? ruta : 'cobrar';
  desmontarVista = modulo.montar(vista);
  document.querySelectorAll('[data-ruta]').forEach((a) => {
    const activo = a.dataset.ruta === document.body.dataset.ruta;
    a.classList.toggle('activo', activo);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

window.addEventListener('hashchange', irARuta);

// ---------- Indicador de guardado / sin internet ----------

function pintarSync() {
  const el = document.querySelector('[data-sync]');
  if (!el) return;
  if (!navigator.onLine) {
    el.className = 'sync sin-red';
    el.innerHTML = `${icono('sinNube')}<span>Sin internet</span>`;
    el.title = 'Se sigue guardando en este aparato y se sube al volver la señal';
  } else if (hayPendientes()) {
    el.className = 'sync subiendo';
    el.innerHTML = `${icono('nube')}<span>Guardando…</span>`;
    el.title = 'Subiendo cambios a la nube';
  } else {
    el.className = 'sync ok';
    el.innerHTML = `${icono('nube')}<span>Guardado</span>`;
    el.title = 'Todo está guardado en la nube';
  }
}

escuchar('pendientes', pintarSync);
window.addEventListener('online', pintarSync);
window.addEventListener('offline', pintarSync);

// ---------- Instalar como app ----------

function pintarInstalar() {
  const b = document.querySelector('[data-instalar]');
  if (b) b.hidden = !mas.instalacion.evento;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  mas.instalacion.evento = e;
  pintarInstalar();
  emitir('instalable');
});
window.addEventListener('appinstalled', () => {
  mas.instalacion.evento = null;
  pintarInstalar();
  aviso('¡App instalada! Ya la tienes en tu pantalla de inicio.');
});

if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.Capacitor) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      const avisarNueva = (sw) =>
        aviso('Hay una versión nueva de la app.', 'info', {
          ms: 0,
          boton: 'Actualizar',
          alTocar: () => sw.postMessage({ type: 'SKIP_WAITING' }),
        });
      if (reg.waiting && navigator.serviceWorker.controller) avisarNueva(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        nuevo?.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarNueva(nuevo);
        });
      });
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        location.reload();
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) {
      console.warn('No se pudo activar el modo sin internet', e);
    }
  });
}

// ---------- Primera vez: ofrecer el catálogo inicial ----------

async function ofrecerCatalogo() {
  // Se espera a que lleguen los productos para no ofrecerlo si ya hay.
  if (!estado.productosListos) {
    await new Promise((resolve) => {
      const quitar = escuchar('productos', () => {
        quitar();
        resolve();
      });
    });
  }
  if (estado.productos.length) return;
  const n = mas.productosNuevosDelCatalogo().length;
  const ok = await confirmar(
    `<p>¡Bienvenido! ¿Quieres empezar con <strong>${n} productos típicos de abarrotes</strong> (refrescos, botanas, pan, abarrotes, limpieza…) con precios aproximados del Estado de México?</p>
     <p class="ayuda">Todo se puede cambiar o borrar después. Si prefieres empezar desde cero, toca «Empezar vacío».</p>`,
    { titulo: 'Catálogo inicial', si: 'Sí, cargar productos', no: 'Empezar vacío', html: true },
  );
  if (ok) mas.cargarCatalogo();
}

// ---------- Sesión ----------

function iniciar() {
  if (!firebaseListo) {
    pantallaSinConfiguracion();
    return;
  }
  onAuthStateChanged(auth, (usuario) => {
    quitarDatos.forEach((q) => q());
    quitarDatos = [];
    desmontarVista?.();
    desmontarVista = null;
    document.querySelectorAll('dialog').forEach((d) => d.close());

    if (!usuario) {
      estado.usuario = null;
      estado.productos = [];
      estado.productosListos = false;
      document.body.dataset.ruta = 'login';
      montarLogin(app);
      return;
    }

    estado.usuario = usuario;
    estado.productosListos = false;
    usarTienda(usuario.uid);
    armarPantalla();

    let tiendaCreada = false;
    quitarDatos.push(
      escucharTienda((datos, desdeCache) => {
        if (!datos && !desdeCache && !tiendaCreada) {
          // Cuenta nueva: se crea la tienda con las categorías de siempre.
          tiendaCreada = true;
          guardarTienda({ nombre: 'Mi Tienda', categorias: CATEGORIAS_BASE, creada: Date.now() });
          ofrecerCatalogo();
        }
        ponerTienda(datos);
      }),
      escucharProductos(ponerProductos),
      escuchar('tienda', () => {
        const el = document.querySelector('[data-nombre-tienda]');
        if (el) el.textContent = estado.tienda.nombre;
        document.title = estado.tienda.nombre;
      }),
    );
    irARuta();
  });
}

iniciar();
