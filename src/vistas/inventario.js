// Pantalla "Inventario": lista de productos, existencias, costos y conteo.
import { esc, dinero, numero, redondear, leerNumero, cantidadTexto, debounce, aviso, avisoError } from '../util.js';
import { icono } from '../iconos.js';
import { estado, escuchar, categorias, buscarProductos, buscarPorCodigo, existenciaBaja, agotado } from '../estado.js';
import { ajustarExistencia } from '../datos.js';
import { abrirEscaner } from '../escaner.js';
import { abrirFormularioProducto, abrirEntrada } from './producto.js';

const filtros = { texto: '', categoria: '', soloBajos: false, orden: 'nombre', conteo: false };

export function montar(contenedor) {
  contenedor.innerHTML = `
    <section class="vista vista-inventario">
      <div class="tarjetas-resumen" data-resumen></div>

      <div class="botones-inv">
        <button type="button" class="btn primario" data-accion="nuevo">${icono('mas')} Nuevo producto</button>
        <button type="button" class="btn" data-accion="entrada">${icono('camion')} Llegó mercancía</button>
        <button type="button" class="btn" data-accion="conteo" aria-pressed="false">${icono('lista')} Contar inventario</button>
      </div>

      <div class="filtros">
        <div class="fila-campo">
          <div class="campo-busqueda">${icono('buscar')}<input type="search" name="texto" placeholder="Buscar por nombre o código" autocomplete="off" /></div>
          <button type="button" class="btn primario-suave" data-accion="escanear" aria-label="Buscar escaneando">${icono('escanear')}</button>
        </div>
        <div class="fila-filtros">
          <select name="categoria" aria-label="Categoría"></select>
          <select name="orden" aria-label="Ordenar">
            <option value="nombre">A → Z</option>
            <option value="existencia">Menos existencia</option>
            <option value="ganancia">Más ganancia %</option>
            <option value="categoria">Por categoría</option>
          </select>
          <label class="casilla chica"><input type="checkbox" name="soloBajos" /> <span>Por agotarse</span></label>
        </div>
      </div>

      <p class="ayuda conteo-ayuda" hidden>
        ${icono('info')} Escribe cuántos hay de cada producto. Se guarda solo al pasar al siguiente.
      </p>
      <ul class="lista-productos"></ul>
    </section>`;

  const vista = contenedor.querySelector('.vista-inventario');
  const lista = vista.querySelector('.lista-productos');
  const resumen = vista.querySelector('[data-resumen]');
  const inputTexto = vista.querySelector('[name="texto"]');
  const selCategoria = vista.querySelector('[name="categoria"]');
  const selOrden = vista.querySelector('[name="orden"]');
  const chkBajos = vista.querySelector('[name="soloBajos"]');
  const btnConteo = vista.querySelector('[data-accion="conteo"]');
  const ayudaConteo = vista.querySelector('.conteo-ayuda');

  inputTexto.value = filtros.texto;
  selOrden.value = filtros.orden;
  chkBajos.checked = filtros.soloBajos;

  function pintarCategorias() {
    const cats = categorias();
    selCategoria.innerHTML = `<option value="">Todas las categorías</option>${cats.map((c) => `<option ${c === filtros.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;
  }

  function pintarResumen() {
    const ps = estado.productos;
    let valorCosto = 0;
    let valorVenta = 0;
    let bajos = 0;
    for (const p of ps) {
      const s = Math.max(0, Number(p.stock) || 0);
      valorCosto += s * (Number(p.costo) || 0);
      valorVenta += s * (Number(p.precio) || 0);
      if (existenciaBaja(p)) bajos++;
    }
    resumen.innerHTML = `
      <div class="tarjeta"><span>Productos</span><strong>${numero(ps.length, 0)}</strong></div>
      <div class="tarjeta"><span>Invertido en mercancía</span><strong>${dinero(valorCosto)}</strong></div>
      <div class="tarjeta"><span>Vale a precio de venta</span><strong>${dinero(valorVenta)}</strong></div>
      <button type="button" class="tarjeta ${bajos ? 'alerta' : ''}" data-accion="ver-bajos"><span>Por agotarse</span><strong>${numero(bajos, 0)}</strong></button>`;
  }

  function productosFiltrados() {
    let ps = filtros.texto ? buscarProductos(filtros.texto, 100000) : [...estado.productos];
    if (filtros.categoria) ps = ps.filter((p) => p.categoria === filtros.categoria);
    if (filtros.soloBajos) ps = ps.filter(existenciaBaja);
    const pct = (p) => (Number(p.costo) > 0 ? (Number(p.precio) - Number(p.costo)) / Number(p.costo) : -1);
    if (filtros.orden === 'existencia') ps.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
    if (filtros.orden === 'ganancia') ps.sort((a, b) => pct(b) - pct(a));
    if (filtros.orden === 'categoria') ps.sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es') || a._nombre.localeCompare(b._nombre, 'es'));
    return ps;
  }

  function pintarLista() {
    const ps = productosFiltrados();
    if (!estado.productosListos) {
      lista.innerHTML = '<li class="vacio">Cargando productos…</li>';
      return;
    }
    if (!estado.productos.length) {
      lista.innerHTML = `<li class="vacio">Todavía no hay productos. Toca «Nuevo producto» o carga el catálogo inicial en «Más».</li>`;
      return;
    }
    if (!ps.length) {
      lista.innerHTML = '<li class="vacio">Ningún producto coincide con la búsqueda.</li>';
      return;
    }
    lista.innerHTML = ps
      .map((p) => {
        const stock = Number(p.stock) || 0;
        const clase = agotado(p) ? 'agotado' : existenciaBaja(p) ? 'bajo' : 'ok';
        const costo = Number(p.costo) || 0;
        const ganancia = costo > 0 ? redondear(((Number(p.precio) - costo) / costo) * 100, 0) : null;
        const cod = p.codigos?.[0] ? ` · ${esc(p.codigos[0])}${p.codigos.length > 1 ? ` +${p.codigos.length - 1}` : ''}` : '';
        if (filtros.conteo) {
          return `
          <li class="producto conteo" data-id="${esc(p.id)}">
            <div class="p-info">
              <div class="p-nombre">${esc(p.nombre)}</div>
              <div class="p-meta">${esc(p.categoria ?? '')}${cod}</div>
            </div>
            <label class="p-conteo">
              <span class="oculto">Existencia de ${esc(p.nombre)}</span>
              <input type="number" inputmode="decimal" step="any" value="${stock}" data-conteo="${esc(p.id)}" />
              <small>${p.unidad === 'kg' ? 'kg' : p.unidad === 'l' ? 'L' : 'pzas'}</small>
            </label>
          </li>`;
        }
        return `
        <li class="producto" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="Editar ${esc(p.nombre)}">
          <div class="p-info">
            <div class="p-nombre">${p.favorito ? `<span class="fav" title="Botón rápido">${icono('estrella')}</span>` : ''}${esc(p.nombre)}</div>
            <div class="p-meta">${esc(p.categoria ?? '')}${cod}</div>
          </div>
          <div class="p-precios">
            <div class="p-precio">${dinero(p.precio)}${p.unidad === 'kg' ? '<small>/kg</small>' : p.unidad === 'l' ? '<small>/L</small>' : ''}</div>
            <div class="p-costo">costo ${dinero(costo)}${ganancia !== null ? ` · <span class="${ganancia < 0 ? 'negativo' : ''}">${ganancia}%</span>` : ''}</div>
          </div>
          <div class="p-stock ${clase}" title="Existencia">${cantidadTexto(stock, p.unidad)}</div>
        </li>`;
      })
      .join('');
  }

  const pintarTodo = () => {
    pintarCategorias();
    pintarResumen();
    pintarLista();
  };

  // ---------- Eventos ----------

  inputTexto.addEventListener(
    'input',
    debounce(() => {
      filtros.texto = inputTexto.value.trim();
      pintarLista();
    }, 150),
  );
  selCategoria.addEventListener('change', () => {
    filtros.categoria = selCategoria.value;
    pintarLista();
  });
  selOrden.addEventListener('change', () => {
    filtros.orden = selOrden.value;
    pintarLista();
  });
  chkBajos.addEventListener('change', () => {
    filtros.soloBajos = chkBajos.checked;
    pintarLista();
  });

  // Conteo: guardar al salir de cada casilla o al dar Enter.
  lista.addEventListener('change', (e) => {
    const id = e.target.dataset?.conteo;
    if (!id) return;
    const p = estado.porId.get(id);
    const nueva = leerNumero(e.target.value);
    if (!p || !Number.isFinite(nueva)) {
      avisoError('Escribe un número.');
      return;
    }
    ajustarExistencia(p, redondear(nueva, 3), 'Conteo de inventario');
    e.target.classList.add('guardado');
  });
  lista.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset?.conteo) {
      e.preventDefault();
      const campos = [...lista.querySelectorAll('[data-conteo]')];
      const sig = campos[campos.indexOf(e.target) + 1];
      if (sig) sig.focus();
      else e.target.blur();
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li.producto[data-id]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  vista.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'nuevo') abrirFormularioProducto();
    else if (accion === 'entrada') abrirEntrada();
    else if (accion === 'ver-bajos') {
      filtros.soloBajos = true;
      chkBajos.checked = true;
      filtros.orden = 'existencia';
      selOrden.value = 'existencia';
      pintarLista();
      lista.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (accion === 'conteo') {
      filtros.conteo = !filtros.conteo;
      btnConteo.setAttribute('aria-pressed', String(filtros.conteo));
      btnConteo.classList.toggle('activo', filtros.conteo);
      ayudaConteo.hidden = !filtros.conteo;
      pintarLista();
    } else if (accion === 'escanear') {
      const c = await abrirEscaner({ titulo: 'Buscar producto' });
      if (!c) return;
      const p = buscarPorCodigo(c);
      if (p) abrirFormularioProducto({ producto: p });
      else {
        aviso('Ese código no está registrado: puedes darlo de alta.', 'info');
        abrirFormularioProducto({ codigo: c });
      }
    } else if (!filtros.conteo) {
      const fila = e.target.closest('li.producto[data-id]');
      const p = fila && estado.porId.get(fila.dataset.id);
      if (p) abrirFormularioProducto({ producto: p });
    }
  });

  const quitar = [
    escuchar('productos', () => {
      // En modo conteo no se repinta mientras se escribe (se perdería lo tecleado).
      if (filtros.conteo && lista.contains(document.activeElement)) {
        pintarResumen();
        return;
      }
      pintarTodo();
    }),
    escuchar('tienda', pintarCategorias),
  ];

  pintarTodo();
  return () => quitar.forEach((q) => q());
}
