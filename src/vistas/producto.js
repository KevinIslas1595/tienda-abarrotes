// Ventanas que se usan en varias pantallas: formulario de producto, elegir
// un producto, cantidad a granel y entrada de mercancía.
import {
  esc,
  dinero,
  numero,
  redondear,
  leerNumero,
  esGranel,
  nombreUnidad,
  cantidadTexto,
  abrirModal,
  confirmar,
  pedirDato,
  aviso,
  avisoError,
  errorEnCampo,
  leerLocal,
  guardarLocal,
} from '../util.js';
import { icono } from '../iconos.js';
import { estado, categorias, buscarProductos, buscarPorCodigo, variantesCodigo } from '../estado.js';
import { guardarProducto, borrarProducto, agregarCategoria, registrarEntrada } from '../datos.js';
import { abrirEscaner } from '../escaner.js';

const redondearA50 = (n) => Math.ceil(redondear(n) * 2) / 2;

// ---------- Buscar el nombre de un código en internet (Open Food Facts) ----------

async function nombreDesdeInternet(codigo) {
  if (!navigator.onLine) return null;
  try {
    const campos = 'product_name_es,product_name,brands,quantity';
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${campos}`, {
      signal: AbortSignal.timeout(7000),
    });
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product;
    let nombre = (p.product_name_es || p.product_name || '').trim();
    const marca = (p.brands || '').split(',')[0].trim();
    if (marca && !nombre.toLowerCase().includes(marca.toLowerCase())) nombre = `${nombre} ${marca}`.trim();
    if (p.quantity && !nombre.includes(p.quantity)) nombre = `${nombre} ${p.quantity}`.trim();
    return nombre || null;
  } catch {
    return null;
  }
}

// ---------- Formulario de producto (nuevo o editar) ----------

export function abrirFormularioProducto({ producto = null, codigo = '', nombre = '', alGuardar } = {}) {
  const p = producto ?? {
    nombre,
    codigos: codigo ? [String(codigo)] : [],
    categoria: leerLocal('ultimaCategoria', 'Otros'),
    unidad: 'pza',
    costo: '',
    precio: '',
    stock: 0,
    minimo: 0,
    favorito: false,
  };
  const codigos = [...(p.codigos ?? [])];
  const existenciaAnterior = producto ? Number(producto.stock) || 0 : undefined;
  const cats = categorias();
  if (p.categoria && !cats.includes(p.categoria)) cats.push(p.categoria);

  const { cuerpo, cerrar } = abrirModal({
    titulo: producto ? 'Editar producto' : 'Nuevo producto',
    contenido: `
      <form class="formulario" novalidate>
        <label class="campo">
          <span>Nombre del producto *</span>
          <input name="nombre" value="${esc(p.nombre)}" placeholder="Ej. Coca-Cola 600 ml" autocomplete="off" />
        </label>
        <p class="ayuda" data-internet hidden></p>

        <div class="campo">
          <span>Códigos de barras</span>
          <div class="codigos" data-codigos></div>
          <div class="fila-campo">
            <input name="nuevoCodigo" inputmode="numeric" placeholder="Escribe o escanea" autocomplete="off" />
            <button type="button" class="btn" data-accion="agregar-codigo">Agregar</button>
            <button type="button" class="btn primario-suave" data-accion="escanear-codigo" aria-label="Escanear código">${icono('escanear')}</button>
          </div>
        </div>

        <div class="dos-columnas">
          <label class="campo">
            <span>Categoría</span>
            <select name="categoria">
              ${cats.map((c) => `<option ${c === p.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}
              <option value="__nueva">+ Nueva categoría…</option>
            </select>
          </label>
          <label class="campo">
            <span>Se vende por</span>
            <select name="unidad">
              <option value="pza" ${!esGranel(p.unidad) ? 'selected' : ''}>Pieza</option>
              <option value="kg" ${p.unidad === 'kg' ? 'selected' : ''}>Kilo (a granel)</option>
              <option value="l" ${p.unidad === 'l' ? 'selected' : ''}>Litro (a granel)</option>
            </select>
          </label>
        </div>

        <div class="dos-columnas">
          <label class="campo">
            <span data-etq="costo">Costo (lo que te cuesta)</span>
            <div class="con-signo"><input name="costo" type="number" inputmode="decimal" step="any" min="0" value="${esc(p.costo)}" placeholder="0.00" /></div>
          </label>
          <label class="campo">
            <span data-etq="precio">Precio de venta *</span>
            <div class="con-signo"><input name="precio" type="number" inputmode="decimal" step="any" min="0" value="${esc(p.precio)}" placeholder="0.00" /></div>
          </label>
        </div>
        <div class="ganancia" data-ganancia></div>
        <div class="margenes">
          <span>Poner precio ganando:</span>
          ${[10, 15, 20, 25, 30, 40].map((m) => `<button type="button" class="chip" data-margen="${m}">${m}%</button>`).join('')}
        </div>

        <div class="dos-columnas">
          <label class="campo">
            <span data-etq="stock">Existencia (cuántos hay)</span>
            <input name="stock" type="number" inputmode="decimal" step="any" value="${esc(p.stock ?? 0)}" />
          </label>
          <label class="campo">
            <span>Avisarme cuando queden</span>
            <input name="minimo" type="number" inputmode="decimal" step="any" min="0" value="${esc(p.minimo ?? 0)}" />
          </label>
        </div>

        <label class="casilla">
          <input type="checkbox" name="favorito" ${p.favorito ? 'checked' : ''} />
          <span>Botón rápido en «Cobrar» (útil para lo que no trae código: huevo, tortilla, pan…)</span>
        </label>

        <div class="fila-botones">
          ${producto ? `<button type="button" class="btn peligro-texto" data-accion="borrar">${icono('basura')} Borrar</button>` : ''}
          <span class="espacio"></span>
          <button type="button" class="btn" data-cerrar>Cancelar</button>
          <button type="submit" class="btn primario">Guardar</button>
        </div>
      </form>`,
  });

  const form = cuerpo.querySelector('form');
  const cajaCodigos = cuerpo.querySelector('[data-codigos]');
  const cajaGanancia = cuerpo.querySelector('[data-ganancia]');
  const ayudaInternet = cuerpo.querySelector('[data-internet]');

  function pintarCodigos() {
    cajaCodigos.innerHTML = codigos.length
      ? codigos
          .map(
            (c, i) =>
              `<span class="chip-codigo">${esc(c)}<button type="button" data-quitar-codigo="${i}" aria-label="Quitar código ${esc(c)}">${icono('cerrar')}</button></span>`,
          )
          .join('')
      : '<span class="ayuda">Sin código (se busca por nombre).</span>';
  }

  function pintarEtiquetas() {
    const u = form.unidad.value;
    const por = esGranel(u) ? ` por ${u === 'kg' ? 'kilo' : 'litro'}` : '';
    cuerpo.querySelector('[data-etq="costo"]').textContent = `Costo${por} (lo que te cuesta)`;
    cuerpo.querySelector('[data-etq="precio"]').textContent = `Precio de venta${por} *`;
    cuerpo.querySelector('[data-etq="stock"]').textContent = esGranel(u) ? `Existencia (${nombreUnidad(u)})` : 'Existencia (cuántos hay)';
  }

  function pintarGanancia() {
    const costo = leerNumero(form.costo.value);
    const precio = leerNumero(form.precio.value);
    if (!(precio > 0) || !(costo > 0)) {
      cajaGanancia.innerHTML = '';
      return;
    }
    const g = redondear(precio - costo);
    const pct = redondear((g / costo) * 100, 1);
    cajaGanancia.className = `ganancia ${g < 0 ? 'negativa' : ''}`;
    cajaGanancia.innerHTML =
      g < 0
        ? `${icono('alerta')} Pierdes ${dinero(-g)} en cada venta: el precio es menor que el costo.`
        : `Ganas <strong>${dinero(g)}</strong> en cada venta (${numero(pct, 1)}% sobre el costo).`;
  }

  function agregarCodigoDesde(valor) {
    const c = String(valor ?? '').trim();
    if (!c) return;
    if (variantesCodigo(c).some((v) => codigos.includes(v))) {
      aviso('Ese código ya está en la lista.', 'info');
      return;
    }
    const otro = buscarPorCodigo(c);
    if (otro && otro.id !== producto?.id) {
      avisoError(`Ese código ya pertenece a «${otro.nombre}».`);
      return;
    }
    codigos.push(c);
    pintarCodigos();
    if (!form.nombre.value.trim()) completarNombre(c);
  }

  async function completarNombre(c) {
    ayudaInternet.hidden = false;
    ayudaInternet.textContent = 'Buscando el nombre en internet…';
    const n = await nombreDesdeInternet(c);
    if (!form.isConnected) return;
    if (n && !form.nombre.value.trim()) {
      form.nombre.value = n;
      ayudaInternet.textContent = 'Nombre sugerido por internet: revísalo antes de guardar.';
    } else {
      ayudaInternet.hidden = true;
    }
  }

  pintarCodigos();
  pintarEtiquetas();
  pintarGanancia();
  if (!producto && codigo && !nombre) completarNombre(codigo);
  if (!producto) setTimeout(() => form.nombre.focus(), 50);

  form.addEventListener('input', (e) => {
    if (e.target.name === 'costo' || e.target.name === 'precio') pintarGanancia();
  });

  form.nuevoCodigo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarCodigoDesde(form.nuevoCodigo.value);
      form.nuevoCodigo.value = '';
    }
  });

  form.unidad.addEventListener('change', pintarEtiquetas);

  form.categoria.addEventListener('change', async () => {
    if (form.categoria.value !== '__nueva') return;
    const nueva = (await pedirDato({ titulo: 'Nueva categoría', etiqueta: 'Nombre de la categoría', boton: 'Crear' }))?.trim();
    if (nueva) {
      const opt = new Option(nueva, nueva, true, true);
      form.categoria.add(opt, form.categoria.options.length - 1);
      agregarCategoria(nueva);
    } else {
      form.categoria.value = p.categoria && cats.includes(p.categoria) ? p.categoria : cats[0];
    }
  });

  cuerpo.addEventListener('click', async (e) => {
    const quitar = e.target.closest('[data-quitar-codigo]');
    if (quitar) {
      codigos.splice(Number(quitar.dataset.quitarCodigo), 1);
      pintarCodigos();
      return;
    }
    const margen = e.target.closest('[data-margen]');
    if (margen) {
      const costo = leerNumero(form.costo.value);
      if (!(costo > 0)) {
        errorEnCampo(form.costo, 'Primero escribe el costo.');
        return;
      }
      form.precio.value = redondearA50(costo * (1 + Number(margen.dataset.margen) / 100));
      pintarGanancia();
      return;
    }
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'agregar-codigo') {
      agregarCodigoDesde(form.nuevoCodigo.value);
      form.nuevoCodigo.value = '';
    }
    if (accion === 'escanear-codigo') {
      const c = await abrirEscaner({ titulo: 'Escanea el código del producto' });
      if (c) agregarCodigoDesde(c);
    }
    if (accion === 'borrar') {
      const ok = await confirmar(`Se borrará «${producto.nombre}» del inventario. Las ventas pasadas no se modifican.`, {
        titulo: '¿Borrar producto?',
        si: 'Sí, borrar',
        peligro: true,
      });
      if (ok) {
        borrarProducto(producto);
        aviso('Producto borrado');
        cerrar();
      }
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombreFinal = form.nombre.value.trim().replace(/\s+/g, ' ');
    const precio = leerNumero(form.precio.value);
    const costo = leerNumero(form.costo.value);
    const stock = leerNumero(form.stock.value);
    const minimo = leerNumero(form.minimo.value);
    if (!nombreFinal) {
      errorEnCampo(form.nombre, 'Escribe el nombre del producto.');
      return;
    }
    if (!(precio >= 0) || form.precio.value.trim() === '') {
      errorEnCampo(form.precio, 'Escribe el precio de venta.');
      return;
    }
    if (form.costo.value.trim() !== '' && !(costo >= 0)) {
      errorEnCampo(form.costo, 'El costo no es un número válido.');
      return;
    }
    const pendiente = form.nuevoCodigo.value.trim();
    if (pendiente) agregarCodigoDesde(pendiente);
    const categoria = form.categoria.value === '__nueva' ? 'Otros' : form.categoria.value;
    guardarLocal('ultimaCategoria', categoria);
    const datos = {
      id: producto?.id,
      nombre: nombreFinal,
      codigos,
      categoria,
      unidad: form.unidad.value,
      costo: Number.isFinite(costo) ? redondear(costo) : 0,
      precio: redondear(precio),
      stock: Number.isFinite(stock) ? redondear(stock, 3) : 0,
      minimo: Number.isFinite(minimo) ? redondear(minimo, 3) : 0,
      favorito: form.favorito.checked,
    };
    const id = guardarProducto(datos, { existenciaAnterior });
    aviso(producto ? 'Cambios guardados' : 'Producto agregado');
    cerrar();
    alGuardar?.({ ...datos, id });
  });
}

