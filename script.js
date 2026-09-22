const $ = (id) => document.getElementById(id);
const display = $("display");
const statusEl = $("status");
const message = $("message");
const startBtn = $("startBtn");
const resetBtn = $("resetBtn");
const dial = $("dial");
const ring = $("ring");
const hoursInput = $("hours");
const minutesInput = $("minutes");
const secondsInput = $("seconds");
const inputs = [hoursInput, minutesInput, secondsInput];
const presets = document.querySelectorAll(".chip");
const BASE_TITLE = document.title;

let state = "idle";   // idle | running | paused | finished
let total = 0;        // length of the current countdown in ms
let remaining = 0;    // ms left while paused / idle
let endAt = 0;        // performance.now() value when the countdown ends
let frameId = null;

const pad = (n) => String(n).padStart(2, "0");

function readInput() {
  const clamp = (el, max) => Math.min(max, Math.max(0, parseInt(el.value, 10) || 0));
  const h = clamp(hoursInput, 99);
  const m = clamp(minutesInput, 59);
  const s = clamp(secondsInput, 59);
  return ((h * 60 + m) * 60 + s) * 1000;
}

function writeInput(seconds) {
  hoursInput.value = Math.floor(seconds / 3600);
  minutesInput.value = Math.floor((seconds % 3600) / 60);
  secondsInput.value = seconds % 60;
}

function format(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function render(ms) {
  display.textContent = format(ms);
  // the ring drains as time runs out
  const fraction = total > 0 ? Math.max(0, Math.min(1, ms / total)) : 0;
  ring.style.strokeDashoffset = String(100 - fraction * 100);
  ring.style.opacity = state === "idle" ? "0" : "1";
  if (state === "running") document.title = `${format(ms)} - ${BASE_TITLE}`;
}

function setState(next) {
  state = next;
  const editable = next === "idle" || next === "finished";
  inputs.forEach((i) => (i.disabled = !editable));
  presets.forEach((p) => (p.disabled = !editable));
  dial.classList.toggle("running", next === "running");
  dial.classList.toggle("finished", next === "finished");
  startBtn.classList.toggle("is-running", next === "running");
  startBtn.textContent = next === "running" ? "Pause" : next === "paused" ? "Resume" : "Start";
  statusEl.textContent = { idle: "Set your time", running: "Counting down", paused: "Paused", finished: "Time is up" }[next];
  if (next !== "running") document.title = next === "finished" ? `Time is up - ${BASE_TITLE}` : BASE_TITLE;
}

// A short three-beep alarm made with the Web Audio API (no audio file needed)
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio is optional */
  }
}

function tick() {
  const left = endAt - performance.now();
  if (left <= 0) return finish();
  render(left);
  frameId = requestAnimationFrame(tick);
}

function finish() {
  cancelAnimationFrame(frameId);
  frameId = null;
  remaining = 0;
  setState("finished");
  display.textContent = "00:00";
  ring.style.strokeDashoffset = "0";
  ring.style.opacity = "1";
  message.textContent = "Time is up!";
  beep();
}

function start() {
  if (state === "idle" || state === "finished") {
    total = readInput();
    remaining = total;
    if (total <= 0) {
      message.textContent = "Please set a time greater than zero.";
      return;
    }
  }
  message.textContent = "";
  endAt = performance.now() + remaining;
  setState("running");
  frameId = requestAnimationFrame(tick);
}

function pause() {
  cancelAnimationFrame(frameId);
  frameId = null;
  remaining = endAt - performance.now();
  setState("paused");
}

function reset() {
  cancelAnimationFrame(frameId);
  frameId = null;
  message.textContent = "";
  setState("idle");
  total = readInput();
  remaining = total;
  render(remaining);
}

function toggle() {
  if (state === "running") pause();
  else start();
}

presets.forEach((chip) =>
  chip.addEventListener("click", () => {
    writeInput(Number(chip.dataset.seconds));
    message.textContent = "";
    reset();
  })
);

inputs.forEach((input) =>
  input.addEventListener("input", () => {
    if (state === "idle" || state === "finished") {
      if (state === "finished") setState("idle");
      message.textContent = "";
      total = readInput();
      remaining = total;
      render(remaining);
    }
  })
);

startBtn.addEventListener("click", toggle);
resetBtn.addEventListener("click", reset);
$("setForm").addEventListener("submit", (event) => event.preventDefault());

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "BUTTON") return;
  if (event.key === " ") { event.preventDefault(); toggle(); }
  else if (event.key.toLowerCase() === "r") reset();
});

$("themeBtn").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-bs-theme", next);
  try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable */ }
});

total = readInput();
remaining = total;
setState("idle");
render(remaining);
