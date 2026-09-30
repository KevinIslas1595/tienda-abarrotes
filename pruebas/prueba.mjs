// Prueba de punta a punta de la app contra el emulador de Firebase.
// Necesita (una vez): npm i --no-save playwright && npx playwright install chromium
// Con el emulador y "npm run dev:emulador" corriendo:  node pruebas/prueba.mjs
// Las capturas quedan en la carpeta capturas/ (no se sube a GitHub).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIRECCION = process.env.DIRECCION || 'http://127.0.0.1:5173/';
const DIR = dirname(fileURLToPath(import.meta.url));
const CAPTURAS = join(DIR, '..', 'capturas');
mkdirSync(CAPTURAS, { recursive: true });

const CORREO = `prueba${Date.now()}@tienda.mx`;
const CLAVE = 'prueba123';
const resultados = [];
const errores = [];

function ok(nombre, condicion, detalle = '') {
  resultados.push(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  if (!condicion) console.log('FALLA:', nombre, detalle);
}

async function paso(nombre, fn) {
  try {
    await fn();
  } catch (e) {
    ok(nombre, false, e.message.split('\n')[0]);
  }
}

const navegador = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-MX',
  timezoneId: 'America/Mexico_City',
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errores.push(`[pageerror] ${e.message}`));
page.on('response', (r) => r.status() >= 400 && errores.push(`[http ${r.status()}] ${r.url().slice(0, 120)}`));

const captura = (nombre) => page.screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
const dialogo = () => page.locator('dialog[open]').last();
const aviso = (texto) => page.locator('#avisos .aviso', { hasText: texto });
const irA = async (ruta) => {
  await page.evaluate((r) => (location.hash = r), `#/${ruta}`);
  await page.waitForTimeout(300);
};
const stockDe = async (nombre) => {
  await irA('inventario');
  await page.fill('.vista-inventario input[name="texto"]', nombre);
  await page.waitForTimeout(400);
  const fila = page.locator('li.producto', { has: page.locator('.p-nombre', { hasText: nombre }) }).first();
  return (await fila.locator('.p-stock').textContent()).trim();
};
const precioDe = async (nombre) => {
  await irA('inventario');
  await page.fill('.vista-inventario input[name="texto"]', nombre);
  await page.waitForTimeout(400);
  const fila = page.locator('li.producto', { has: page.locator('.p-nombre', { hasText: nombre }) }).first();
  return (await fila.locator('.p-precio').textContent()).trim();
};
const escribirEnCobrar = async (texto) => {
  await irA('cobrar');
  await page.fill('#busqueda', texto);
  await page.press('#busqueda', 'Enter');
  await page.waitForTimeout(300);
};

// ---------- 1. Crear cuenta y catálogo ----------
await paso('crear cuenta', async () => {
  await page.goto(DIRECCION);
  await page.waitForSelector('.login form');
  await captura('01-entrar');
  await page.click('text=¿Primera vez? Crear cuenta');
  await page.fill('input[name="correo"]', CORREO);
  await page.fill('input[name="clave"]', CLAVE);
  await page.fill('input[name="clave2"]', CLAVE);
  await page.click('[data-enviar]');
  await dialogo().locator('text=Catálogo inicial').waitFor({ timeout: 15000 });
  await captura('02-bienvenida');
  ok('crear cuenta y ver oferta de catálogo', true);
});

await paso('cargar catálogo', async () => {
  await dialogo().locator('text=Sí, cargar productos').click();
  await irA('inventario');
  await page.waitForFunction(() => document.querySelectorAll('li.producto').length >= 80, null, { timeout: 15000 });
  const n = await page.locator('li.producto').count();
  ok('catálogo cargado', n === 88, `${n} productos`);
  await captura('03-inventario');
});

// ---------- 2. Cobrar ----------
await paso('agregar por código (EAN-8) dos veces', async () => {
  await escribirEnCobrar('75007614');
  await escribirEnCobrar('75007614');
  const item = page.locator('.item', { hasText: 'Coca-Cola Original 600 ml' });
  ok('Coca-Cola 600 en la cuenta', (await item.count()) === 1);
  ok('cantidad 2', (await item.locator('.cant').textContent()).trim() === '2');
});

