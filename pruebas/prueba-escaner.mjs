// Prueba del escáner con una "cámara falsa" que muestra un código de barras.
//   node prueba-escaner.mjs video.y4m "Nombre esperado"
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [video, esperado] = process.argv.slice(2);
const DIR = dirname(fileURLToPath(import.meta.url));
const CAPTURAS = join(DIR, '..', 'capturas');

const navegador = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
});
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.grantPermissions(['camera'], { origin: 'http://127.0.0.1:5173' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

await page.goto('http://127.0.0.1:5173/');
await page.click('text=¿Primera vez? Crear cuenta');
await page.fill('input[name="correo"]', `escaner${Date.now()}@tienda.mx`);
await page.fill('input[name="clave"]', 'prueba123');
await page.fill('input[name="clave2"]', 'prueba123');
await page.click('[data-enviar]');
await page.locator('dialog[open] >> text=Sí, cargar productos').click();
await page.waitForFunction(() => document.querySelectorAll('.chip-rapido').length >= 3);

const inicio = Date.now();
await page.click('[data-accion="escanear"]');
await page.waitForFunction(
  (texto) => document.querySelector('.escaner-ultimo')?.textContent.includes(texto),
  esperado,
  { timeout: 20000 },
);
const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
const lectura = await page.locator('.escaner-ultimo').textContent();
const nativo = await page.evaluate(async () => ('BarcodeDetector' in window ? (await window.BarcodeDetector.getSupportedFormats()).join(',') : 'no hay'));
await page.screenshot({ path: join(CAPTURAS, '17-escaner.png') });
await page.click('.escaner [data-accion="cerrar"] >> nth=-1');
const enCuenta = await page.locator('.item', { hasText: esperado }).count();
console.log(`Leído en ${segundos} s: ${lectura}`);
console.log(`Lector del navegador: ${nativo}`);
console.log(`En la cuenta: ${enCuenta === 1 ? 'sí' : 'NO'}`);
console.log(`Errores: ${errores.length ? errores.join(' | ') : 'ninguno'}`);
await navegador.close();
