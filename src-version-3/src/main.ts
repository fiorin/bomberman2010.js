import { GameEngine } from './core/gameEngine';
import { MAX_FRAME_MS, TICK_MS, type Difficulty, type InputKey } from './core/types';
import { CanvasRenderer } from './render/canvasRenderer';

const canvas = document.getElementById('tabuleiro') as HTMLCanvasElement;
const resultado = document.getElementById('resultado') as HTMLDivElement;
const relogio = document.getElementById('relogio') as HTMLDivElement;
const info = document.getElementById('info') as HTMLDivElement;
const menu = document.getElementById('menu') as HTMLDivElement;
const fim = document.getElementById('fim') as HTMLDivElement;
const botaoDeNovo = document.getElementById('de-novo') as HTMLButtonElement;
const botaoTrocar = document.getElementById('trocar') as HTMLButtonElement;

const engine = new GameEngine();
const renderer = new CanvasRenderer(canvas);

let lastFrame = 0;
let accumulator = 0;
let currentHumans = 1;
let selectedDifficulty: Difficulty = 'normal';
let currentDifficulty: Difficulty = 'normal';
let lastClock = '';
let lastResult = '';
let lastInfo = '';

function startGame(humans: number, difficulty: Difficulty): void {
  currentHumans = humans;
  currentDifficulty = difficulty;
  engine.start(humans, difficulty);
  accumulator = 0;
  lastClock = '';
  lastResult = '';
  lastInfo = '';
  menu.hidden = true;
}

function backToMenu(): void {
  engine.stop();
  menu.hidden = false;
  accumulator = 0;
}

function updateHud(): void {
  const clock = engine.state.started ? engine.formatClock() : '';
  if (clock !== lastClock) {
    relogio.textContent = clock;
    lastClock = clock;
  }
  relogio.classList.toggle(
    'urgente',
    engine.state.started && engine.state.running && engine.state.remainingSeconds <= 10,
  );
  const result = engine.state.winnerText;
  if (result !== lastResult) {
    resultado.textContent = result;
    lastResult = result;
  }
  let roster = '';
  if (engine.state.started) {
    const humans = engine.state.players.filter((p) => p.human).map((p) => p.name);
    const bots = engine.state.players.filter((p) => !p.human).map((p) => p.name);
    roster = `HUMANOS: ${humans.join(' ')}   IA: ${bots.join(' ')}`;
    if (bots.length > 0) roster += `   [${engine.state.difficulty.toUpperCase()}]`;
  }
  if (roster !== lastInfo) {
    info.textContent = roster;
    lastInfo = roster;
  }
  fim.hidden = !(engine.state.started && !engine.state.running);
}

function frame(timestamp: number): void {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = timestamp;
  let delta = timestamp - lastFrame;
  lastFrame = timestamp;
  if (delta > MAX_FRAME_MS) delta = MAX_FRAME_MS;
  let alpha = 1;
  if (engine.state.running) {
    accumulator += delta;
    while (accumulator >= TICK_MS) {
      engine.tick();
      accumulator -= TICK_MS;
      if (!engine.state.running) break;
    }
    alpha = Math.min(1, accumulator / TICK_MS);
  } else {
    engine.tick(delta / 1000);
  }
  renderer.draw(engine.state, alpha);
  updateHud();
}

function dispatchKey(key: string, down: boolean): boolean {
  let handled = false;
  for (const player of engine.state.players) {
    if (!player.human) continue;
    const controls = player.controls;
    let inputKey: InputKey | null = null;
    if (key === controls.up) inputKey = 'up';
    else if (key === controls.down) inputKey = 'down';
    else if (key === controls.left) inputKey = 'left';
    else if (key === controls.right) inputKey = 'right';
    else if (key === controls.bomb) inputKey = 'bomb';
    if (inputKey) {
      engine.setKey(player.id, inputKey, down);
      handled = true;
    }
  }
  return handled;
}

const pressedKeys = new Set<string>();

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (pressedKeys.has(key)) return;
  pressedKeys.add(key);
  if (dispatchKey(key, true)) event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key);
  dispatchKey(key, false);
});

window.addEventListener('blur', () => {
  pressedKeys.clear();
  for (const player of engine.state.players) {
    if (!player.human) continue;
    for (const key of ['up', 'down', 'left', 'right', 'bomb'] as InputKey[]) {
      engine.setKey(player.id, key, false);
    }
  }
});

document.querySelectorAll<HTMLButtonElement>('#jogadores button').forEach((button) => {
  button.addEventListener('click', () => {
    const humans = Number(button.dataset.humans);
    if (humans >= 1 && humans <= 4) startGame(humans, selectedDifficulty);
  });
});

document.querySelectorAll<HTMLButtonElement>('#dificuldade button').forEach((button) => {
  button.addEventListener('click', () => {
    const difficulty = button.dataset.dificuldade as Difficulty | undefined;
    if (!difficulty) return;
    selectedDifficulty = difficulty;
    document
      .querySelectorAll<HTMLButtonElement>('#dificuldade button')
      .forEach((other) => other.classList.toggle('ativo', other === button));
  });
});

botaoDeNovo.addEventListener('click', () => startGame(currentHumans, currentDifficulty));
botaoTrocar.addEventListener('click', backToMenu);

renderer.ready().then(() => {
  updateHud();
  requestAnimationFrame(frame);
});