await paso('agregar por nombre', async () => {
  await irA('cobrar');
  await page.fill('#busqueda', 'sabritas 45');
  await page.waitForSelector('.sugerencias button');
  await page.click('.sugerencias button >> nth=0');
  ok('Sabritas en la cuenta', (await page.locator('.item', { hasText: 'Sabritas Original 45 g' }).count()) === 1);
});

await paso('botón rápido a granel ($20 de huevo)', async () => {
  await page.click('.chip-rapido:has-text("Huevo blanco (kilo)")');
  await dialogo().locator('[data-pesos="20"]').click();
  await dialogo().locator('button[type="submit"]').click();
  const item = page.locator('.item', { hasText: 'Huevo blanco (kilo)' });
  const cant = (await item.locator('.cant').textContent()).trim();
  const sub = (await item.locator('.item-subtotal').textContent()).trim();
  ok('huevo a granel', cant.startsWith('0.476') && sub === '$19.99', `${cant} = ${sub}`);
  await captura('04-cobrar-cuenta');
});

let totalVenta = '';
await paso('cobrar en efectivo con cambio', async () => {
  totalVenta = (await page.locator('[data-total]').textContent()).trim();
  await page.click('[data-accion="cobrar"]');
  await dialogo().locator('[data-billete="100"]').click();
  const cambio = (await dialogo().locator('[data-cambio]').textContent()).trim();
  await captura('05-cobrar-pago');
  await dialogo().locator('button[type="submit"]').click();
  await aviso('Venta de').waitFor();
  ok('venta guardada', true, `total ${totalVenta}, cambio ${cambio}`);
  ok('total correcto', totalVenta === '$82.99', totalVenta); // 22*2 + 19 + 19.99
  ok('cambio correcto', cambio === '$17.01', cambio);
  ok('cuenta vacía después de cobrar', (await page.locator('.item').count()) === 0);
});

await paso('existencia baja con la venta', async () => {
  ok('Coca-Cola 600 quedó en -2', (await stockDe('Coca-Cola Original 600 ml')) === '-2');
});

await paso('código desconocido: registrar producto nuevo', async () => {
  await escribirEnCobrar('7509999999994');
  await dialogo().locator('text=Código no registrado').waitFor();
  await dialogo().locator('[data-op="nuevo"]').click();
  const form = dialogo().locator('form');
  await form.locator('input[name="nombre"]').fill('Producto de prueba');
  await form.locator('input[name="costo"]').fill('7');
  await form.locator('[data-margen="30"]').click();
  const precio = await form.locator('input[name="precio"]').inputValue();
  ok('botón de 30% calcula el precio', precio === '9.5', precio);
  await captura('06-producto-nuevo');
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  ok('producto nuevo en la cuenta', (await page.locator('.item', { hasText: 'Producto de prueba' }).count()) === 1);
});

await paso('código desconocido: ligar a producto existente', async () => {
  await escribirEnCobrar('7500000000011');
  await dialogo().locator('[data-op="ligar"]').click();
  await dialogo().locator('input[type="search"]').fill('pepsi 600');
  await page.waitForTimeout(300);
  await dialogo().locator('.lista-elegir button >> nth=0').click();
  await page.waitForTimeout(500);
  ok('Pepsi agregada', (await page.locator('.item', { hasText: 'Pepsi 600 ml' }).count()) === 1);
  await escribirEnCobrar('7500000000011');
  const cant = (await page.locator('.item', { hasText: 'Pepsi 600 ml' }).locator('.cant').textContent()).trim();
  ok('el código ligado ya se reconoce', cant === '2', cant);
});

await paso('artículo sin registro', async () => {
  await page.click('[data-accion="varios"]');
  await dialogo().locator('input[name="precio"]').fill('15');
  await dialogo().locator('button[type="submit"]').click();
  ok('varios en la cuenta', (await page.locator('.item', { hasText: 'Varios' }).count()) === 1);
});

