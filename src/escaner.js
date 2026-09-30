// Lector de códigos de barras con la cámara.
// Usa el lector que trae el teléfono (Android/Chrome) y, si no hay, uno
// incluido en la app (ZXing), que funciona en iPhone y en computadoras.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { esc, pitido, vibrar } from './util.js';
import { icono } from './iconos.js';

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

let detectorListo = null;

function obtenerDetector() {
  detectorListo ??= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const soportados = await window.BarcodeDetector.getSupportedFormats();
        if (soportados.includes('ean_13')) {
          return new window.BarcodeDetector({ formats: FORMATOS.filter((f) => soportados.includes(f)) });
        }
      } catch {
        /* se usa el lector incluido */
      }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    prepareZXingModule({
      overrides: { locateFile: (ruta, prefijo) => (ruta.endsWith('.wasm') ? wasmUrl : prefijo + ruta) },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: FORMATOS });
  })().catch((e) => {
    detectorListo = null;
    throw e;
  });
  return detectorListo;
}

function mensajeErrorCamara(e) {
  if (!window.isSecureContext) return 'La cámara solo funciona en páginas seguras (https).';
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'No hay permiso para usar la cámara. Actívalo en el candado junto a la dirección de la página (o en Ajustes del teléfono → Apps → permisos) y vuelve a intentar.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró ninguna cámara en este aparato.';
    case 'NotReadableError':
      return 'La cámara está ocupada por otra app. Ciérrala y vuelve a intentar.';
    default:
      return `No se pudo abrir la cámara (${e?.message ?? e}).`;
  }
}

// Abre la cámara a pantalla completa.
//  - continuo=false: se cierra al leer el primer código y lo devuelve.
//  - continuo=true: sigue leyendo; cada código se manda a alLeer(codigo), que
//    puede devolver un texto para mostrar (p. ej. "Coca-Cola 600 ml +1"), o
//    false para cerrar la cámara y devolver ese código.
// Devuelve una promesa con el código (o null si se cerró con "Listo"/X).
export function abrirEscaner({ titulo = 'Escanear código', continuo = false, alLeer, resumen } = {}) {
  return new Promise((resolve) => {
    const capa = document.createElement('div');
    capa.className = 'escaner';
    capa.innerHTML = `
      <div class="escaner-cabeza">
        <strong>${esc(titulo)}</strong>
        <button type="button" class="btn-icono claro" data-accion="cerrar" aria-label="Cerrar cámara">${icono('cerrar')}</button>
      </div>
      <div class="escaner-video">
        <video playsinline muted autoplay></video>
        <div class="escaner-marco"><span class="escaner-linea"></span></div>
        <p class="escaner-estado">Abriendo cámara…</p>
      </div>
      <div class="escaner-pie">
        <div class="escaner-ultimo" aria-live="polite"></div>
        <div class="escaner-botones">
          <button type="button" class="btn claro" data-accion="linterna" hidden>${icono('linterna')} Linterna</button>
          <button type="button" class="btn claro" data-accion="teclear">${icono('teclado')} Escribir código</button>
          ${continuo ? `<button type="button" class="btn primario" data-accion="cerrar">${icono('check')} Listo</button>` : ''}
        </div>
        <form class="escaner-manual" hidden>
          <input name="codigo" inputmode="numeric" autocomplete="off" placeholder="Número del código de barras" />
          <button type="submit" class="btn primario">Usar</button>
        </form>
        ${resumen ? '<div class="escaner-resumen"></div>' : ''}
      </div>`;
    document.body.append(capa);
    document.body.classList.add('sin-scroll');

    const video = capa.querySelector('video');
    const estadoTxt = capa.querySelector('.escaner-estado');
    const ultimo = capa.querySelector('.escaner-ultimo');
    const cajaResumen = capa.querySelector('.escaner-resumen');
    const btnLinterna = capa.querySelector('[data-accion="linterna"]');
    const formManual = capa.querySelector('.escaner-manual');

    let stream = null;
    let activo = true;
    let linterna = false;
    let ultimoCodigo = '';
    let ultimoMomento = 0;
    let terminado = false;

    const pintarResumen = () => {
      if (cajaResumen) cajaResumen.innerHTML = resumen();
    };
    pintarResumen();

    function cerrar(codigo = null) {
      if (terminado) return;
      terminado = true;
      activo = false;
      stream?.getTracks().forEach((t) => t.stop());
      capa.remove();
      document.body.classList.remove('sin-scroll');
      window.removeEventListener('keydown', teclaEsc);
      resolve(codigo);
    }

    const teclaEsc = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', teclaEsc);

    function recibir(codigo) {
      codigo = String(codigo).trim();
      if (!codigo) return;
      const ahora = Date.now();
      // El mismo código seguido se ignora 1.5 s (para no contarlo dos veces).
      if (codigo === ultimoCodigo && ahora - ultimoMomento < 1500) return;
      ultimoCodigo = codigo;
      ultimoMomento = ahora;
      pitido();
      vibrar(50);
      capa.classList.remove('leido');
      void capa.offsetWidth;
      capa.classList.add('leido');
      if (!continuo) {
        cerrar(codigo);
        return;
      }
      // alLeer devuelve false cuando el código necesita atención (no está
      // registrado, o se vende por kilo): se cierra la cámara y se atiende.
      const texto = alLeer?.(codigo);
      if (texto === false) {
        cerrar(codigo);
        return;
      }
      ultimo.textContent = texto || codigo;
      pintarResumen();
    }

    capa.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-accion]')?.dataset.accion;
      if (accion === 'cerrar') cerrar();
      if (accion === 'teclear') {
        formManual.hidden = !formManual.hidden;
        if (!formManual.hidden) formManual.codigo.focus();
      }
      if (accion === 'linterna') {
        linterna = !linterna;
        const pista = stream?.getVideoTracks()[0];
        pista?.applyConstraints({ advanced: [{ torch: linterna }] }).catch(() => {});
        btnLinterna.classList.toggle('activo', linterna);
      }
    });

    formManual.addEventListener('submit', (e) => {
      e.preventDefault();
      const codigo = formManual.codigo.value.trim();
      formManual.codigo.value = '';
      if (codigo) {
        ultimoCodigo = '';
        recibir(codigo);
      }
    });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('sin cámara'), { name: 'NotFoundError' });
        const [flujo, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          }),
          obtenerDetector(),
        ]);
        if (!activo) {
          flujo.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = flujo;
        video.srcObject = stream;
        await video.play().catch(() => {});
        estadoTxt.textContent = 'Apunta al código de barras';
        const pista = stream.getVideoTracks()[0];
        const capacidades = pista.getCapabilities?.() ?? {};
        if (capacidades.torch) btnLinterna.hidden = false;
        if (capacidades.focusMode?.includes('continuous')) {
          pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }

        let ocupado = false;
        const ciclo = async () => {
          if (!activo) return;
          if (!ocupado && video.readyState >= 2 && video.videoWidth) {
            ocupado = true;
            try {
              const encontrados = await detector.detect(video);
              if (encontrados.length && activo) recibir(encontrados[0].rawValue);
            } catch {
              /* un cuadro que no se pudo leer; se sigue con el siguiente */
            }
            ocupado = false;
          }
          setTimeout(ciclo, 90);
        };
        ciclo();
      } catch (e) {
        console.error(e);
        estadoTxt.textContent = mensajeErrorCamara(e);
        estadoTxt.classList.add('error');
        formManual.hidden = false;
      }
    })();
  });
}
