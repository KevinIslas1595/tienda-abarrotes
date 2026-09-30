// Estado compartido por todas las pantallas: la tienda, sus productos y avisos de cambios.
import { normalizar } from './util.js';

export const CATEGORIAS_BASE = [
  'Refrescos y bebidas',
  'Lácteos y huevo',
  'Salchichonería',
  'Pan y pastelitos',
  'Galletas',
  'Botanas',
  'Dulces y chocolates',
  'Abarrotes',
  'Enlatados y salsas',
  'Limpieza',
  'Higiene personal',
  'Cervezas',
  'Otros',
];

export const estado = {
  usuario: null,
  tienda: { nombre: 'Mi Tienda', categorias: [...CATEGORIAS_BASE] },
  productos: [],
  porId: new Map(),
  porCodigo: new Map(),
  productosListos: false,
};

// ---------- Eventos: una pantalla avisa, las demás se enteran ----------

const oyentes = {};

export function escuchar(evento, fn) {
  (oyentes[evento] ??= new Set()).add(fn);
  return () => oyentes[evento].delete(fn);
}

export function emitir(evento, dato) {
  oyentes[evento]?.forEach((fn) => {
    try {
      fn(dato);
    } catch (e) {
      console.error(e);
    }
  });
}

// ---------- Productos ----------

export function ponerProductos(lista) {
  estado.porId = new Map();
  estado.porCodigo = new Map();
  for (const p of lista) {
    p._nombre = normalizar(p.nombre);
    p._busqueda = normalizar(`${p.nombre} ${p.categoria ?? ''} ${(p.codigos ?? []).join(' ')}`);
    estado.porId.set(p.id, p);
    for (const c of p.codigos ?? []) estado.porCodigo.set(String(c), p);
  }
  estado.productos = lista;
  estado.productosListos = true;
  emitir('productos');
}

export function ponerTienda(datos) {
  estado.tienda = { nombre: 'Mi Tienda', categorias: [...CATEGORIAS_BASE], ...(datos ?? {}) };
  emitir('tienda');
}

// Un mismo producto a veces se lee con o sin el 0 del principio (UPC-A / EAN-13).
export function variantesCodigo(codigo) {
  const c = String(codigo ?? '').trim();
  const lista = [c];
  if (/^\d{12}$/.test(c)) lista.push('0' + c);
  if (/^0\d{12}$/.test(c)) lista.push(c.slice(1));
  return lista;
}

export function buscarPorCodigo(codigo) {
  for (const v of variantesCodigo(codigo)) {
    const p = estado.porCodigo.get(v);
    if (p) return p;
  }
  return null;
}

// Búsqueda por nombre, categoría o código; sin importar acentos ni mayúsculas.
export function buscarProductos(texto, max = 40) {
  const t = normalizar(texto);
  if (!t) return [];
  const palabras = t.split(/\s+/);
  const encontrados = estado.productos.filter((p) => palabras.every((w) => p._busqueda.includes(w)));
  encontrados.sort((a, b) => Number(!a._nombre.startsWith(t)) - Number(!b._nombre.startsWith(t)));
  return encontrados.slice(0, max);
}

// Categorías guardadas + las que usen los productos (por si se escribió una nueva).
export function categorias() {
  const lista = [...(estado.tienda.categorias ?? [])];
  for (const p of estado.productos) {
    if (p.categoria && !lista.includes(p.categoria)) lista.push(p.categoria);
  }
  return lista;
}

export const existenciaBaja = (p) => (Number(p.stock) || 0) <= (Number(p.minimo) || 0);
export const agotado = (p) => (Number(p.stock) || 0) <= 0;
