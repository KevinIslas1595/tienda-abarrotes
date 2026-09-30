// Pantalla "Cobrar": se escanean o buscan productos, se arma la cuenta y se cobra.
import {
  esc,
  dinero,
  redondear,
  leerNumero,
  esGranel,
  cantidadTexto,
  abrirModal,
  confirmar,
  pedirDato,
  aviso,
  avisoError,
  debounce,
} from '../util.js';
import { icono } from '../iconos.js';
import { estado, escuchar, buscarProductos, buscarPorCodigo } from '../estado.js';
import { registrarVenta, cancelarVenta, agregarCodigo } from '../datos.js';
import { abrirEscaner } from '../escaner.js';
import { abrirFormularioProducto, elegirProducto, pedirCantidadGranel } from './producto.js';

// ---------- La cuenta (se guarda en el teléfono por si se cierra la app) ----------

let carrito = [];
try {
  carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
} catch {
  carrito = [];
}

const guardarCarrito = () => {
  try {
    localStorage.setItem('carrito', JSON.stringify(carrito));
  } catch {
    /* sin espacio: no pasa nada */
  }
};

const totalCarrito = () => redondear(carrito.reduce((s, it) => s + it.subtotal, 0));
const piezasCarrito = () => carrito.reduce((s, it) => s + (esGranel(it.unidad) ? 1 : it.cantidad), 0);

function ponerCantidad(it, cantidad) {
  it.cantidad = redondear(cantidad, 3);
  it.subtotal = redondear(it.cantidad * it.precio);
}

function agregarAlCarrito(p, cantidad = 1) {
  let it = carrito.find((x) => x.id && x.id === p.id);
  if (it) {
    ponerCantidad(it, it.cantidad + cantidad);
    carrito.splice(carrito.indexOf(it), 1);
  } else {
    it = {
      id: p.id,
      nombre: p.nombre,
      precio: Number(p.precio) || 0,
      costo: Number(p.costo) || 0,
      unidad: p.unidad ?? 'pza',
    };
    ponerCantidad(it, cantidad);
  }
  carrito.unshift(it); // lo último agregado queda arriba
  guardarCarrito();
  return it;
}

