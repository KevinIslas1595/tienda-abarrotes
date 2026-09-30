// Todo lo que se lee y se guarda en la base de datos (Firestore).
//
// Estructura (cada cuenta tiene su propia tienda):
//   tiendas/{uid}                  nombre de la tienda y categorías
//   tiendas/{uid}/productos/{id}   nombre, códigos, costo, precio, existencia…
//   tiendas/{uid}/ventas/{id}      cada cobro con sus artículos
//   tiendas/{uid}/dias/{AAAA-MM-DD} totales del día (para reportes rápidos)
//   tiendas/{uid}/movimientos/{id} entradas de mercancía y ajustes de existencia
//
// Las escrituras NO se esperan: Firestore las aplica al instante en el
// teléfono y las sube cuando hay internet. Así la app nunca se "congela"
// si se va la señal.
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  setDoc,
  deleteDoc,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { redondear, diaISO, horaHM, avisoError, traducirError } from './util.js';
import { emitir } from './estado.js';

let base = null;
export const usarTienda = (uid) => {
  base = `tiendas/${uid}`;
};

const col = (nombre) => collection(db, base, nombre);
const ref = (nombre, id) => doc(db, base, nombre, id);
const refTienda = () => doc(db, base);

// ---------- Cambios pendientes de subir ----------

let pendientes = 0;
export const hayPendientes = () => pendientes > 0;

function enviar(promesa, mensaje = 'No se pudo guardar') {
  pendientes++;
  emitir('pendientes', pendientes);
  promesa
    .catch((e) => {
      console.error(e);
      avisoError(`${mensaje}: ${traducirError(e)}`);
    })
    .finally(() => {
      pendientes--;
      emitir('pendientes', pendientes);
    });
  return promesa;
}

function errorAlLeer(e) {
  console.error(e);
  avisoError(`No se pudieron leer los datos: ${traducirError(e)}`);
}

// Firestore permite 500 cambios por lote; se parten en lotes de 400.
function enLotes(operaciones, mensaje) {
  const promesas = [];
  for (let i = 0; i < operaciones.length; i += 400) {
    const lote = writeBatch(db);
    for (const op of operaciones.slice(i, i + 400)) op(lote);
    promesas.push(enviar(lote.commit(), mensaje));
  }
  return Promise.allSettled(promesas);
}

// ---------- Tienda ----------

export function escucharTienda(cb) {
  return onSnapshot(
    refTienda(),
    { includeMetadataChanges: true },
    (d) => cb(d.exists() ? d.data() : null, d.metadata.fromCache),
    errorAlLeer,
  );
}

export const guardarTienda = (datos) => enviar(setDoc(refTienda(), datos, { merge: true }));

export const agregarCategoria = (nombre) =>
  enviar(setDoc(refTienda(), { categorias: arrayUnion(nombre) }, { merge: true }));

// ---------- Productos ----------

const CAMPOS_PRODUCTO = ['nombre', 'codigos', 'categoria', 'unidad', 'costo', 'precio', 'stock', 'minimo', 'favorito'];

function limpiarProducto(p) {
  const limpio = {};
  for (const k of CAMPOS_PRODUCTO) if (p[k] !== undefined) limpio[k] = p[k];
  return limpio;
}

export function escucharProductos(cb) {
  return onSnapshot(
    col('productos'),
    (snap) => {
      const lista = [];
      snap.forEach((d) => {
        const p = d.data();
        // Un documento sin nombre es un resto de un producto borrado: se ignora.
        if (p.nombre) lista.push({ ...p, id: d.id, codigos: p.codigos ?? [] });
      });
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      cb(lista);
    },
    errorAlLeer,
  );
}

export const nuevoIdProducto = () => doc(col('productos')).id;

