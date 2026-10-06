// Utilidades: formatos de dinero y fechas, avisos, ventanas, CSV y sonidos.
import { icono } from './iconos.js';

// ---------- Texto y números ----------

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const dinero = (n) => fmtDinero.format(Number(n) || 0);

export const redondear = (n, dec = 2) => {
  const f = 10 ** dec;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

export const numero = (n, maxDec = 2) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: maxDec }).format(Number(n) || 0);

// Lee un número escrito por la persona ("$1,250.50", "12.5", " 3 ").
export function leerNumero(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/[$\s]/g, '').replace(/,/g, '');
  if (s === '') return NaN;
  return Number(s);
}

export const esGranel = (unidad) => unidad === 'kg' || unidad === 'l';
export const nombreUnidad = (unidad) => ({ kg: 'kg', l: 'L' })[unidad] ?? 'pza';

export function cantidadTexto(cant, unidad) {
  if (esGranel(unidad)) return `${numero(cant, 3)} ${nombreUnidad(unidad)}`;
  return numero(cant, 2);
}

// Minúsculas y sin acentos, para buscar "azucar" y encontrar "Azúcar".
export const normalizar = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Fechas (siempre con la hora del teléfono) ----------

export const pad = (n) => String(n).padStart(2, '0');
export const diaISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const horaHM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function fechaDeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(iso, n) {
  const d = fechaDeISO(iso);
  d.setDate(d.getDate() + n);
  return diaISO(d);
}

// "Miércoles 30 de septiembre" (con el año solo si no es el actual).
export function fechaLarga(iso) {
  const f = fechaDeISO(iso);
  const dia = f.toLocaleDateString('es-MX', { weekday: 'long' });
  const resto = f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  const anio = f.getFullYear() !== new Date().getFullYear() ? ` de ${f.getFullYear()}` : '';
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${resto}${anio}`;
}

export const fechaCorta = (iso) =>
  fechaDeISO(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

export const fechaHora = (ts) =>
  new Date(ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ---------- Avisos (mensajitos que aparecen y se van) ----------

export function aviso(mensaje, tipo = 'ok', { ms = 2800, boton, alTocar } = {}) {
  let cont = document.getElementById('avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'avisos';
    cont.setAttribute('role', 'status');
    cont.setAttribute('aria-live', 'polite');
  }
  // Una ventana abierta con showModal() tapa todo lo demás, así que los avisos
  // van dentro de la ventana de hasta arriba (o en la página si no hay ninguna).
  const destino = [...document.querySelectorAll('dialog[open]')].at(-1) ?? document.body;
  if (cont.parentElement !== destino) destino.append(cont);
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.innerHTML = `<span>${esc(mensaje)}</span>`;
  if (boton) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = boton;
    b.onclick = () => {
      el.remove();
      alTocar?.();
    };
    el.append(b);
  }
  cont.append(el);
  if (ms > 0) {
    setTimeout(() => {
      el.classList.add('saliendo');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }
  return el;
}

export const avisoError = (mensaje) => aviso(mensaje, 'error', { ms: 5000 });

// Error en un campo de formulario: avisa, lo marca en rojo y le pone el cursor.
export function errorEnCampo(campo, mensaje) {
  avisoError(mensaje);
  campo.setAttribute('aria-invalid', 'true');
  campo.addEventListener('input', () => campo.removeAttribute('aria-invalid'), { once: true });
  campo.focus();
}

// localStorage puede fallar (modo privado, sin espacio): nunca debe tumbar la app.
export function leerLocal(clave, porDefecto = null) {
  try {
    return localStorage.getItem(clave) ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

export function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin espacio o bloqueado: no pasa nada */
  }
}

// ---------- Ventanas (diálogos) ----------

// Abre una ventana encima de la pantalla. Devuelve { dlg, cuerpo, cerrar }.
export function abrirModal({ titulo = '', contenido = '', clase = '', alCerrar } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal ${clase}`;
  dlg.innerHTML = `
    <div class="modal-caja">
      <header class="modal-cabeza">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
      </header>
      <div class="modal-cuerpo"></div>
    </div>`;
  const cuerpo = dlg.querySelector('.modal-cuerpo');
  if (typeof contenido === 'string') cuerpo.innerHTML = contenido;
  else if (contenido) cuerpo.append(contenido);
  document.body.append(dlg);

  const cerrar = () => {
    if (dlg.open) dlg.close();
  };
  dlg.addEventListener('close', () => {
    dlg.remove();
    alCerrar?.();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) cerrar();
  });
  dlg.showModal();
  return { dlg, cuerpo, cerrar };
}

