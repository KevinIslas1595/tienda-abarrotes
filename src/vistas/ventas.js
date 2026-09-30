// Pantalla "Ventas": corte del día, ventas hechas, lo más vendido y resumen por días.
import {
  esc,
  dinero,
  numero,
  redondear,
  leerNumero,
  cantidadTexto,
  diaISO,
  sumarDias,
  fechaLarga,
  fechaCorta,
  abrirModal,
  confirmar,
  pedirDato,
  aviso,
  aCSV,
  descargar,
} from '../util.js';
import { icono } from '../iconos.js';
import { escucharVentasDia, escucharDias, cancelarVenta, guardarFondo } from '../datos.js';

const NOMBRE_PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

let diaElegido = null; // se recuerda mientras la app esté abierta
let rangoElegido = '7';

function resumirVentas(ventas) {
  const r = { total: 0, costo: 0, n: 0, canceladas: 0, porPago: { efectivo: 0, tarjeta: 0, transferencia: 0 }, productos: new Map() };
  for (const v of ventas) {
    if (v.estado === 'cancelada') {
      r.canceladas++;
      continue;
    }
    r.n++;
    r.total += v.total;
    r.costo += v.costo;
    r.porPago[v.pago] = (r.porPago[v.pago] ?? 0) + v.total;
    for (const it of v.items) {
      const clave = it.id || `suelto:${it.nombre}`;
      const a = r.productos.get(clave) ?? { nombre: it.nombre, unidad: it.unidad, cantidad: 0, total: 0, ganancia: 0 };
      a.cantidad += it.cantidad;
      a.total += it.subtotal;
      a.ganancia += it.subtotal - it.costo * it.cantidad;
      r.productos.set(clave, a);
    }
  }
  r.total = redondear(r.total);
  r.costo = redondear(r.costo);
  return r;
}

function limitesRango(rango, hoy) {
  if (rango === 'mes') return [`${hoy.slice(0, 8)}01`, hoy];
  return [sumarDias(hoy, -(Number(rango) - 1)), hoy];
}