await paso('cobrar con tarjeta', async () => {
  await page.click('[data-accion="cobrar"]');
  await dialogo().locator('[data-pago="tarjeta"]').click();
  await dialogo().locator('button[type="submit"]').click();
  await aviso('Venta de').last().waitFor();
  ok('venta con tarjeta', true);
});

// ---------- 3. Inventario ----------
await paso('entrada de mercancía', async () => {
  await irA('inventario');
  await page.click('[data-accion="entrada"]');
  await dialogo().locator('input[type="search"]').fill('coca-cola original 600');
  await page.waitForTimeout(300);
  await dialogo().locator('.lista-elegir button >> nth=0').click();
  const form = dialogo().locator('form');
  await form.locator('input[name="cantidad"]').fill('24');
  await form.locator('input[name="costo"]').fill('18.5');
  await captura('07-entrada');
  await form.locator('button[type="submit"]').click();
  await dialogo().locator('text=Siguiente producto').waitFor();
  await dialogo().locator('[data-cerrar]').first().click();
  await page.waitForTimeout(300);
  if (await page.locator('dialog[open]').count()) await dialogo().locator('[data-cerrar]').first().click();
  ok('existencia 22 tras entrada', (await stockDe('Coca-Cola Original 600 ml')) === '22');
});

await paso('conteo de inventario', async () => {
  await irA('inventario');
  await page.fill('.vista-inventario input[name="texto"]', '');
  await page.click('[data-accion="conteo"]');
  await page.fill('.vista-inventario input[name="texto"]', 'Sprite');
  await page.waitForTimeout(400);
  const campo = page.locator('input[data-conteo]').first();
  await campo.fill('12');
  await campo.press('Enter');
  await page.waitForTimeout(400);
  await captura('08-conteo');
  await page.click('[data-accion="conteo"]');
  ok('conteo guardado', (await stockDe('Sprite 600 ml')) === '12');
});

await paso('editar precio de un producto', async () => {
  await irA('inventario');
  await page.fill('.vista-inventario input[name="texto"]', 'Fanta');
  await page.waitForTimeout(400);
  await page.click('li.producto >> nth=0');
  await dialogo().locator('input[name="precio"]').fill('21');
  await dialogo().locator('button[type="submit"]').click();
  ok('precio nuevo', (await precioDe('Fanta Naranja 600 ml')) === '$21.00');
});

// ---------- 4. Ventas ----------
await paso('corte del día', async () => {
  await irA('ventas');
  await page.waitForSelector('.lista-ventas .venta');
  const vendido = (await page.locator('.tarjeta.destacada strong').textContent()).trim();
  const n = await page.locator('.lista-ventas .venta').count();
  const esperado = (await page.locator('.filas-corte .esperado strong').first().textContent()).trim();
  await captura('09-ventas');
  ok('dos ventas en el día', n === 2, `${n}`);
  ok('vendido del día', vendido === '$145.49', vendido); // 82.99 + (9.5 + 19*2 + 15)
  ok('efectivo en caja', esperado === '$82.99', esperado);
});

await paso('cancelar venta regresa existencias', async () => {
  await irA('ventas');
  await page.locator('.lista-ventas .venta').last().click();
  await captura('10-detalle-venta');
  await dialogo().locator('[data-accion="cancelar-venta"]').click();
  await dialogo().locator('text=Sí, cancelar venta').click();
  await page.waitForTimeout(500);
  const vendido = (await page.locator('.tarjeta.destacada strong').textContent()).trim();
  ok('vendido sin la cancelada', vendido === '$62.50', vendido);
  ok('Coca-Cola regresó a 24', (await stockDe('Coca-Cola Original 600 ml')) === '24');
});

await paso('resumen por días', async () => {
  await irA('ventas');
  await page.waitForTimeout(500);
  const barra = (await page.locator('.barras .barra-valor').first().textContent()).trim();
  ok('barra de hoy', barra === '$62.50', barra);
});

// ---------- 5. Más ----------
await paso('precios en bloque', async () => {
  await irA('mas');
  await page.click('[data-accion="precios"]');
  const form = dialogo().locator('form');
  await form.locator('select[name="categoria"]').selectOption('Refrescos y bebidas');
  await form.locator('input[name="valor"]').fill('10');
  await page.waitForTimeout(200);
  await captura('11-precios-bloque');
  await form.locator('[data-aplicar]').click();
  await dialogo().locator('text=Aplicar').last().click();
  await page.waitForTimeout(500);
  ok('Coca 600: $22 → $24', (await precioDe('Coca-Cola Original 600 ml')) === '$24.00');
});

