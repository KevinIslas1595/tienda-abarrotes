// Pantalla "Más": nombre de la tienda, precios en bloque, categorías, Excel,
// historial de inventario, instalar la app y la cuenta.
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import {
  esc,
  dinero,
  redondear,
  leerNumero,
  normalizar,
  cantidadTexto,
  fechaHora,
  abrirModal,
  confirmar,
  pedirDato,
  aviso,
  avisoError,
  aCSV,
  leerCSV,
  descargar,
  diaISO,
} from '../util.js';
import { icono } from '../iconos.js';
import { estado, escuchar, categorias, variantesCodigo } from '../estado.js';
import {
  guardarTienda,
  guardarProductos,
  cambiarCategoriaDe,
  escucharMovimientos,
  hayPendientes,
} from '../datos.js';
import { CATALOGO, FECHA_PRECIOS } from '../catalogo-inicial.js';
import { URL_APK, VERSION } from '../config.js';

// El aviso de "instalar app" que da Chrome se guarda aquí (lo pone main.js).
export const instalacion = { evento: null };

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const enApp = () => Boolean(window.Capacitor);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- Catálogo inicial ----------

export function productosNuevosDelCatalogo() {
  const nombres = new Set(estado.productos.map((p) => p._nombre));
  const codigos = new Set(estado.productos.flatMap((p) => (p.codigos ?? []).flatMap(variantesCodigo)));
  return CATALOGO.filter((c) => !nombres.has(normalizar(c.nombre)) && !(c.codigos ?? []).some((k) => codigos.has(k)));
}

export function cargarCatalogo() {
  const nuevos = productosNuevosDelCatalogo();
  if (!nuevos.length) {
    aviso('Todos los productos del catálogo ya están en tu inventario.', 'info');
    return 0;
  }
  const cats = new Set(estado.tienda.categorias ?? []);
  nuevos.forEach((p) => cats.add(p.categoria));
  guardarTienda({ categorias: [...cats] });
  guardarProductos(nuevos.map((p) => ({ ...p, stock: 0, minimo: p.minimo ?? 0 })));
  aviso(`Se agregaron ${nuevos.length} productos. Ajusta precios y existencias a tu gusto.`);
  return nuevos.length;
}