// Guarda un producto nuevo o editado. La existencia solo se escribe si la
// persona la cambió (así no se pisa una venta hecha en otro teléfono).
export function guardarProducto(p, { existenciaAnterior } = {}) {
  const id = p.id || nuevoIdProducto();
  const datos = limpiarProducto(p);
  const lote = writeBatch(db);
  const esNuevo = !p.id;
  const cambioExistencia = !esNuevo && existenciaAnterior !== undefined && datos.stock !== existenciaAnterior;
  if (!esNuevo && !cambioExistencia) delete datos.stock;
  lote.set(ref('productos', id), { ...datos, actualizado: Date.now() }, { merge: true });
  if (esNuevo && datos.stock) {
    lote.set(doc(col('movimientos')), movimiento('alta', { id, ...datos }, datos.stock, { antes: 0, despues: datos.stock }));
  }
  if (cambioExistencia) {
    lote.set(
      doc(col('movimientos')),
      movimiento('ajuste', { id, ...datos }, redondear(datos.stock - (existenciaAnterior || 0), 3), {
        antes: existenciaAnterior || 0,
        despues: datos.stock,
      }),
    );
  }
  enviar(lote.commit(), 'No se pudo guardar el producto');
  return id;
}

export const borrarProducto = (p) => enviar(deleteDoc(ref('productos', p.id)), 'No se pudo borrar el producto');

export function agregarCodigo(p, codigo) {
  enviar(setDoc(ref('productos', p.id), { codigos: arrayUnion(String(codigo)) }, { merge: true }));
}

// Guarda muchos productos de un jalón (catálogo inicial, importar de Excel, cambio de precios).
export function guardarProductos(lista) {
  const ops = lista.map((p) => (lote) => {
    const id = p.id || nuevoIdProducto();
    lote.set(ref('productos', id), { ...limpiarProducto(p), actualizado: Date.now() }, { merge: true });
  });
  return enLotes(ops, 'No se pudieron guardar los productos');
}

export function cambiarCategoriaDe(productos, categoria) {
  return enLotes(
    productos.map((p) => (lote) => lote.set(ref('productos', p.id), { categoria }, { merge: true })),
    'No se pudo cambiar la categoría',
  );
}

// ---------- Ventas ----------

// Totales que se suman (o restan, al cancelar) en el resumen del día.
function sumasDelDia(v, signo) {
  const inc = (n) => increment(redondear(signo * n, 3));
  const vendidos = {};
  for (const it of v.items) {
    const clave = it.id || 'varios';
    const a = (vendidos[clave] ??= { nombre: it.id ? it.nombre : 'Artículos sin registro', cantidad: 0, total: 0, costo: 0 });
    a.cantidad += it.cantidad;
    a.total += it.subtotal;
    a.costo += it.costo * it.cantidad;
  }
  const r = {
    dia: v.dia,
    ventas: increment(signo),
    total: inc(v.total),
    costo: inc(v.costo),
    porPago: { [v.pago]: inc(v.total) },
    vendidos: {},
  };
  for (const [clave, a] of Object.entries(vendidos)) {
    r.vendidos[clave] = { nombre: a.nombre, cantidad: inc(a.cantidad), total: inc(a.total), costo: inc(a.costo) };
  }
  if (signo < 0) r.canceladas = increment(1);
  return r;
}

export function registrarVenta({ items, pago = 'efectivo', recibido }) {
  const ahora = new Date();
  const total = redondear(items.reduce((s, it) => s + it.subtotal, 0));
  const costo = redondear(items.reduce((s, it) => s + it.costo * it.cantidad, 0));
  const pagoCon = pago === 'efectivo' && Number.isFinite(recibido) && recibido >= total ? redondear(recibido) : total;
  const venta = {
    ts: ahora.getTime(),
    dia: diaISO(ahora),
    hora: horaHM(ahora),
    items: items.map((it) => ({
      id: it.id ?? null,
      nombre: it.nombre,
      cantidad: it.cantidad,
      unidad: it.unidad ?? 'pza',
      precio: it.precio,
      costo: it.costo ?? 0,
      subtotal: it.subtotal,
    })),
    total,
    costo,
    ganancia: redondear(total - costo),
    pago,
    recibido: pagoCon,
    cambio: redondear(pagoCon - total),
    estado: 'ok',
  };
  const vref = doc(col('ventas'));
  const lote = writeBatch(db);
  lote.set(vref, venta);
  for (const it of venta.items) {
    // set+merge en vez de update: si el producto se borró en otro teléfono, la venta no se pierde.
    if (it.id) lote.set(ref('productos', it.id), { stock: increment(-it.cantidad) }, { merge: true });
  }
  lote.set(ref('dias', venta.dia), sumasDelDia(venta, 1), { merge: true });
  enviar(lote.commit(), 'No se pudo guardar la venta');
  return { id: vref.id, ...venta };
}

