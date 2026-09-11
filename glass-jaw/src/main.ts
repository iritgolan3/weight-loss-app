import { Game } from './core/Game';

const boot = document.getElementById('boot');
const bootMsg = document.getElementById('bootmsg');
const spin = document.getElementById('spin');

function fail(err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  if (spin) spin.remove();
  if (bootMsg) {
    bootMsg.className = 'err';
    bootMsg.textContent = `Could not start.\n\n${msg}`;
  }
  console.error(err);
}

try {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('Mount point #app is missing.');
  const game = new Game(mount as HTMLElement);
  game.start();
  boot?.classList.add('hidden');
  setTimeout(() => boot?.remove(), 600);
  // Exposed for the automated playtest harness.
  (window as unknown as { GLASSJAW: Game }).GLASSJAW = game;
} catch (err) {
  fail(err);
}

window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));