export function confirmar(mensaje, { titulo = '¿Seguro?', si = 'Sí', no = 'Cancelar', peligro = false, html = false } = {}) {
  return new Promise((resolve) => {
    let respuesta = false;
    const { cuerpo, cerrar } = abrirModal({
      titulo,
      clase: 'modal-chico',
      contenido: `
        <div class="confirmar-texto">${html ? mensaje : `<p>${esc(mensaje)}</p>`}</div>
        <div class="fila-botones">
          <button type="button" class="btn" data-no>${esc(no)}</button>
          <button type="button" class="btn ${peligro ? 'peligro' : 'primario'}" data-si>${esc(si)}</button>
        </div>`,
      alCerrar: () => resolve(respuesta),
    });
    cuerpo.querySelector('[data-si]').onclick = () => {
      respuesta = true;
      cerrar();
    };
    cuerpo.querySelector('[data-no]').onclick = cerrar;
    cuerpo.querySelector('[data-si]').focus();
  });
}

// Reemplazo de prompt(): pide un dato en una ventana.
export function pedirDato({ titulo, etiqueta, valor = '', tipo = 'text', ayuda = '', boton = 'Aceptar', paso } = {}) {
  return new Promise((resolve) => {
    let respuesta = null;
    const esNumero = tipo === 'number';
    const { cuerpo, cerrar } = abrirModal({
      titulo,
      clase: 'modal-chico',
      contenido: `
        <form class="formulario" novalidate>
          <label class="campo">
            <span>${esc(etiqueta)}</span>
            <input name="dato" type="${esNumero ? 'number' : 'text'}" ${esNumero ? `inputmode="decimal" step="${paso ?? 'any'}"` : ''} value="${esc(valor)}" autocomplete="off" />
          </label>
          ${ayuda ? `<p class="ayuda">${esc(ayuda)}</p>` : ''}
          <div class="fila-botones">
            <button type="button" class="btn" data-cerrar>Cancelar</button>
            <button type="submit" class="btn primario">${esc(boton)}</button>
          </div>
        </form>`,
      alCerrar: () => resolve(respuesta),
    });
    const form = cuerpo.querySelector('form');
    const input = form.dato;
    input.focus();
    input.select();
    form.onsubmit = (e) => {
      e.preventDefault();
      respuesta = input.value.trim();
      cerrar();
    };
  });
}

// ---------- CSV (se abre en Excel) ----------

// Un texto que empieza con = + - @ Excel lo toma como fórmula: se le pone un
// apóstrofo delante para que se vea tal cual (al importar se le quita).
const PARECE_FORMULA = /^[=+\-@\t\r]/;

function celdaCSV(v) {
  let s = v == null ? '' : String(v);
  if (typeof v === 'string' && PARECE_FORMULA.test(s) && !Number.isFinite(Number(s))) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// El ﻿ al inicio hace que Excel respete los acentos.
export const aCSV = (filas) => '﻿' + filas.map((f) => f.map(celdaCSV).join(',')).join('\r\n');

// Lee CSV con comillas, comas o punto y coma, y saltos de línea de Windows.
export function leerCSV(texto) {
  const t = texto.replace(/^﻿/, '');
  const primeraLinea = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas
    .filter((f) => f.some((c) => c.trim() !== ''))
    .map((f) => f.map((c) => (c.startsWith("'") && PARECE_FORMULA.test(c.slice(1)) ? c.slice(1) : c)));
}

export async function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  // En la app de Android no hay "Descargas": se comparte el archivo (WhatsApp, Drive, correo…).
  if (window.Capacitor) {
    const archivo = new File([blob], nombre, { type: tipo });
    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: nombre });
      } catch {
        /* la persona canceló */
      }
      return;
    }
    avisoError('Para descargar archivos abre la página web de la tienda en Chrome.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- Sonido y vibración al escanear ----------

let ctxAudio = null;
export function pitido(frecuencia = 1500, ms = 90) {
  try {
    ctxAudio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    const osc = ctxAudio.createOscillator();
    const vol = ctxAudio.createGain();
    osc.type = 'square';
    osc.frequency.value = frecuencia;
    vol.gain.value = 0.05;
    osc.connect(vol).connect(ctxAudio.destination);
    osc.start();
    osc.stop(ctxAudio.currentTime + ms / 1000);
  } catch {
    /* sin sonido no pasa nada */
  }
}

export const vibrar = (ms = 40) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no todos los teléfonos vibran */
  }
};

// ---------- Errores de Firebase en español ----------

const ERRORES = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-email': 'Escribe tu correo.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Usa «Entrar».',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  'auth/network-request-failed': 'No hay internet. Para entrar necesitas conexión (después ya funciona sin internet).',
  'auth/operation-not-allowed': 'Falta activar «Correo electrónico/contraseña» en Firebase → Authentication.',
  'auth/configuration-not-found': 'Falta activar Authentication en Firebase (Seguridad → Authentication → Comenzar → Correo electrónico/contraseña).',
  'auth/admin-restricted-operation': 'Crear cuentas nuevas está desactivado en Firebase.',
  'permission-denied': 'Sin permiso para guardar. Revisa que pegaste las reglas de seguridad en Firestore.',
  unavailable: 'Sin conexión. Se guardará cuando vuelva el internet.',
  'resource-exhausted': 'Se llegó al límite gratuito de hoy en Firebase. Mañana se reinicia.',
};

export const traducirError = (e) => ERRORES[e?.code] ?? e?.message ?? String(e);