export function montar(contenedor) {
  contenedor.innerHTML = `
    <section class="vista vista-cobrar">
      <div class="cobrar-buscar">
        <div class="campo-busqueda grande">
          ${icono('buscar')}
          <input id="busqueda" type="search" placeholder="Buscar o escribir código" autocomplete="off" enterkeyhint="go" aria-label="Buscar producto o escribir código de barras" />
        </div>
        <button type="button" class="btn primario btn-escanear" data-accion="escanear">${icono('escanear')}<span>Escanear</span></button>
      </div>
      <ul class="sugerencias" hidden></ul>
      <div class="rapidos"></div>
      <div class="carrito-cabeza">
        <h2>Cuenta actual</h2>
        <button type="button" class="btn-texto" data-accion="vaciar" hidden>${icono('basura')} Vaciar</button>
      </div>
      <ul class="carrito"></ul>
    </section>
    <div class="barra-cobrar">
      <div class="barra-total">
        <span>Total</span>
        <strong data-total>$0.00</strong>
        <small data-articulos></small>
      </div>
      <button type="button" class="btn primario grande" data-accion="cobrar" disabled>${icono('billete')} Cobrar</button>
    </div>`;

  const vista = contenedor.querySelector('.vista-cobrar');
  const input = contenedor.querySelector('#busqueda');
  const sugerencias = contenedor.querySelector('.sugerencias');
  const rapidos = contenedor.querySelector('.rapidos');
  const lista = contenedor.querySelector('.carrito');
  const btnCobrar = contenedor.querySelector('[data-accion="cobrar"]');
  const btnVaciar = contenedor.querySelector('[data-accion="vaciar"]');
  const txtTotal = contenedor.querySelector('[data-total]');
  const txtArticulos = contenedor.querySelector('[data-articulos]');
  const conMouse = matchMedia('(pointer: fine)').matches;

  const enfocar = () => {
    if (conMouse && !document.querySelector('dialog[open]')) input.focus();
  };

  // ---------- Pintar ----------

  function pintarCarrito() {
    const total = totalCarrito();
    txtTotal.textContent = dinero(total);
    const n = piezasCarrito();
    txtArticulos.textContent = n ? `${n} artículo${n === 1 ? '' : 's'}` : '';
    btnCobrar.disabled = carrito.length === 0;
    btnVaciar.hidden = carrito.length === 0;
    if (!carrito.length) {
      lista.innerHTML = `
        <li class="carrito-vacio">
          ${icono('escanear', 'grande')}
          <p>Escanea un código o busca un producto para empezar.</p>
        </li>`;
      return;
    }
    lista.innerHTML = carrito
      .map((it, i) => {
        const p = it.id ? estado.porId.get(it.id) : null;
        const hay = p ? Number(p.stock) || 0 : null;
        const falta = p && hay < it.cantidad;
        const granel = esGranel(it.unidad);
        return `
        <li class="item" data-i="${i}">
          <div class="item-info">
            <div class="item-nombre">${esc(it.nombre)}</div>
            <div class="item-precio">${dinero(it.precio)}${granel ? ` / ${it.unidad === 'kg' ? 'kg' : 'L'}` : ' c/u'}
              ${falta ? `<span class="falta">${icono('alerta')} ${hay <= 0 ? 'Sin existencia' : `Solo hay ${cantidadTexto(hay, it.unidad)}`}</span>` : ''}
            </div>
          </div>
          <div class="item-cant">
            ${granel ? '' : `<button type="button" class="btn-icono" data-accion="menos" aria-label="Uno menos">${icono('menos')}</button>`}
            <button type="button" class="cant" data-accion="cantidad" aria-label="Cambiar cantidad">${cantidadTexto(it.cantidad, it.unidad)}</button>
            ${granel ? '' : `<button type="button" class="btn-icono" data-accion="mas" aria-label="Uno más">${icono('mas')}</button>`}
          </div>
          <div class="item-subtotal">${dinero(it.subtotal)}</div>
          <button type="button" class="btn-icono quitar" data-accion="quitar" aria-label="Quitar">${icono('cerrar')}</button>
        </li>`;
      })
      .join('');
  }

  function pintarRapidos() {
    const favoritos = estado.productos.filter((p) => p.favorito);
    rapidos.innerHTML = `
      ${favoritos
        .map((p) => `<button type="button" class="chip-rapido" data-rapido="${esc(p.id)}">${esc(p.nombre)}<small>${dinero(p.precio)}</small></button>`)
        .join('')}
      <button type="button" class="chip-rapido otro" data-accion="varios">${icono('mas')} Artículo sin registro</button>`;
  }

  function pintarSugerencias() {
    const t = input.value.trim();
    if (!t) {
      sugerencias.hidden = true;
      return;
    }
    const res = buscarProductos(t, 8);
    const esCodigo = /^\d{6,}$/.test(t);
    sugerencias.hidden = false;
    sugerencias.innerHTML = res.length
      ? res
          .map(
            (p) => `
          <li><button type="button" data-sugerencia="${esc(p.id)}">
            <span class="nombre">${esc(p.nombre)}</span>
            <span class="precio">${dinero(p.precio)}${esGranel(p.unidad) ? `/${p.unidad === 'kg' ? 'kg' : 'L'}` : ''}</span>
          </button></li>`,
          )
          .join('')
      : `<li class="vacio">${esCodigo ? 'Presiona Enter para buscar ese código.' : 'No hay productos con ese nombre.'}</li>`;
  }

  // ---------- Agregar productos ----------

  async function agregar(p) {
    let cantidad = 1;
    if (esGranel(p.unidad)) {
      cantidad = await pedirCantidadGranel(p);
      if (!cantidad) return null;
    }
    const it = agregarAlCarrito(p, cantidad);
    pintarCarrito();
    lista.querySelector('.item')?.classList.add('recien');
    return it;
  }

  // Código que no está en el inventario: registrarlo, ligarlo o venderlo suelto.
  async function codigoDesconocido(codigo) {
    const opcion = await new Promise((resolve) => {
      let r = null;
      const { cuerpo, cerrar } = abrirModal({
        titulo: 'Código no registrado',
        clase: 'modal-chico',
        alCerrar: () => resolve(r),
        contenido: `
          <p class="codigo-grande">${esc(codigo)}</p>
          <p class="ayuda">Este código no está en tu inventario. ¿Qué quieres hacer?</p>
          <div class="opciones">
            <button type="button" class="btn primario" data-op="nuevo">${icono('mas')} Registrar producto nuevo</button>
            <button type="button" class="btn" data-op="ligar">${icono('etiqueta')} Es un producto que ya tengo</button>
            <button type="button" class="btn" data-op="suelto">${icono('billete')} Vender sin registrar</button>
          </div>`,
      });
      cuerpo.addEventListener('click', (e) => {
        const b = e.target.closest('[data-op]');
        if (b) {
          r = b.dataset.op;
          cerrar();
        }
      });
    });
    if (opcion === 'nuevo') {
      abrirFormularioProducto({ codigo, alGuardar: (p) => agregar(p) });
    } else if (opcion === 'ligar') {
      const p = await elegirProducto({ titulo: '¿Qué producto es?', ayuda: `Se le agregará el código ${codigo} para que la próxima vez se reconozca solo.` });
      if (p) {
        agregarCodigo(p, codigo);
        aviso(`Código guardado en «${p.nombre}»`);
        agregar(p);
      }
    } else if (opcion === 'suelto') {
      articuloSinRegistro();
    }
  }

  function buscarCodigo(codigo) {
    const p = buscarPorCodigo(codigo);
    if (p) agregar(p);
    else codigoDesconocido(codigo);
  }

  function articuloSinRegistro() {
    const { cuerpo, cerrar } = abrirModal({
      titulo: 'Artículo sin registro',
      clase: 'modal-chico',
      contenido: `
        <form class="formulario" novalidate>
          <label class="campo"><span>Descripción</span><input name="nombre" value="Varios" autocomplete="off" /></label>
          <div class="dos-columnas">
            <label class="campo"><span>Precio</span><div class="con-signo"><input name="precio" type="number" inputmode="decimal" step="any" min="0" /></div></label>
            <label class="campo"><span>Cantidad</span><input name="cantidad" type="number" inputmode="decimal" step="any" min="0" value="1" /></label>
          </div>
          <label class="campo"><span>Costo (opcional, para calcular la ganancia)</span><div class="con-signo"><input name="costo" type="number" inputmode="decimal" step="any" min="0" /></div></label>
          <div class="fila-botones">
            <button type="button" class="btn" data-cerrar>Cancelar</button>
            <button type="submit" class="btn primario">Agregar</button>
          </div>
        </form>`,
    });
    const form = cuerpo.querySelector('form');
    form.precio.focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const precio = leerNumero(form.precio.value);
      const cantidad = leerNumero(form.cantidad.value);
      if (!(precio > 0)) {
        avisoError('Escribe el precio.');
        form.precio.focus();
        return;
      }
      const costo = leerNumero(form.costo.value);
      const it = { id: null, nombre: form.nombre.value.trim() || 'Varios', precio: redondear(precio), costo: costo > 0 ? redondear(costo) : 0, unidad: 'pza' };
      ponerCantidad(it, cantidad > 0 ? cantidad : 1);
      carrito.unshift(it);
      guardarCarrito();
      pintarCarrito();
      cerrar();
    });
  }

  // ---------- Escanear con la cámara (varios productos seguidos) ----------

  async function escanear() {
    const codigo = await abrirEscaner({
      titulo: 'Escanea los productos',
      continuo: true,
      alLeer: (c) => {
        const p = buscarPorCodigo(c);
        if (!p || esGranel(p.unidad)) return false; // se atiende con la cámara cerrada
        const it = agregarAlCarrito(p, 1);
        pintarCarrito();
        return `${p.nombre} · ${dinero(p.precio)}  (×${cantidadTexto(it.cantidad, it.unidad)})`;
      },
      resumen: () => {
        const n = piezasCarrito();
        return `<span>Total</span><strong>${dinero(totalCarrito())}</strong><small>${n} artículo${n === 1 ? '' : 's'}</small>`;
      },
    });
    if (codigo) {
      const p = buscarPorCodigo(codigo);
      if (p) await agregar(p);
      else await codigoDesconocido(codigo);
    }
    enfocar();
  }

  // ---------- Cobrar ----------

  function cobrar() {
    if (!carrito.length) return;
    const total = totalCarrito();
    let pago = 'efectivo';
    const billetes = [20, 50, 100, 200, 500, 1000].filter((b) => b > total).slice(0, 3);

    const { cuerpo, cerrar } = abrirModal({
      titulo: 'Cobrar',
      clase: 'modal-cobro',
      contenido: `
        <div class="cobro-total"><span>Total a cobrar</span><strong>${dinero(total)}</strong></div>
        <div class="segmentado" role="radiogroup" aria-label="Forma de pago">
          <button type="button" class="activo" data-pago="efectivo" role="radio" aria-checked="true">Efectivo</button>
          <button type="button" data-pago="tarjeta" role="radio" aria-checked="false">Tarjeta</button>
          <button type="button" data-pago="transferencia" role="radio" aria-checked="false">Transferencia</button>
        </div>
        <form class="formulario" novalidate>
          <div data-efectivo>
            <label class="campo"><span>¿Con cuánto paga?</span>
              <div class="con-signo grande"><input name="recibido" type="number" inputmode="decimal" step="any" min="0" placeholder="${redondear(total)}" /></div>
            </label>
            <div class="chips">
              <button type="button" class="chip" data-billete="${total}">Exacto</button>
              ${billetes.map((b) => `<button type="button" class="chip" data-billete="${b}">$${b}</button>`).join('')}
            </div>
            <div class="cobro-cambio"><span>Cambio</span><strong data-cambio>$0.00</strong></div>
          </div>
          <div class="fila-botones">
            <button type="button" class="btn" data-cerrar>Regresar</button>
            <button type="submit" class="btn primario grande">${icono('check')} Confirmar venta</button>
          </div>
        </form>`,
    });

    const form = cuerpo.querySelector('form');
    const cajaEfectivo = cuerpo.querySelector('[data-efectivo]');
    const txtCambio = cuerpo.querySelector('[data-cambio]');

    const pintarCambio = () => {
      const r = leerNumero(form.recibido.value);
      if (!Number.isFinite(r)) {
        txtCambio.textContent = dinero(0);
        txtCambio.classList.remove('falta');
        return;
      }
      const cambio = redondear(r - total);
      txtCambio.textContent = cambio < 0 ? `Faltan ${dinero(-cambio)}` : dinero(cambio);
      txtCambio.classList.toggle('falta', cambio < 0);
    };
    form.recibido.addEventListener('input', pintarCambio);
    if (conMouse) form.recibido.focus();

    cuerpo.addEventListener('click', (e) => {
      const bp = e.target.closest('[data-pago]');
      if (bp) {
        pago = bp.dataset.pago;
        cuerpo.querySelectorAll('[data-pago]').forEach((b) => {
          b.classList.toggle('activo', b === bp);
          b.setAttribute('aria-checked', String(b === bp));
        });
        cajaEfectivo.hidden = pago !== 'efectivo';
      }
      const bb = e.target.closest('[data-billete]');
      if (bb) {
        form.recibido.value = bb.dataset.billete;
        pintarCambio();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const recibido = leerNumero(form.recibido.value);
      if (pago === 'efectivo' && Number.isFinite(recibido) && recibido < total) {
        avisoError(`Faltan ${dinero(total - recibido)} para completar el pago.`);
        return;
      }
      const venta = registrarVenta({ items: carrito, pago, recibido: pago === 'efectivo' ? recibido : NaN });
      carrito = [];
      guardarCarrito();
      pintarCarrito();
      cerrar();
      const cambio = venta.cambio > 0 ? ` · Cambio ${dinero(venta.cambio)}` : '';
      aviso(`Venta de ${dinero(venta.total)} guardada${cambio}`, 'ok', {
        ms: 7000,
        boton: 'Deshacer',
        alTocar: () => {
          cancelarVenta(venta);
          aviso('Venta cancelada y existencias regresadas', 'info');
        },
      });
      enfocar();
    });
  }

  // ---------- Eventos ----------

  vista.addEventListener('click', async (e) => {
    const sug = e.target.closest('[data-sugerencia]');
    if (sug) {
      const p = estado.porId.get(sug.dataset.sugerencia);
      input.value = '';
      pintarSugerencias();
      if (p) await agregar(p);
      enfocar();
      return;
    }
    const rap = e.target.closest('[data-rapido]');
    if (rap) {
      const p = estado.porId.get(rap.dataset.rapido);
      if (p) await agregar(p);
      return;
    }
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    const li = e.target.closest('.item');
    const it = li ? carrito[Number(li.dataset.i)] : null;
    switch (accion) {
      case 'escanear':
        escanear();
        break;
      case 'varios':
        articuloSinRegistro();
        break;
      case 'vaciar':
        if (await confirmar('Se quitarán todos los productos de la cuenta actual.', { titulo: '¿Vaciar la cuenta?', si: 'Vaciar', peligro: true })) {
          carrito = [];
          guardarCarrito();
          pintarCarrito();
        }
        break;
      case 'mas':
        ponerCantidad(it, it.cantidad + 1);
        guardarCarrito();
        pintarCarrito();
        break;
      case 'menos':
        if (it.cantidad <= 1) carrito.splice(carrito.indexOf(it), 1);
        else ponerCantidad(it, it.cantidad - 1);
        guardarCarrito();
        pintarCarrito();
        break;
      case 'quitar':
        carrito.splice(carrito.indexOf(it), 1);
        guardarCarrito();
        pintarCarrito();
        break;
      case 'cantidad': {
        const p = it.id ? estado.porId.get(it.id) : null;
        let nueva;
        if (esGranel(it.unidad)) {
          nueva = await pedirCantidadGranel(p ?? it, it.cantidad);
        } else {
          nueva = leerNumero(await pedirDato({ titulo: it.nombre, etiqueta: 'Cantidad', valor: it.cantidad, tipo: 'number', boton: 'Cambiar' }));
        }
        if (Number.isFinite(nueva) && nueva > 0) {
          ponerCantidad(it, nueva);
          guardarCarrito();
          pintarCarrito();
        } else if (nueva === 0) {
          carrito.splice(carrito.indexOf(it), 1);
          guardarCarrito();
          pintarCarrito();
        }
        break;
      }
      default:
        break;
    }
  });

  btnCobrar.addEventListener('click', cobrar);

  input.addEventListener('input', debounce(pintarSugerencias, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = input.value.trim();
    if (!t) {
      if (carrito.length) cobrar();
      return;
    }
    input.value = '';
    sugerencias.hidden = true;
    const porCodigo = buscarPorCodigo(t);
    if (porCodigo) {
      agregar(porCodigo);
      return;
    }
    // Solo números y largo: es un código de barras que no está registrado.
    if (/^\d{6,}$/.test(t)) {
      codigoDesconocido(t);
      return;
    }
    const res = buscarProductos(t, 2);
    if (res.length === 1) {
      agregar(res[0]);
      return;
    }
    // Varios parecidos: que la persona elija de la lista.
    input.value = t;
    pintarSugerencias();
  });

  // Lectores de código USB/Bluetooth: "escriben" el código muy rápido y dan Enter.
  let bufer = '';
  let ultimaTecla = 0;
  const teclado = (e) => {
    if (document.querySelector('dialog[open], .escaner')) return;
    const enCampo = e.target.closest?.('input, textarea, select');
    if (enCampo) return;
    const ahora = Date.now();
    if (ahora - ultimaTecla > 80) bufer = '';
    ultimaTecla = ahora;
    if (e.key === 'Enter' && bufer.length >= 6) {
      e.preventDefault();
      buscarCodigo(bufer);
      bufer = '';
    } else if (/^[0-9A-Za-z-]$/.test(e.key)) {
      bufer += e.key;
    }
  };
  window.addEventListener('keydown', teclado);

  const quitarOyente = escuchar('productos', () => {
    pintarRapidos();
    pintarCarrito();
    if (!sugerencias.hidden) pintarSugerencias();
  });

  pintarRapidos();
  pintarCarrito();
  enfocar();

  return () => {
    window.removeEventListener('keydown', teclado);
    quitarOyente();
  };
}