export function montar(contenedor) {
  contenedor.innerHTML = `<section class="vista vista-mas"></section>`;
  const vista = contenedor.querySelector('.vista-mas');

  function pintar() {
    const nuevosCatalogo = productosNuevosDelCatalogo().length;
    const puedeInstalar = !enApp() && !instalada();
    vista.innerHTML = `
      <div class="panel">
        <h3>${icono('tienda')} Mi tienda</h3>
        <button type="button" class="fila-opcion" data-accion="nombre">
          <span><strong>${esc(estado.tienda.nombre)}</strong><small>Nombre que aparece arriba</small></span>${icono('editar')}
        </button>
      </div>

      <div class="panel">
        <h3>${icono('etiqueta')} Productos y precios</h3>
        <button type="button" class="fila-opcion" data-accion="precios">
          <span><strong>Subir o bajar precios en bloque</strong><small>Por categoría, en % o en pesos</small></span>${icono('porcentaje')}
        </button>
        <button type="button" class="fila-opcion" data-accion="categorias">
          <span><strong>Categorías</strong><small>${categorias().length} categorías · agregar, renombrar o quitar</small></span>${icono('lista')}
        </button>
        <button type="button" class="fila-opcion" data-accion="catalogo" ${nuevosCatalogo ? '' : 'disabled'}>
          <span><strong>Cargar catálogo inicial</strong><small>${
            nuevosCatalogo
              ? `${nuevosCatalogo} productos típicos de abarrotes con precios aproximados del Edomex (${FECHA_PRECIOS})`
              : 'Ya tienes todos los productos del catálogo'
          }</small></span>${icono('caja')}
        </button>
        <button type="button" class="fila-opcion" data-accion="historial">
          <span><strong>Historial de inventario</strong><small>Entradas de mercancía y ajustes de existencia</small></span>${icono('historial')}
        </button>
      </div>

      <div class="panel">
        <h3>${icono('descargar')} Excel</h3>
        <button type="button" class="fila-opcion" data-accion="exportar">
          <span><strong>Descargar inventario</strong><small>Archivo para abrir en Excel o Google Sheets</small></span>${icono('descargar')}
        </button>
        <button type="button" class="fila-opcion" data-accion="importar">
          <span><strong>Subir inventario desde Excel</strong><small>Cambia muchos productos de un jalón (guárdalo como CSV)</small></span>${icono('subir')}
        </button>
        <input type="file" accept=".csv,text/csv" hidden data-archivo />
      </div>

      <div class="panel">
        <h3>${icono('celular')} App</h3>
        ${
          puedeInstalar
            ? `<button type="button" class="fila-opcion" data-accion="instalar">
                <span><strong>Instalar en este aparato</strong><small>Queda como app con su ícono, y funciona sin internet</small></span>${icono('descargar')}
              </button>`
            : ''
        }
        ${
          !enApp()
            ? `<a class="fila-opcion" href="${esc(URL_APK)}" rel="noopener">
                <span><strong>Descargar app para Android (APK)</strong><small>Otra opción para instalarla en celulares Android</small></span>${icono('celular')}
              </a>`
            : ''
        }
        <div class="fila-opcion estatica">
          <span><strong>Estado</strong><small data-conexion></small></span>
        </div>
      </div>

      <div class="panel">
        <h3>${icono('usuario')} Cuenta</h3>
        <div class="fila-opcion estatica"><span><strong>${esc(estado.usuario?.email ?? '')}</strong><small>Con este correo entras en cualquier celular o computadora</small></span></div>
        <button type="button" class="fila-opcion peligro-texto" data-accion="salir">
          <span><strong>Cerrar sesión</strong><small>Tus datos se quedan guardados en tu cuenta</small></span>${icono('salir')}
        </button>
      </div>

      <details class="panel ayuda-uso">
        <summary>${icono('info')} ¿Cómo se usa?</summary>
        <ol>
          <li><strong>Cobrar:</strong> toca «Escanear» y apunta la cámara a los códigos, uno tras otro. Al terminar toca «Listo» y luego «Cobrar». También puedes buscar por nombre.</li>
          <li><strong>Código que no conoce:</strong> te deja registrarlo como producto nuevo, ligarlo a uno que ya tienes o venderlo suelto.</li>
          <li><strong>Llegó mercancía:</strong> en Inventario toca «Llegó mercancía», escanea el producto y escribe cuántos llegaron. Suma solo a la existencia.</li>
          <li><strong>Contar inventario:</strong> escribe lo que hay en el anaquel y se corrige la existencia.</li>
          <li><strong>Corte del día:</strong> en Ventas ves lo vendido, la ganancia y cuánto efectivo debe haber en la caja.</li>
          <li><strong>Sin internet:</strong> sigue cobrando normal; todo se sube solo cuando regresa la señal.</li>
        </ol>
      </details>

      <p class="version">Mi Tienda ${esc(VERSION)} · datos guardados en Firebase (Google)</p>`;
    pintarConexion();
  }

  function pintarConexion() {
    const el = vista.querySelector('[data-conexion]');
    if (!el) return;
    if (!navigator.onLine) el.textContent = 'Sin internet: lo que hagas se guarda en el aparato y se sube al volver la señal.';
    else if (hayPendientes()) el.textContent = 'Subiendo cambios…';
    else el.textContent = 'En línea: todo está guardado en la nube.';
  }

  // ---------- Precios en bloque ----------

  function preciosEnBloque() {
    const cats = categorias();
    const { cuerpo, cerrar } = abrirModal({
      titulo: 'Cambiar precios en bloque',
      contenido: `
        <form class="formulario" novalidate>
          <label class="campo"><span>Categoría</span>
            <select name="categoria"><option value="">Todas</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label class="campo"><span>¿Qué quieres cambiar?</span>
            <select name="campo">
              <option value="precio">Precio de venta</option>
              <option value="costo">Costo</option>
              <option value="ambos">Costo y precio</option>
            </select></label>
          <div class="dos-columnas">
            <label class="campo"><span>Cambio</span>
              <select name="direccion"><option value="1">Subir</option><option value="-1">Bajar</option></select></label>
            <label class="campo"><span>Cantidad</span>
              <div class="fila-campo">
                <input name="valor" type="number" inputmode="decimal" step="any" min="0" value="5" />
                <select name="tipo" aria-label="Tipo de cambio"><option value="pct">%</option><option value="pesos">pesos</option></select>
              </div></label>
          </div>
          <label class="campo"><span>Redondear el precio a</span>
            <select name="redondeo">
              <option value="0.5">50 centavos (ej. $23.50)</option>
              <option value="1">peso cerrado (ej. $24.00)</option>
              <option value="0">sin redondear</option>
            </select></label>
          <div class="vista-previa" data-previa></div>
          <div class="fila-botones">
            <button type="button" class="btn" data-cerrar>Cancelar</button>
            <button type="submit" class="btn primario" data-aplicar>Aplicar</button>
          </div>
        </form>`,
    });
    const form = cuerpo.querySelector('form');
    const previa = cuerpo.querySelector('[data-previa]');
    const btn = cuerpo.querySelector('[data-aplicar]');

    function calcular() {
      const valor = leerNumero(form.valor.value);
      if (!(valor > 0)) return { cambios: [], valido: false };
      const signo = Number(form.direccion.value);
      const red = Number(form.redondeo.value);
      const aplicar = (n, redondea) => {
        let x = form.tipo.value === 'pct' ? n * (1 + (signo * valor) / 100) : n + signo * valor;
        x = Math.max(0, x);
        if (redondea && red > 0) x = Math.round(x / red) * red;
        return redondear(x);
      };
      const ps = estado.productos.filter((p) => !form.categoria.value || p.categoria === form.categoria.value);
      const cambios = ps.map((p) => {
        const c = { id: p.id, nombre: p.nombre, antes: { precio: p.precio, costo: p.costo } };
        if (form.campo.value !== 'costo') c.precio = aplicar(Number(p.precio) || 0, true);
        if (form.campo.value !== 'precio') c.costo = aplicar(Number(p.costo) || 0, false);
        return c;
      });
      return { cambios, valido: true };
    }

    function pintarPrevia() {
      const { cambios, valido } = calcular();
      btn.disabled = !valido || !cambios.length;
      btn.textContent = cambios.length ? `Aplicar a ${cambios.length} productos` : 'Aplicar';
      if (!valido) {
        previa.innerHTML = '<p class="ayuda">Escribe una cantidad mayor a cero.</p>';
        return;
      }
      previa.innerHTML = cambios.length
        ? `<p class="ayuda">Así quedarían (primeros ${Math.min(5, cambios.length)} de ${cambios.length}):</p>
          <ul class="lista-previa">${cambios
            .slice(0, 5)
            .map(
              (c) => `<li><span>${esc(c.nombre)}</span><span>${
                c.precio !== undefined ? `${dinero(c.antes.precio)} → <strong>${dinero(c.precio)}</strong>` : ''
              }${c.costo !== undefined ? ` <small>costo ${dinero(c.antes.costo)} → ${dinero(c.costo)}</small>` : ''}</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="ayuda">No hay productos en esa categoría.</p>';
    }

    form.addEventListener('input', pintarPrevia);
    form.addEventListener('change', pintarPrevia);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { cambios } = calcular();
      if (!cambios.length) return;
      const ok = await confirmar(`Se cambiarán ${cambios.length} productos. Puedes corregir cualquiera después, uno por uno.`, {
        titulo: '¿Aplicar el cambio?',
        si: 'Aplicar',
      });
      if (!ok) return;
      guardarProductos(cambios.map(({ id, precio, costo }) => ({ id, precio, costo })));
      aviso(`Listo: ${cambios.length} productos actualizados`);
      cerrar();
    });
    pintarPrevia();
  }

  // ---------- Categorías ----------

  function administrarCategorias() {
    const { cuerpo } = abrirModal({ titulo: 'Categorías' });

    function pintarCats() {
      const cats = categorias();
      const cuenta = (c) => estado.productos.filter((p) => p.categoria === c).length;
      cuerpo.innerHTML = `
        <ul class="lista-categorias">
          ${cats
            .map(
              (c) => `
            <li>
              <span>${esc(c)} <small>${cuenta(c)} productos</small></span>
              <button type="button" class="btn-icono" data-renombrar="${esc(c)}" aria-label="Renombrar ${esc(c)}">${icono('editar')}</button>
              <button type="button" class="btn-icono" data-quitar="${esc(c)}" aria-label="Quitar ${esc(c)}">${icono('basura')}</button>
            </li>`,
            )
            .join('')}
        </ul>
        <div class="fila-botones">
          <button type="button" class="btn primario" data-accion="nueva-cat">${icono('mas')} Nueva categoría</button>
        </div>`;
    }

    cuerpo.addEventListener('click', async (e) => {
      const cats = categorias();
      const ren = e.target.closest('[data-renombrar]')?.dataset.renombrar;
      const qui = e.target.closest('[data-quitar]')?.dataset.quitar;
      if (e.target.closest('[data-accion="nueva-cat"]')) {
        const n = (await pedirDato({ titulo: 'Nueva categoría', etiqueta: 'Nombre', boton: 'Crear' }))?.trim();
        if (n && !cats.includes(n)) guardarTienda({ categorias: [...cats, n] });
      }
      if (ren) {
        const n = (await pedirDato({ titulo: 'Renombrar categoría', etiqueta: 'Nuevo nombre', valor: ren, boton: 'Guardar' }))?.trim();
        if (!n || n === ren) return;
        guardarTienda({ categorias: [...new Set(cats.map((c) => (c === ren ? n : c)))] });
        cambiarCategoriaDe(
          estado.productos.filter((p) => p.categoria === ren),
          n,
        );
        aviso('Categoría renombrada');
      }
      if (qui) {
        const afectados = estado.productos.filter((p) => p.categoria === qui);
        const ok = await confirmar(
          afectados.length ? `Sus ${afectados.length} productos pasarán a «Otros».` : 'La categoría está vacía.',
          { titulo: `¿Quitar «${qui}»?`, si: 'Quitar', peligro: true },
        );
        if (!ok) return;
        const nuevas = cats.filter((c) => c !== qui);
        if (afectados.length && !nuevas.includes('Otros')) nuevas.push('Otros');
        guardarTienda({ categorias: nuevas });
        if (afectados.length) cambiarCategoriaDe(afectados, 'Otros');
      }
    });

    pintarCats();
    const quitar = escuchar('tienda', () => cuerpo.isConnected && pintarCats());
    const quitar2 = escuchar('productos', () => cuerpo.isConnected && pintarCats());
    cuerpo.closest('dialog').addEventListener('close', () => {
      quitar();
      quitar2();
    });
  }

  // ---------- Historial de movimientos ----------

  function historial() {
    const { cuerpo, dlg } = abrirModal({ titulo: 'Historial de inventario', contenido: '<p class="ayuda">Cargando…</p>' });
    const NOMBRES = { entrada: 'Entrada', ajuste: 'Ajuste', alta: 'Alta' };
    const quitar = escucharMovimientos(200, (movs) => {
      cuerpo.innerHTML = movs.length
        ? `<ul class="lista-movimientos">${movs
            .map(
              (m) => `
            <li class="mov-${esc(m.tipo)}">
              <span class="mov-tipo">${NOMBRES[m.tipo] ?? esc(m.tipo)}</span>
              <span class="mov-detalle"><strong>${esc(m.nombre)}</strong>
                <small>${esc(fechaHora(m.ts))}${m.tipo === 'entrada' && m.costo ? ` · costo ${dinero(m.costo)} c/u · total ${dinero(m.total)}` : ''}${
                  m.tipo === 'ajuste' ? ` · de ${cantidadTexto(m.antes, m.unidad)} a ${cantidadTexto(m.despues, m.unidad)}` : ''
                }${m.nota ? ` · ${esc(m.nota)}` : ''}</small></span>
              <span class="mov-cant ${m.cantidad < 0 ? 'negativo' : ''}">${m.cantidad > 0 ? '+' : ''}${cantidadTexto(m.cantidad, m.unidad)}</span>
            </li>`,
            )
            .join('')}</ul>`
        : '<p class="vacio">Todavía no hay movimientos. Aquí aparecen las entradas de mercancía y los ajustes de existencia.</p>';
    });
    dlg.addEventListener('close', quitar);
  }

  // ---------- Excel ----------

  const COLUMNAS = ['id', 'nombre', 'codigos', 'categoria', 'unidad', 'costo', 'precio', 'existencia', 'minimo', 'boton_rapido'];

  function exportar() {
    const filas = [COLUMNAS];
    for (const p of estado.productos) {
      filas.push([p.id, p.nombre, (p.codigos ?? []).join(' '), p.categoria ?? '', p.unidad ?? 'pza', p.costo ?? 0, p.precio ?? 0, p.stock ?? 0, p.minimo ?? 0, p.favorito ? 'si' : 'no']);
    }
    descargar(`inventario-${diaISO()}.csv`, aCSV(filas));
  }

  function importar(texto) {
    const filas = leerCSV(texto);
    if (filas.length < 2) {
      avisoError('El archivo está vacío.');
      return;
    }
    const alias = {
      id: 'id',
      nombre: 'nombre',
      producto: 'nombre',
      codigos: 'codigos',
      codigo: 'codigos',
      'codigo de barras': 'codigos',
      'codigos de barras': 'codigos',
      categoria: 'categoria',
      unidad: 'unidad',
      costo: 'costo',
      precio: 'precio',
      'precio de venta': 'precio',
      existencia: 'stock',
      stock: 'stock',
      minimo: 'minimo',
      boton_rapido: 'favorito',
    };
    const cab = filas[0].map((c) => alias[normalizar(c)] ?? null);
    if (!cab.includes('nombre') && !cab.includes('id')) {
      avisoError('El archivo necesita al menos la columna «nombre».');
      return;
    }
    const porNombre = new Map(estado.productos.map((p) => [p._nombre, p]));
    const porCodigo = new Map();
    estado.productos.forEach((p) => (p.codigos ?? []).forEach((c) => variantesCodigo(c).forEach((v) => porCodigo.set(v, p))));
    const cambios = [];
    let nuevos = 0;
    let errores = 0;
    for (const fila of filas.slice(1)) {
      const d = {};
      cab.forEach((campo, i) => {
        if (campo && fila[i] !== undefined) d[campo] = fila[i].trim();
      });
      const cambio = {};
      if (d.nombre) cambio.nombre = d.nombre;
      if (d.codigos !== undefined) cambio.codigos = d.codigos.split(/[\s|;,]+/).filter(Boolean);
      if (d.categoria) cambio.categoria = d.categoria;
      if (d.unidad) {
        const u = normalizar(d.unidad);
        cambio.unidad = u.startsWith('k') ? 'kg' : u.startsWith('l') ? 'l' : 'pza';
      }
      for (const campo of ['costo', 'precio', 'stock', 'minimo']) {
        if (d[campo] !== undefined && d[campo] !== '') {
          const n = leerNumero(d[campo]);
          if (Number.isFinite(n)) cambio[campo] = redondear(n, campo === 'stock' || campo === 'minimo' ? 3 : 2);
        }
      }
      if (d.favorito !== undefined) cambio.favorito = ['si', 'sí', 'x', '1', 'true'].includes(normalizar(d.favorito));
      const existente =
        (d.id && estado.porId.get(d.id)) ||
        (cambio.codigos ?? []).map((c) => porCodigo.get(c)).find(Boolean) ||
        (d.nombre && porNombre.get(normalizar(d.nombre)));
      if (existente) {
        cambios.push({ id: existente.id, ...cambio });
      } else if (cambio.nombre && Number.isFinite(cambio.precio)) {
        cambios.push({ categoria: 'Otros', unidad: 'pza', costo: 0, stock: 0, minimo: 0, codigos: [], ...cambio });
        nuevos++;
      } else {
        errores++;
      }
    }
    const actualizados = cambios.length - nuevos;
    const { cuerpo, cerrar } = abrirModal({
      titulo: 'Subir inventario',
      clase: 'modal-chico',
      contenido: `
        <div class="confirmar-texto">
          <p>Se encontraron <strong>${cambios.length}</strong> productos en el archivo:</p>
          <ul><li>${actualizados} se actualizarán</li><li>${nuevos} se agregarán como nuevos</li>${
            errores ? `<li>${errores} filas se ignorarán (sin nombre o sin precio)</li>` : ''
          }</ul>
        </div>
        <label class="casilla">
          <input type="checkbox" data-existencias />
          <span>También cambiar las existencias por las del archivo (solo si acabas de contar; si no, se respetan las de la app)</span>
        </label>
        <div class="fila-botones">
          <button type="button" class="btn" data-cerrar>Cancelar</button>
          <button type="button" class="btn primario" data-subir ${cambios.length ? '' : 'disabled'}>Subir cambios</button>
        </div>`,
    });
    cuerpo.querySelector('[data-subir]').addEventListener('click', () => {
      // Por defecto no se tocan las existencias de lo que ya estaba: pudo
      // venderse algo entre que se descargó el archivo y se volvió a subir.
      const conExistencias = cuerpo.querySelector('[data-existencias]').checked;
      const finales = cambios.map((c) => {
        if (conExistencias || !c.id) return c;
        const { stock, ...resto } = c;
        return resto;
      });
      const cats = new Set(estado.tienda.categorias ?? []);
      finales.forEach((c) => c.categoria && cats.add(c.categoria));
      guardarTienda({ categorias: [...cats] });
      guardarProductos(finales);
      aviso(`Listo: ${actualizados} actualizados y ${nuevos} nuevos`);
      cerrar();
    });
  }

  // ---------- Instalar ----------

  async function instalar() {
    if (instalacion.evento) {
      instalacion.evento.prompt();
      await instalacion.evento.userChoice.catch(() => {});
      instalacion.evento = null;
      pintar();
      return;
    }
    abrirModal({
      titulo: 'Instalar la app',
      clase: 'modal-chico',
      contenido: esIOS()
        ? `<ol class="pasos"><li>Abre esta página en <strong>Safari</strong>.</li><li>Toca el botón <strong>Compartir</strong> (cuadro con flecha hacia arriba).</li><li>Elige <strong>«Agregar a inicio»</strong>.</li></ol>`
        : `<ol class="pasos"><li>Abre esta página en <strong>Chrome</strong>.</li><li>Toca el menú <strong>⋮</strong> (arriba a la derecha).</li><li>Elige <strong>«Instalar app»</strong> o <strong>«Agregar a la pantalla principal»</strong>.</li></ol>`,
    });
  }

  // ---------- Eventos ----------

  vista.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'nombre') {
      const n = (await pedirDato({ titulo: 'Nombre de la tienda', etiqueta: 'Nombre', valor: estado.tienda.nombre, boton: 'Guardar' }))?.trim();
      if (n) guardarTienda({ nombre: n });
    }
    if (accion === 'precios') preciosEnBloque();
    if (accion === 'categorias') administrarCategorias();
    if (accion === 'historial') historial();
    if (accion === 'exportar') exportar();
    if (accion === 'importar') vista.querySelector('[data-archivo]').click();
    if (accion === 'instalar') instalar();
    if (accion === 'catalogo') {
      const n = productosNuevosDelCatalogo().length;
      const ok = await confirmar(
        `Se agregarán ${n} productos típicos de abarrotes con precios aproximados del Estado de México (${FECHA_PRECIOS}). Los que ya tengas no se tocan. Llegan con existencia 0: después cuenta lo que tienes.`,
        { titulo: 'Cargar catálogo inicial', si: 'Cargar productos' },
      );
      if (ok) cargarCatalogo();
    }
    if (accion === 'salir') {
      const extra = hayPendientes() ? ' Hay cambios que todavía no se suben: conéctate a internet antes de salir.' : '';
      const ok = await confirmar(`Tendrás que volver a escribir tu correo y contraseña.${extra}`, {
        titulo: '¿Cerrar sesión?',
        si: 'Cerrar sesión',
        peligro: Boolean(extra),
      });
      if (ok) signOut(auth);
    }
  });

  vista.addEventListener('change', (e) => {
    if (!e.target.matches('[data-archivo]')) return;
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => importar(String(lector.result));
    lector.onerror = () => avisoError('No se pudo leer el archivo.');
    lector.readAsText(archivo, 'utf-8');
  });

  const quitar = [
    escuchar('tienda', pintar),
    escuchar('productos', pintar),
    escuchar('pendientes', pintarConexion),
    escuchar('instalable', pintar),
  ];
  const conexion = () => pintarConexion();
  window.addEventListener('online', conexion);
  window.addEventListener('offline', conexion);
  pintar();

  return () => {
    quitar.forEach((q) => q());
    window.removeEventListener('online', conexion);
    window.removeEventListener('offline', conexion);
  };
}
