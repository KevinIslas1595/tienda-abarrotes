// Comprueba las reglas de seguridad de Firestore en el emulador:
// cada cuenta solo puede leer y escribir su propia tienda.
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8085/v1/projects/demo-tienda/databases/(default)/documents';

async function crearCuenta(correo) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password: 'prueba123', returnSecureToken: true }),
  });
  const j = await r.json();
  return { uid: j.localId, token: j.idToken };
}

async function pedir(metodo, ruta, token, cuerpo) {
  const r = await fetch(`${FS}/${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return r.status;
}

const a = await crearCuenta(`a${Date.now()}@tienda.mx`);
const b = await crearCuenta(`b${Date.now()}@tienda.mx`);
const producto = { fields: { nombre: { stringValue: 'Prueba' }, precio: { doubleValue: 10 } } };

const casos = [
  ['A escribe en su tienda', await pedir('PATCH', `tiendas/${a.uid}/productos/p1`, a.token, producto), 200],
  ['A lee su tienda', await pedir('GET', `tiendas/${a.uid}/productos/p1`, a.token), 200],
  ['B NO puede leer la tienda de A', await pedir('GET', `tiendas/${a.uid}/productos/p1`, b.token), 403],
  ['B NO puede escribir en la tienda de A', await pedir('PATCH', `tiendas/${a.uid}/productos/p2`, b.token, producto), 403],
  ['B NO puede listar las ventas de A', await pedir('GET', `tiendas/${a.uid}/ventas`, b.token), 403],
  ['Sin sesión NO se puede leer', await pedir('GET', `tiendas/${a.uid}/productos/p1`, null), 403],
  ['Nadie puede listar todas las tiendas', await pedir('GET', 'tiendas', a.token), 403],
];

let fallas = 0;
for (const [nombre, obtenido, esperado] of casos) {
  const bien = obtenido === esperado;
  if (!bien) fallas++;
  console.log(`${bien ? 'OK   ' : 'FALLA'} ${nombre} (HTTP ${obtenido})`);
}
process.exit(fallas ? 1 : 0);