// ---------- Elegir un producto existente (buscar o escanear) ----------

export function elegirProducto({ titulo = 'Elegir producto', ayuda = '' } = {}) {
  return new Promise((resolve) => {
    let elegido = null;
    const { cuerpo, cerrar } = abrirModal({
      titulo,
      alCerrar: () => resolve(elegido),
      contenido: `
        ${ayuda ? `<p class="ayuda">${esc(ayuda)}</p>` : ''}
        <div class="fila-campo">
          <div class="campo-busqueda">${icono('buscar')}<input type="search" placeholder="Buscar por nombre o código" autocomplete="off" /></div>
          <button type="button" class="btn primario-suave" data-accion="escanear" aria-label="Escanear">${icono('escanear')}</button>
        </div>
        <ul class="lista-elegir"></ul>`,
    });
    const input = cuerpo.querySelector('input');
    const lista = cuerpo.querySelector('.lista-elegir');

    const pintar = () => {
      const t = input.value.trim();
      const res = t ? buscarProductos(t, 60) : estado.productos.slice(0, 60);
      lista.innerHTML = res.length
        ? res
            .map(
              (p) => `
            <li><button type="button" data-id="${esc(p.id)}">
              <span class="nombre">${esc(p.nombre)}</span>
              <span class="meta">${dinero(p.precio)} · hay ${cantidadTexto(p.stock ?? 0, p.unidad)}</span>
            </button></li>`,
            )
            .join('')
        : '<li class="vacio">No se encontró ningún producto.</li>';
    };
    pintar();
    input.addEventListener('input', pintar);
    input.focus();

    cuerpo.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-id]');
      if (b) {
        elegido = estado.porId.get(b.dataset.id) ?? null;
        cerrar();
        return;
      }
      if (e.target.closest('[data-accion="escanear"]')) {
        const c = await abrirEscaner({ titulo });
        if (!c) return;
        const p = buscarPorCodigo(c);
        if (p) {
          elegido = p;
          cerrar();
        } else {
          input.value = c;
          pintar();
          avisoError('Ese código no está registrado.');
        }
      }
    });
  });
}

