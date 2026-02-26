import { GameEngine } from './core/gameEngine';
import { TICK_MS } from './core/types';
import { CanvasRenderer } from './render/canvasRenderer';
const engine = new GameEngine();
const canvas = document.getElementById('tabuleiro');
const resultado = document.getElementById('resultado');
const relogio = document.getElementById('relogio');
const startBtn = document.getElementById('start');
const p2Btn = document.getElementById('2player');
const p3Btn = document.getElementById('3player');
const p4Btn = document.getElementById('4player');
const renderer = new CanvasRenderer(canvas);
let clockHandle = 0;
let animationHandle = 0;
let lastFrame = 0;
let accumulator = 0;
function updateHud() {
    relogio.textContent = engine.formatClock();
    resultado.textContent = engine.state.winnerText;
    relogio.style.color = engine.state.remainingSeconds <= 10 ? '#cc3300' : '#ffcc00';
}
function runTick() {
    engine.tick();
    updateHud();
}
function frame(timestamp) {
    if (!engine.state.running) {
        stopLoops();
        return;
    }
    if (lastFrame === 0)
        lastFrame = timestamp;
    const delta = timestamp - lastFrame;
    lastFrame = timestamp;
    accumulator += delta;
    while (accumulator >= TICK_MS) {
        runTick();
        accumulator -= TICK_MS;
    }
    renderer.draw(engine);
    animationHandle = window.requestAnimationFrame(frame);
}
function stopLoops() {
    if (clockHandle)
        window.clearInterval(clockHandle);
    if (animationHandle)
        window.cancelAnimationFrame(animationHandle);
    clockHandle = 0;
    animationHandle = 0;
    accumulator = 0;
    lastFrame = 0;
}
function startGame() {
    stopLoops();
    engine.start();
    renderer.draw(engine);
    updateHud();
    animationHandle = window.requestAnimationFrame(frame);
    clockHandle = window.setInterval(() => {
        engine.secondTick();
        updateHud();
    }, 1000);
}
function selectPlayers(count) {
    engine.selectPlayers(count);
    p2Btn.disabled = true;
    p3Btn.disabled = true;
    p4Btn.disabled = true;
    startBtn.style.display = 'block';
}
p2Btn.addEventListener('click', () => selectPlayers(2));
p3Btn.addEventListener('click', () => selectPlayers(3));
p4Btn.addEventListener('click', () => selectPlayers(4));
startBtn.addEventListener('click', () => {
    startGame();
    startBtn.style.display = 'none';
});
window.addEventListener('keypress', (event) => {
    engine.keyPress(event.key);
});
renderer.ready().then(() => {
    updateHud();
    renderer.draw(engine);
});