export function montar(contenedor) {
  const hoy = diaISO();
  diaElegido ??= hoy;

  contenedor.innerHTML = `
    <section class="vista vista-ventas">
      <div class="navegar-dia">
        <button type="button" class="btn-icono" data-accion="dia-ant" aria-label="Día anterior">${icono('izq')}</button>
        <label class="fecha">
          <strong data-titulo-dia></strong>
          <input type="date" name="dia" aria-label="Elegir día" />
        </label>
        <button type="button" class="btn-icono" data-accion="dia-sig" aria-label="Día siguiente">${icono('der')}</button>
      </div>
      <div class="tarjetas-resumen tres" data-tarjetas></div>
      <div class="panel" data-corte></div>
      <div class="panel">
        <h3>Productos vendidos</h3>
        <div data-productos></div>
      </div>
      <div class="panel">
        <h3>Ventas del día</h3>
        <ul class="lista-ventas" data-ventas></ul>
      </div>
      <div class="panel">
        <div class="panel-cabeza">
          <h3>Resumen por días</h3>
          <div class="segmentado chico" role="radiogroup" aria-label="Periodo">
            <button type="button" data-rango="7">7 días</button>
            <button type="button" data-rango="30">30 días</button>
            <button type="button" data-rango="mes">Este mes</button>
          </div>
        </div>
        <div data-rango-contenido></div>
      </div>
      <div class="botones-exportar">
        <button type="button" class="btn" data-accion="csv-dia">${icono('descargar')} Ventas del día (Excel)</button>
        <button type="button" class="btn" data-accion="csv-rango">${icono('descargar')} Resumen por días (Excel)</button>
      </div>
    </section>`;

  const vista = contenedor.querySelector('.vista-ventas');
  const inputDia = vista.querySelector('[name="dia"]');
  const tituloDia = vista.querySelector('[data-titulo-dia]');
  const cajaTarjetas = vista.querySelector('[data-tarjetas]');
  const cajaCorte = vista.querySelector('[data-corte]');
  const cajaProductos = vista.querySelector('[data-productos]');
  const cajaVentas = vista.querySelector('[data-ventas]');
  const cajaRango = vista.querySelector('[data-rango-contenido]');

  let ventas = [];
  let docDia = null;
  let dias = [];
  let quitarVentas = () => {};
  let quitarDocDia = () => {};
  let quitarRango = () => {};

  // ---------- Día ----------

  function pintarDia() {
    const r = resumirVentas(ventas);
    const ganancia = redondear(r.total - r.costo);
    cajaTarjetas.innerHTML = `
      <div class="tarjeta destacada"><span>Vendido</span><strong>${dinero(r.total)}</strong></div>
      <div class="tarjeta"><span>Ganancia</span><strong>${dinero(ganancia)}</strong><small>costo ${dinero(r.costo)}</small></div>
      <div class="tarjeta"><span>Ventas</span><strong>${numero(r.n, 0)}</strong><small>${r.n ? `promedio ${dinero(r.total / r.n)}` : '&nbsp;'}</small></div>`;

    const fondo = Number(docDia?.fondo) || 0;
    const efectivo = redondear(r.porPago.efectivo ?? 0);
    cajaCorte.innerHTML = `
      <h3>Corte de caja</h3>
      <div class="filas-corte">
        <div><span>Efectivo</span><strong>${dinero(efectivo)}</strong></div>
        <div><span>Tarjeta</span><strong>${dinero(r.porPago.tarjeta ?? 0)}</strong></div>
        <div><span>Transferencia</span><strong>${dinero(r.porPago.transferencia ?? 0)}</strong></div>
        <div class="con-boton"><span>Fondo con el que abriste la caja</span>
          <button type="button" class="btn-texto" data-accion="fondo">${dinero(fondo)} ${icono('editar')}</button></div>
        <div class="esperado"><span>Debe haber en caja</span><strong>${dinero(fondo + efectivo)}</strong></div>
      </div>
      ${r.canceladas ? `<p class="ayuda">${r.canceladas} venta${r.canceladas === 1 ? '' : 's'} cancelada${r.canceladas === 1 ? '' : 's'} (no cuentan).</p>` : ''}`;

    const productos = [...r.productos.values()].sort((a, b) => b.total - a.total);
    cajaProductos.innerHTML = productos.length
      ? `<table class="tabla">
          <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Vendido</th><th class="num">Ganancia</th></tr></thead>
          <tbody>${productos
            .map(
              (a) => `<tr><td>${esc(a.nombre)}</td><td class="num">${cantidadTexto(a.cantidad, a.unidad)}</td><td class="num">${dinero(a.total)}</td><td class="num">${dinero(a.ganancia)}</td></tr>`,
            )
            .join('')}</tbody>
        </table>`
      : '<p class="vacio">Sin ventas este día.</p>';

    cajaVentas.innerHTML = ventas.length
      ? ventas
          .map((v) => {
            const piezas = v.items.reduce((s, it) => s + (it.unidad === 'pza' ? it.cantidad : 1), 0);
            const primeros = v.items.slice(0, 2).map((it) => it.nombre).join(', ');
            return `
            <li><button type="button" class="venta ${v.estado === 'cancelada' ? 'cancelada' : ''}" data-venta="${esc(v.id)}">
              <span class="hora">${esc(v.hora)}</span>
              <span class="detalle">${esc(primeros)}${v.items.length > 2 ? ` y ${v.items.length - 2} más` : ''}<small>${numero(piezas, 0)} art. · ${NOMBRE_PAGO[v.pago] ?? v.pago}${v.estado === 'cancelada' ? ' · CANCELADA' : ''}</small></span>
              <strong>${dinero(v.total)}</strong>
            </button></li>`;
          })
          .join('')
      : '<li class="vacio">Todavía no hay ventas este día.</li>';
  }

  function cambiarDia(nuevo) {
    diaElegido = nuevo > hoy ? hoy : nuevo;
    inputDia.value = diaElegido;
    inputDia.max = hoy;
    const nombre = fechaLarga(diaElegido);
    tituloDia.textContent = diaElegido === hoy ? `Hoy · ${nombre}` : diaElegido === sumarDias(hoy, -1) ? `Ayer · ${nombre}` : nombre;
    vista.querySelector('[data-accion="dia-sig"]').disabled = diaElegido >= hoy;
    quitarVentas();
    quitarDocDia();
    ventas = [];
    docDia = null;
    pintarDia();
    quitarVentas = escucharVentasDia(diaElegido, (lista) => {
      ventas = lista;
      pintarDia();
    });
    quitarDocDia = escucharDias(diaElegido, diaElegido, (docs) => {
      docDia = docs[0] ?? null;
      pintarDia();
    });
  }

  // ---------- Rango de días ----------

  function pintarRango() {
    vista.querySelectorAll('[data-rango]').forEach((b) => b.classList.toggle('activo', b.dataset.rango === rangoElegido));
    const [desde, hasta] = limitesRango(rangoElegido, hoy);
    const porDia = new Map(dias.map((d) => [d.dia, d]));
    const filas = [];
    for (let d = hasta; d >= desde; d = sumarDias(d, -1)) {
      const x = porDia.get(d);
      filas.push({ dia: d, total: redondear(x?.total ?? 0), costo: redondear(x?.costo ?? 0), ventas: Math.round(x?.ventas ?? 0) });
    }
    const max = Math.max(1, ...filas.map((f) => f.total));
    const tot = filas.reduce((a, f) => ({ total: a.total + f.total, costo: a.costo + f.costo, ventas: a.ventas + f.ventas }), { total: 0, costo: 0, ventas: 0 });

    const vendidos = new Map();
    for (const d of dias) {
      for (const [clave, a] of Object.entries(d.vendidos ?? {})) {
        const x = vendidos.get(clave) ?? { nombre: a.nombre, cantidad: 0, total: 0, ganancia: 0 };
        x.cantidad += a.cantidad ?? 0;
        x.total += a.total ?? 0;
        x.ganancia += (a.total ?? 0) - (a.costo ?? 0);
        vendidos.set(clave, x);
      }
    }
    const top = [...vendidos.values()].filter((x) => x.total > 0.001).sort((a, b) => b.total - a.total).slice(0, 10);

    cajaRango.innerHTML = `
      <div class="tarjetas-resumen chicas tres">
        <div class="tarjeta"><span>Vendido</span><strong>${dinero(tot.total)}</strong></div>
        <div class="tarjeta"><span>Ganancia</span><strong>${dinero(tot.total - tot.costo)}</strong></div>
        <div class="tarjeta"><span>Ventas</span><strong>${numero(tot.ventas, 0)}</strong></div>
      </div>
      <ul class="barras">
        ${filas
          .map(
            (f) => `
          <li><button type="button" data-ir-dia="${f.dia}" class="${f.dia === diaElegido ? 'elegido' : ''}">
            <span class="barra-dia">${esc(fechaCorta(f.dia))}</span>
            <span class="barra-fondo"><span class="barra" style="width:${((f.total / max) * 100).toFixed(1)}%"></span></span>
            <span class="barra-valor">${dinero(f.total)}</span>
          </button></li>`,
          )
          .join('')}
      </ul>
      <h4>Lo más vendido del periodo</h4>
      ${
        top.length
          ? `<table class="tabla"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Vendido</th><th class="num">Ganancia</th></tr></thead>
            <tbody>${top.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${numero(x.cantidad, 3)}</td><td class="num">${dinero(x.total)}</td><td class="num">${dinero(x.ganancia)}</td></tr>`).join('')}</tbody></table>`
          : '<p class="vacio">Sin ventas en este periodo.</p>'
      }`;
  }

  function cambiarRango(r) {
    rangoElegido = r;
    quitarRango();
    dias = [];
    pintarRango();
    const [desde, hasta] = limitesRango(rangoElegido, hoy);
    quitarRango = escucharDias(desde, hasta, (docs) => {
      dias = docs;
      pintarRango();
    });
  }

  // ---------- Detalle de una venta ----------

  function verVenta(v) {
    const { cuerpo, cerrar } = abrirModal({
      titulo: `Venta de las ${v.hora}`,
      contenido: `
        ${v.estado === 'cancelada' ? `<p class="etiqueta-cancelada">${icono('alerta')} Venta cancelada: no cuenta en el corte.</p>` : ''}
        <table class="tabla">
          <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
          <tbody>${v.items
            .map(
              (it) => `<tr><td>${esc(it.nombre)}</td><td class="num">${cantidadTexto(it.cantidad, it.unidad)}</td><td class="num">${dinero(it.precio)}</td><td class="num">${dinero(it.subtotal)}</td></tr>`,
            )
            .join('')}</tbody>
        </table>
        <div class="filas-corte">
          <div class="esperado"><span>Total</span><strong>${dinero(v.total)}</strong></div>
          <div><span>Forma de pago</span><strong>${NOMBRE_PAGO[v.pago] ?? esc(v.pago)}</strong></div>
          ${v.pago === 'efectivo' ? `<div><span>Pagó con</span><strong>${dinero(v.recibido)}</strong></div><div><span>Cambio</span><strong>${dinero(v.cambio)}</strong></div>` : ''}
          <div><span>Ganancia</span><strong>${dinero(v.ganancia)}</strong></div>
        </div>
        <div class="fila-botones">
          ${v.estado !== 'cancelada' ? `<button type="button" class="btn peligro-texto" data-accion="cancelar-venta">${icono('deshacer')} Cancelar venta</button>` : ''}
          <span class="espacio"></span>
          <button type="button" class="btn" data-cerrar>Cerrar</button>
        </div>`,
    });
    cuerpo.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-accion="cancelar-venta"]')) return;
      const ok = await confirmar('La venta dejará de contar en el corte y los productos regresarán al inventario.', {
        titulo: '¿Cancelar esta venta?',
        si: 'Sí, cancelar venta',
        no: 'No',
        peligro: true,
      });
      if (ok) {
        cancelarVenta(v);
        aviso('Venta cancelada y existencias regresadas', 'info');
        cerrar();
      }
    });
  }

  // ---------- Exportar a Excel ----------

  function csvDia() {
    const filas = [['Fecha', 'Hora', 'Venta', 'Producto', 'Cantidad', 'Unidad', 'Precio', 'Importe', 'Costo', 'Ganancia', 'Forma de pago', 'Estado']];
    for (const v of [...ventas].reverse()) {
      for (const it of v.items) {
        filas.push([
          v.dia,
          v.hora,
          v.id.slice(-6).toUpperCase(),
          it.nombre,
          it.cantidad,
          it.unidad,
          it.precio,
          it.subtotal,
          redondear(it.costo * it.cantidad),
          redondear(it.subtotal - it.costo * it.cantidad),
          NOMBRE_PAGO[v.pago] ?? v.pago,
          v.estado === 'cancelada' ? 'Cancelada' : 'OK',
        ]);
      }
    }
    if (filas.length === 1) {
      aviso('No hay ventas ese día.', 'info');
      return;
    }
    descargar(`ventas-${diaElegido}.csv`, aCSV(filas));
  }

  function csvRango() {
    const [desde, hasta] = limitesRango(rangoElegido, hoy);
    const filas = [['Día', 'Ventas', 'Vendido', 'Costo', 'Ganancia', 'Efectivo', 'Tarjeta', 'Transferencia']];
    for (const d of [...dias].sort((a, b) => a.dia.localeCompare(b.dia))) {
      filas.push([
        d.dia,
        Math.round(d.ventas ?? 0),
        redondear(d.total ?? 0),
        redondear(d.costo ?? 0),
        redondear((d.total ?? 0) - (d.costo ?? 0)),
        redondear(d.porPago?.efectivo ?? 0),
        redondear(d.porPago?.tarjeta ?? 0),
        redondear(d.porPago?.transferencia ?? 0),
      ]);
    }
    descargar(`resumen-${desde}-a-${hasta}.csv`, aCSV(filas));
  }

  // ---------- Eventos ----------

  inputDia.addEventListener('change', () => {
    if (inputDia.value) cambiarDia(inputDia.value);
  });

  vista.addEventListener('click', async (e) => {
    const bv = e.target.closest('[data-venta]');
    if (bv) {
      const v = ventas.find((x) => x.id === bv.dataset.venta);
      if (v) verVenta(v);
      return;
    }
    const br = e.target.closest('[data-rango]');
    if (br) {
      cambiarRango(br.dataset.rango);
      return;
    }
    const bd = e.target.closest('[data-ir-dia]');
    if (bd) {
      cambiarDia(bd.dataset.irDia);
      pintarRango();
      vista.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'dia-ant') cambiarDia(sumarDias(diaElegido, -1));
    if (accion === 'dia-sig') cambiarDia(sumarDias(diaElegido, 1));
    if (accion === 'csv-dia') csvDia();
    if (accion === 'csv-rango') csvRango();
    if (accion === 'fondo') {
      const valor = await pedirDato({
        titulo: 'Fondo de caja',
        etiqueta: '¿Con cuánto efectivo abriste la caja?',
        valor: Number(docDia?.fondo) || '',
        tipo: 'number',
        boton: 'Guardar',
      });
      if (valor === null) return;
      const n = leerNumero(valor);
      guardarFondo(diaElegido, Number.isFinite(n) && n > 0 ? redondear(n) : 0);
    }
  });

  cambiarDia(diaElegido);
  cambiarRango(rangoElegido);

  return () => {
    quitarVentas();
    quitarDocDia();
    quitarRango();
  };
}