// ---------- Cantidad para productos a granel (kilo / litro) ----------

export function pedirCantidadGranel(producto, cantidadActual = null) {
  return new Promise((resolve) => {
    let respuesta = null;
    const u = nombreUnidad(producto.unidad);
    const fracciones = producto.unidad === 'kg' ? [0.25, 0.5, 0.75, 1] : [0.5, 1, 2];
    const { cuerpo, cerrar } = abrirModal({
      titulo: producto.nombre,
      clase: 'modal-chico',
      alCerrar: () => resolve(respuesta),
      contenido: `
        <p class="ayuda">${dinero(producto.precio)} por ${u === 'kg' ? 'kilo' : 'litro'}</p>
        <form class="formulario" novalidate>
          <div class="dos-columnas">
            <label class="campo"><span>Cantidad (${u})</span>
              <input name="cant" type="number" inputmode="decimal" step="any" min="0" value="${cantidadActual ?? ''}" /></label>
            <label class="campo"><span>o importe en pesos</span>
              <div class="con-signo"><input name="pesos" type="number" inputmode="decimal" step="any" min="0" /></div></label>
          </div>
          <div class="chips">
            ${fracciones.map((f) => `<button type="button" class="chip" data-cant="${f}">${numero(f, 2)} ${u}</button>`).join('')}
            ${[10, 20, 50].map((m) => `<button type="button" class="chip" data-pesos="${m}">$${m}</button>`).join('')}
          </div>
          <p class="total-granel" data-total></p>
          <div class="fila-botones">
            <button type="button" class="btn" data-cerrar>Cancelar</button>
            <button type="submit" class="btn primario">${cantidadActual ? 'Cambiar' : 'Agregar'}</button>
          </div>
        </form>`,
    });
    const form = cuerpo.querySelector('form');
    const total = cuerpo.querySelector('[data-total]');
    const precio = Number(producto.precio) || 0;

    const pintar = () => {
      const c = leerNumero(form.cant.value);
      total.textContent = c > 0 ? `${cantidadTexto(c, producto.unidad)} = ${dinero(c * precio)}` : '';
    };
    const desdePesos = () => {
      const m = leerNumero(form.pesos.value);
      form.cant.value = m > 0 && precio > 0 ? redondear(m / precio, 3) : '';
      pintar();
    };
    form.cant.addEventListener('input', () => {
      const c = leerNumero(form.cant.value);
      form.pesos.value = c > 0 ? redondear(c * precio) : '';
      pintar();
    });
    form.pesos.addEventListener('input', desdePesos);
    cuerpo.addEventListener('click', (e) => {
      const bc = e.target.closest('[data-cant]');
      const bp = e.target.closest('[data-pesos]');
      if (bc) {
        form.cant.value = bc.dataset.cant;
        form.cant.dispatchEvent(new Event('input'));
      }
      if (bp) {
        form.pesos.value = bp.dataset.pesos;
        desdePesos();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = leerNumero(form.cant.value);
      if (!(c > 0)) {
        avisoError('Escribe la cantidad o el importe.');
        return;
      }
      respuesta = redondear(c, 3);
      cerrar();
    });
    pintar();
    form.cant.focus();
  });
}

// ---------- Entrada de mercancía (llegó el proveedor) ----------

export async function abrirEntrada(productoInicial = null) {
  let producto = productoInicial ?? (await elegirProducto({ titulo: 'Entrada de mercancía', ayuda: '¿Qué producto llegó? Búscalo o escanéalo.' }));
  if (!producto) return;

  const { cuerpo, cerrar } = abrirModal({ titulo: 'Entrada de mercancía' });

  function pintar() {
    const u = nombreUnidad(producto.unidad);
    cuerpo.innerHTML = `
      <div class="entrada-producto">
        <div>
          <strong>${esc(producto.nombre)}</strong>
          <div class="meta">Hay ${cantidadTexto(producto.stock ?? 0, producto.unidad)} · costo actual ${dinero(producto.costo)} · precio ${dinero(producto.precio)}</div>
        </div>
        <button type="button" class="btn" data-accion="cambiar">Cambiar</button>
      </div>
      <form class="formulario" novalidate>
        <label class="campo"><span>¿Cuántos llegaron? ${esGranel(producto.unidad) ? `(${u})` : '(piezas)'}</span>
          <input name="cantidad" type="number" inputmode="decimal" step="any" min="0" placeholder="Ej. 24" /></label>
        <div class="dos-columnas">
          <label class="campo"><span>Costo por ${esGranel(producto.unidad) ? u : 'pieza'}</span>
            <div class="con-signo"><input name="costo" type="number" inputmode="decimal" step="any" min="0" value="${esc(producto.costo ?? '')}" /></div></label>
          <label class="campo"><span>Precio de venta</span>
            <div class="con-signo"><input name="precio" type="number" inputmode="decimal" step="any" min="0" value="${esc(producto.precio ?? '')}" /></div></label>
        </div>
        <p class="ayuda">Si el proveedor subió el costo, cámbialo aquí y ajusta tu precio.</p>
        <label class="campo"><span>Nota (opcional)</span><input name="nota" placeholder="Ej. Proveedor Coca-Cola, factura 123" autocomplete="off" /></label>
        <p class="total-granel" data-total></p>
        <div class="fila-botones">
          <button type="button" class="btn" data-cerrar>Terminar</button>
          <button type="submit" class="btn primario">Guardar entrada</button>
        </div>
      </form>`;
    const form = cuerpo.querySelector('form');
    const total = cuerpo.querySelector('[data-total]');
    form.addEventListener('input', () => {
      const c = leerNumero(form.cantidad.value);
      const k = leerNumero(form.costo.value);
      total.textContent = c > 0 && k >= 0 ? `Total de la compra: ${dinero(c * k)}` : '';
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cantidad = leerNumero(form.cantidad.value);
      const costo = leerNumero(form.costo.value);
      const precio = leerNumero(form.precio.value);
      if (!(cantidad > 0)) {
        errorEnCampo(form.cantidad, 'Escribe cuántos llegaron.');
        return;
      }
      registrarEntrada({
        producto,
        cantidad: redondear(cantidad, 3),
        costo: Number.isFinite(costo) && costo !== Number(producto.costo) ? redondear(costo) : NaN,
        precio: Number.isFinite(precio) && precio !== Number(producto.precio) ? redondear(precio) : NaN,
        nota: form.nota.value.trim(),
      });
      aviso(`Entrada guardada: +${cantidadTexto(cantidad, producto.unidad)} ${producto.nombre}`);
      siguiente();
    });
    form.cantidad.focus();
  }

  async function siguiente() {
    const p = await elegirProducto({ titulo: 'Siguiente producto', ayuda: '¿Llegó algo más? Si ya terminaste, cierra esta ventana.' });
    if (!p) {
      cerrar();
      return;
    }
    producto = p;
    pintar();
  }

  cuerpo.addEventListener('click', async (e) => {
    if (e.target.closest('[data-accion="cambiar"]')) {
      const p = await elegirProducto({ titulo: 'Entrada de mercancía' });
      if (p) {
        producto = p;
        pintar();
      }
    }
  });

  pintar();
}
