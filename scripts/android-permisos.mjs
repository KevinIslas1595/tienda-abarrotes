// Agrega el permiso de cámara al proyecto de Android que crea Capacitor
// (sin él, el escáner de códigos no puede abrir la cámara dentro de la app).
import { readFileSync, writeFileSync } from 'node:fs';

const ruta = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(ruta, 'utf8');

const lineas = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
];

for (const linea of lineas) {
  const nombre = linea.match(/android:name="([^"]+)"/)[1];
  if (!xml.includes(`"${nombre}"`)) xml = xml.replace('</manifest>', `    ${linea}\n</manifest>`);
}

writeFileSync(ruta, xml);
console.log('Permisos de cámara listos en', ruta);