let csv = '';
await paso('descargar inventario en CSV', async () => {
  await irA('mas');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-accion="exportar"]')]);
  const ruta = join(CAPTURAS, 'inventario.csv');
  await descarga.saveAs(ruta);
  csv = readFileSync(ruta, 'utf8');
  const filas = csv.trim().split('\r\n');
  ok('CSV con encabezado y productos', filas[0].includes('nombre') && filas.length === 90, `${filas.length} filas`);
});

await paso('subir inventario desde CSV', async () => {
  const filas = csv.replace(/^﻿/, '').split('\r\n');
  const i = filas.findIndex((f) => f.includes('Churrumais'));
  const celdas = filas[i].split(',');
  celdas[6] = '11'; // precio
  filas[i] = celdas.join(',');
  filas.push(',Chicharrón de harina,,Botanas,pza,8,12,20,5,no');
  const ruta = join(CAPTURAS, 'inventario-editado.csv');
  writeFileSync(ruta, '﻿' + filas.join('\r\n'));
  await irA('mas');
  await page.setInputFiles('[data-archivo]', ruta);
  await dialogo().locator('text=Subir cambios').click();
  await page.waitForTimeout(700);
  ok('precio cambiado desde Excel', (await precioDe('Churrumais 58 g')) === '$11.00');
  ok('producto nuevo desde Excel', (await stockDe('Chicharrón de harina')) === '20');
});

await paso('historial de inventario', async () => {
  await irA('mas');
  await page.click('[data-accion="historial"]');
  await dialogo().locator('.lista-movimientos li').first().waitFor();
  const n = await dialogo().locator('.lista-movimientos li').count();
  await captura('12-historial');
  ok('movimientos registrados', n >= 2, `${n}`);
  await dialogo().locator('[data-cerrar]').first().click();
});

await paso('categorías', async () => {
  await irA('mas');
  await page.click('[data-accion="categorias"]');
  await dialogo().locator('[data-accion="nueva-cat"]').click();
  await dialogo().locator('input[name="dato"]').fill('Papelería');
  await dialogo().locator('button[type="submit"]').click();
  await page.waitForTimeout(400);
  ok('categoría nueva', (await dialogo().locator('.lista-categorias li', { hasText: 'Papelería' }).count()) === 1);
  await dialogo().locator('[data-cerrar]').first().click();
  await captura('13-mas');
});

// ---------- 6. Sin internet ----------
await paso('vender sin internet', async () => {
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await escribirEnCobrar('7501055300075');
  await page.click('[data-accion="cobrar"]');
  await dialogo().locator('[data-billete="50"]').click();
  await dialogo().locator('button[type="submit"]').click();
  await aviso('Venta de').last().waitFor();
  const estado = (await page.locator('[data-sync]').textContent()).trim();
  await captura('14-sin-internet');
  ok('indicador sin internet', estado.includes('Sin internet'), estado);
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.querySelector('[data-sync]')?.textContent.includes('Guardado'), null, { timeout: 30000 });
  ok('se subió al volver internet', true);
});

await paso('los datos siguen después de recargar', async () => {
  await page.reload();
  await irA('ventas');
  await page.waitForTimeout(1500);
  const n = await page.locator('.lista-ventas .venta').count();
  ok('3 ventas guardadas en la nube', n === 3, `${n}`);
});

// ---------- 7. Computadora ----------
await paso('vista de computadora', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await irA('cobrar');
  await escribirEnCobrar('75007614');
  await captura('15-compu-cobrar');
  await irA('ventas');
  await captura('16-compu-ventas');
});

await navegador.close();
console.log('\n' + resultados.join('\n'));
console.log(`\nErrores en consola: ${errores.length}`);
errores.slice(0, 20).forEach((e) => console.log(e));
console.log(`\nCuenta de prueba: ${CORREO}`);
