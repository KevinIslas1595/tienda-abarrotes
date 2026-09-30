// Pantalla para entrar o crear la cuenta de la tienda.
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, usandoEmulador } from '../firebase.js';
import { icono } from '../iconos.js';
import { aviso, traducirError } from '../util.js';

export function montarLogin(app) {
  let modo = 'entrar';
  app.innerHTML = `
    <main class="login">
      <div class="login-caja">
        <div class="login-logo">${icono('tienda')}</div>
        <h1>Mi Tienda</h1>
        <p class="login-sub">Inventario, cobros y corte de caja</p>
        ${usandoEmulador ? '<p class="aviso-emulador">Modo de prueba (emulador): los datos no son reales.</p>' : ''}
        <form novalidate>
          <label class="campo"><span>Correo</span>
            <input name="correo" type="email" autocomplete="email" inputmode="email" required /></label>
          <label class="campo"><span>Contraseña</span>
            <input name="clave" type="password" autocomplete="current-password" required /></label>
          <label class="campo" data-confirmar hidden><span>Repite la contraseña</span>
            <input name="clave2" type="password" autocomplete="new-password" /></label>
          <p class="error" role="alert" hidden></p>
          <button type="submit" class="btn primario grande" data-enviar>Entrar</button>
          <button type="button" class="btn-texto" data-accion="modo">¿Primera vez? Crear cuenta</button>
          <button type="button" class="btn-texto" data-accion="olvide">Olvidé mi contraseña</button>
        </form>
      </div>
    </main>`;

  const form = app.querySelector('form');
  const error = app.querySelector('.error');
  const btnEnviar = app.querySelector('[data-enviar]');
  const btnModo = app.querySelector('[data-accion="modo"]');
  const confirmar = app.querySelector('[data-confirmar]');

  const mostrarError = (msg) => {
    error.textContent = msg;
    error.hidden = !msg;
  };

  function cambiarModo() {
    modo = modo === 'entrar' ? 'crear' : 'entrar';
    const crear = modo === 'crear';
    confirmar.hidden = !crear;
    form.clave.autocomplete = crear ? 'new-password' : 'current-password';
    btnEnviar.textContent = crear ? 'Crear cuenta' : 'Entrar';
    btnModo.textContent = crear ? 'Ya tengo cuenta: entrar' : '¿Primera vez? Crear cuenta';
    mostrarError('');
  }

  app.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'modo') cambiarModo();
    if (accion === 'olvide') {
      const correo = form.correo.value.trim();
      if (!correo) {
        mostrarError('Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».');
        form.correo.focus();
        return;
      }
      try {
        await sendPasswordResetEmail(auth, correo);
        aviso('Te mandamos un correo para cambiar la contraseña (revisa también «spam»).', 'info', { ms: 7000 });
      } catch (err) {
        mostrarError(traducirError(err));
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = form.correo.value.trim();
    const clave = form.clave.value;
    if (!correo || !clave) {
      mostrarError('Escribe tu correo y tu contraseña.');
      return;
    }
    if (modo === 'crear' && clave !== form.clave2.value) {
      mostrarError('Las contraseñas no coinciden.');
      return;
    }
    mostrarError('');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Un momento…';
    try {
      if (modo === 'crear') await createUserWithEmailAndPassword(auth, correo, clave);
      else await signInWithEmailAndPassword(auth, correo, clave);
      // main.js se entera del cambio de sesión y abre la tienda.
    } catch (err) {
      mostrarError(traducirError(err));
      btnEnviar.disabled = false;
      btnEnviar.textContent = modo === 'crear' ? 'Crear cuenta' : 'Entrar';
    }
  });

  form.correo.focus();
}