export function cancelarVenta(v) {
  if (v.estado === 'cancelada') return;
  const lote = writeBatch(db);
  lote.set(ref('ventas', v.id), { estado: 'cancelada', canceladaTs: Date.now() }, { merge: true });
  for (const it of v.items) {
    if (it.id) lote.set(ref('productos', it.id), { stock: increment(it.cantidad) }, { merge: true });
  }
  lote.set(ref('dias', v.dia), sumasDelDia(v, -1), { merge: true });
  enviar(lote.commit(), 'No se pudo cancelar la venta');
}

export function escucharVentasDia(dia, cb) {
  return onSnapshot(
    query(col('ventas'), where('dia', '==', dia)),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => b.ts - a.ts)),
    errorAlLeer,
  );
}

export function escucharDias(desde, hasta, cb) {
  return onSnapshot(
    query(col('dias'), where('dia', '>=', desde), where('dia', '<=', hasta)),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    errorAlLeer,
  );
}

export const guardarFondo = (dia, fondo) => enviar(setDoc(ref('dias', dia), { dia, fondo }, { merge: true }));

// ---------- Inventario: entradas y ajustes ----------

function movimiento(tipo, p, cantidad, extra = {}) {
  const ahora = new Date();
  return {
    ts: ahora.getTime(),
    dia: diaISO(ahora),
    tipo,
    productoId: p.id,
    nombre: p.nombre,
    unidad: p.unidad ?? 'pza',
    cantidad,
    ...extra,
  };
}

// Llegó mercancía: suma existencia y, si cambió, actualiza costo y precio.
export function registrarEntrada({ producto, cantidad, costo, precio, nota = '' }) {
  const lote = writeBatch(db);
  const cambios = { stock: increment(cantidad), actualizado: Date.now() };
  if (Number.isFinite(costo)) cambios.costo = costo;
  if (Number.isFinite(precio)) cambios.precio = precio;
  lote.set(ref('productos', producto.id), cambios, { merge: true });
  lote.set(
    doc(col('movimientos')),
    movimiento('entrada', producto, cantidad, {
      costo: Number.isFinite(costo) ? costo : producto.costo ?? 0,
      total: redondear(cantidad * (Number.isFinite(costo) ? costo : producto.costo ?? 0)),
      nota,
    }),
  );
  enviar(lote.commit(), 'No se pudo registrar la entrada');
}

// Conteo físico: la existencia pasa a ser lo que se contó.
export function ajustarExistencia(producto, nueva, nota = 'Conteo') {
  const antes = Number(producto.stock) || 0;
  if (redondear(nueva, 3) === redondear(antes, 3)) return;
  const lote = writeBatch(db);
  lote.set(ref('productos', producto.id), { stock: nueva, actualizado: Date.now() }, { merge: true });
  lote.set(doc(col('movimientos')), movimiento('ajuste', producto, redondear(nueva - antes, 3), { antes, despues: nueva, nota }));
  enviar(lote.commit(), 'No se pudo guardar la existencia');
}

export function escucharMovimientos(cuantos, cb) {
  return onSnapshot(
    query(col('movimientos'), orderBy('ts', 'desc'), limit(cuantos)),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    errorAlLeer,
  );
}
