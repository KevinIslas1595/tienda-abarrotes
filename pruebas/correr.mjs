// Corre todas las pruebas: arranca la app en modo emulador, ejecuta las
// pruebas y la apaga. Se usa con el emulador de Firebase ya corriendo:
//   npx firebase-tools emulators:exec --only auth,firestore --project demo-tienda "node pruebas/correr.mjs"
// (eso es lo que hace "npm test" y GitHub Actions en cada cambio).
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRECCION = 'http://127.0.0.1:5173/';

const vite = spawn(process.execPath, [join(RAIZ, 'node_modules/vite/bin/vite.js'), '--mode', 'emulador', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: RAIZ,
  stdio: 'ignore',
});

async function esperarApp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(DIRECCION)).ok) return;
    } catch {
      /* todavía no arranca */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('La app no arrancó en 30 s');
}

const correr = (archivo) =>
  new Promise((resolve) => {
    console.log(`\n=== ${archivo} ===`);
    spawn(process.execPath, [join(RAIZ, 'pruebas', archivo)], { cwd: RAIZ, stdio: 'inherit' }).on('exit', resolve);
  });

let fallas = 0;
try {
  await esperarApp();
  for (const archivo of ['prueba-reglas.mjs', 'prueba.mjs']) {
    if ((await correr(archivo)) !== 0) fallas++;
  }
} catch (e) {
  console.error(e.message);
  fallas++;
} finally {
  vite.kill();
}
console.log(fallas ? `\n${fallas} archivo(s) de pruebas con fallas` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
