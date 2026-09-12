import { Game } from './core/Game';
import { ALL_BOXERS } from './data/boxers';
import { startFight } from './scenes/launch';

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
  // Exposed for the automated playtest harness: the game itself, plus enough
  // of the roster and the fight launcher to drive any bout from a script.
  // Visual QA has to be able to put every one of the sixteen boxers on screen
  // without unlocking them one career fight at a time.
  (window as unknown as { GLASSJAW: unknown }).GLASSJAW = Object.assign(game, {
    roster: ALL_BOXERS,
    startFight: (id: string, difficulty = 'normal') => {
      const b = ALL_BOXERS.find((x) => x.id === id);
      if (!b) throw new Error(`No such boxer: ${id}`);
      startFight(game, { opponent: b, difficulty: difficulty as never, mode: 'arcade' });
    },
  });
} catch (err) {
  fail(err);
}

window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));
