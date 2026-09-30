// Dibuja los íconos PNG de la app a partir de los SVG del proyecto (con Chromium).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROYECTO = join(dirname(fileURLToPath(import.meta.url)), '..');
const redondo = readFileSync(join(PROYECTO, 'public/favicon.svg'), 'utf8');
const completo = readFileSync(join(PROYECTO, 'recursos/icono-completo.svg'), 'utf8');

// Primer plano para ícono adaptable de Android: sin fondo y más chico (zona segura).
const contenido = completo.match(/<g transform[\s\S]*<\/g>\s*<\/g>/)[0];
const primerPlano = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${contenido.replace(
  'translate(51.2 51.2) scale(0.8)',
  'translate(76.8 76.8) scale(0.7)',
)}</svg>`;
const fondo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0f766e"/></svg>';
const splash = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${color}"/><g transform="translate(1066 1066) scale(1.171875)">${redondo.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;

const SALIDAS = [
  [redondo, 192, 'public/icons/icon-192.png', true],
  [redondo, 512, 'public/icons/icon-512.png', true],
  [completo, 512, 'public/icons/maskable-512.png', false],
  [completo, 180, 'public/icons/apple-touch-icon.png', false],
  [completo, 1024, 'assets/icon-only.png', false],
  [primerPlano, 1024, 'assets/icon-foreground.png', true],
  [fondo, 1024, 'assets/icon-background.png', false],
  [splash('#0f766e'), 2732, 'assets/splash.png', false],
  [splash('#0d1513'), 2732, 'assets/splash-dark.png', false],
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [svg, tam, destino, transparente] of SALIDAS) {
  await pagina.setViewportSize({ width: tam, height: tam });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await pagina.setContent(`<html><body style="margin:0;background:transparent"><img src="${src}" width="${tam}" height="${tam}" style="display:block"></body></html>`);
  await pagina.waitForFunction(() => document.images[0].complete);
  const ruta = join(PROYECTO, destino);
  mkdirSync(join(ruta, '..'), { recursive: true });
  await pagina.screenshot({ path: ruta, omitBackground: transparente });
  console.log('listo', destino);
}
await navegador.close();
