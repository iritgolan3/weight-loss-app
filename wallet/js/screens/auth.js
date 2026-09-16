import { screenEl, tap } from '../dom.js';
import { auth, isValidEmail } from '../auth.js';
import { icon } from '../icons.js';
import { stagger } from '../hero.js';

/**
 * Optional sync sign-in. Never part of getting into the app — it is reached
 * from Profile, and only when a cloud backend has been configured.
 */
export function authScreen({ onDone, onCancel }) {
  let mode = 'in';

  const node = screenEl('sc-auth', `
    <button class="iconbtn iconbtn--bare" data-back aria-label="Back"
            style="margin-bottom:6px">${icon('chevronL', 24)}</button>

    <div class="sc-auth__head">
      <h1 class="title" data-t></h1>
      <p class="subtitle" data-s></p>
    </div>

    <form novalidate>
      <div class="field">
        <label class="field__box">
          <span class="sr-only">Email</span>
          <input type="email" name="email" autocomplete="email"
                 inputmode="email" placeholder="you@example.com" spellcheck="false">
        </label>
      </div>
      <div class="field">
        <label class="field__box">
          <span class="sr-only">Password</span>
          <input type="password" name="password" placeholder="Password"
                 autocomplete="current-password">
        </label>
        <p class="field__err" data-err hidden></p>
      </div>
      <button class="btn btn--block btn--morph" type="submit" style="margin-top:8px">
        <span class="btn__label"></span>
        <span class="btn__dots"><i></i><i></i><i></i></span>
      </button>
    </form>

    <p class="sc-auth__swap"></p>

    <div class="sc-auth__foot">
      <p class="sc-auth__hint">${icon('lock', 14)} Skip this and the wallet still works — it just stays on this device</p>
    </div>
  `);

  const form   = node.querySelector('form');
  const title  = node.querySelector('[data-t]');
  const sub    = node.querySelector('[data-s]');
  const err    = node.querySelector('[data-err]');
  const label  = node.querySelector('.btn__label');
  const button = node.querySelector('button[type=submit]');
  const swap   = node.querySelector('.sc-auth__swap');
  const pwBox  = form.password.closest('.field__box');

  function render() {
    const up = mode === 'up';
    title.textContent = up ? 'Create a sync account' : 'Sync this wallet';
    sub.textContent   = up
      ? 'Optional. An account lets this wallet follow you to another device.'
      : 'Sign in to pick this wallet up on another device.';
    label.textContent = up ? 'Create account' : 'Sign in';
    form.password.autocomplete = up ? 'new-password' : 'current-password';
    form.password.placeholder  = up ? 'Password (8+ characters)' : 'Password';
    swap.innerHTML = up
      ? 'Already have a sync account? <b data-swap>Sign in</b>'
      : 'No sync account yet? <b data-swap>Create one</b>';
    swap.querySelector('[data-swap]').onclick = () => { clearError(); mode = up ? 'in' : 'up'; render(); };
  }

  const clearError = () => { err.hidden = true; pwBox.classList.remove('is-bad'); };

  function showError(message) {
    err.textContent = message;
    err.hidden = false;
    pwBox.classList.add('is-bad');
    button.classList.remove('is-busy');
    tap(20);
  }

  form.addEventListener('input', clearError);

  node.querySelector('[data-back]').addEventListener('click', () => { tap(); onCancel(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearError();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!isValidEmail(email))  return showError('Enter a valid email address.');
    if (password.length < 8)   return showError('Use at least 8 characters.');

    button.classList.add('is-busy');
    try {
      if (mode === 'up') await auth.signUp(email, password);
      else               await auth.signIn(email, password);
      onDone();
    } catch (e) {
      showError(e.message || 'Something went wrong. Try again.');
    }
  });

  render();

  return {
    el: node,
    enter() {
      stagger(node.querySelector('form'), { step: 70, start: 80 });
      node.querySelector('.sc-auth__head').classList.add('fade-in');
    },
  };
}
