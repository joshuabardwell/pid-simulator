import assert from "node:assert/strict";
import { test } from "node:test";
import { DT, SIM_HZ, advance, createRunner, createState, step, stepResponse } from "../src/sim.js";

const DEFAULTS = { kp: 7.9, ki: 1.75, kd: 3.8, kff: 1, mass: 1, drag: 0.1, delayMs: 15, noiseAmp: 0.005, disturbance: 0 };

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1; };
}

// The step-response simulation as it was before sim.js existed (delay rounded to whole steps),
// kept here as the reference the shared step function is compared against.
function oldChart({ kp, ki, kd, mass, drag, delayMs, noiseAmp, disturbance }) {
  const SDT = 1 / 240, SDUR = 10, tgt = 50;
  const rng = seeded(12345);
  let nSum = 0, nCnt = 0;
  const zeroMeanNoise = () => { const raw = noiseAmp * rng(); nSum += raw; nCnt++; return raw - nSum / nCnt; };
  const steps = Math.ceil(SDUR / SDT), delaySamp = Math.round((delayMs / 1000) / SDT);
  const dd = [], fb = [];
  let sI = 0, sV = 0, sP = 0, sPNP = 0, rs = -1, re = -1, pkV = 0;
  for (let i = 0; i < steps; i++) {
    const ct = i === 0 ? 0 : tgt, err = ct - sP;
    sI = Math.max(-200, Math.min(200, sI + err * SDT));
    const n = zeroMeanNoise(), nP = sP + n, gD = i > 0 ? (nP - sPNP) / SDT : 0;
    const cf = kp * err + ki * sI - kd * gD; fb.push(cf);
    const df = i >= delaySamp ? fb[i - delaySamp] : 0;
    const a = (df / mass) - (drag * sV / mass) + disturbance;
    sV += a * SDT; sPNP = nP; sP += sV * SDT;
    dd.push(sP);
    const t = i * SDT;
    if (rs < 0 && sP >= tgt * 0.1) rs = t;
    if (re < 0 && sP >= tgt * 0.9) re = t;
    if (sP > pkV) pkV = sP;
  }
  const bnd = tgt * 0.02; let stl = SDUR;
  for (let i = steps - 1; i >= 0; i--) { if (Math.abs(dd[i] - tgt) > bnd) { stl = Math.min(SDUR, (i + 1) * SDT); break; } }
  if (Math.abs(dd[steps - 1] - tgt) > bnd) stl = SDUR;
  return { positions: dd, rise: re - rs, overshoot: ((pkV - tgt) / tgt) * 100, settle: stl, ssError: Math.abs(dd[steps - 1] - tgt) };
}

test("step chart at defaults reads 646 ms / 15.6% / 8.02 s / 0.61", () => {
  const r = stepResponse(DEFAULTS);
  assert.equal((r.rise * 1000).toFixed(0), "646");
  assert.equal(r.overshoot.toFixed(1), "15.6");
  assert.equal(r.settle.toFixed(2), "8.02");
  assert.equal(r.ssError.toFixed(2), "0.61");
  assert.equal(r.diverged, false);
});

test("shared step reproduces the old chart exactly when the delay is a whole number of steps", () => {
  const cases = [
    { ...DEFAULTS, delayMs: 0 },
    { ...DEFAULTS, delayMs: 25 },
    { ...DEFAULTS, delayMs: 50 },
    { ...DEFAULTS, delayMs: 25, kp: 20, ki: 4, kd: 9, mass: 2.5, drag: 0.6, noiseAmp: 0.02, disturbance: 30 },
    { ...DEFAULTS, delayMs: 0, kp: 2, ki: 0, kd: 0.5, mass: 0.3, noiseAmp: 0.001, disturbance: -20 },
  ];
  for (const c of cases) {
    const now = stepResponse(c), old = oldChart(c);
    let worst = 0;
    for (let i = 0; i < old.positions.length; i++) worst = Math.max(worst, Math.abs(now.positions[i] - old.positions[i]));
    assert.ok(worst < 1e-9, `delay ${c.delayMs}: positions differ by ${worst}`);
  }
});

test("with an in-between delay the chart stays within 1% of the old one", () => {
  const cases = [
    DEFAULTS,
    { ...DEFAULTS, delayMs: 7 },
    { ...DEFAULTS, delayMs: 31, kp: 12, kd: 6 },
    { ...DEFAULTS, delayMs: 10, kp: 5, ki: 3, kd: 2.5, mass: 2 },
    { ...DEFAULTS, delayMs: 22, drag: 0.5, disturbance: 20 },
    { ...DEFAULTS, delayMs: 3, kp: 15, ki: 0.5, kd: 5, noiseAmp: 0.012 },
  ];
  for (const c of cases) {
    const now = stepResponse(c), old = oldChart(c);
    // Position error is measured against the 50-unit step; times against the old value.
    let worst = 0;
    for (let i = 0; i < old.positions.length; i++) worst = Math.max(worst, Math.abs(now.positions[i] - old.positions[i]));
    assert.ok(worst < 0.5, `delay ${c.delayMs}: path differs by ${worst.toFixed(3)} of 50`);
    assert.ok(Math.abs(now.rise - old.rise) <= old.rise * 0.01, `delay ${c.delayMs}: rise ${now.rise} vs ${old.rise}`);
    assert.ok(Math.abs(now.overshoot - old.overshoot) < 0.5, `delay ${c.delayMs}: overshoot ${now.overshoot} vs ${old.overshoot}`);
    assert.ok(Math.abs(now.ssError - old.ssError) < 0.05, `delay ${c.delayMs}: ss error ${now.ssError} vs ${old.ssError}`);
  }
});

test("delay line: force arrives after the set delay, and every millisecond counts", () => {
  const firstMove = (delayMs) => {
    const s = createState(0);
    const p = { kp: 1, ki: 0, kd: 0, kff: 0, mass: 1, drag: 0, delayMs, noiseAmp: 0, disturbance: 0 };
    for (let i = 0; i < 40; i++) { step(s, p, 10, () => 0); if (s.position !== 0) return i; }
    return -1;
  };
  assert.equal(firstMove(0), 0);
  assert.equal(firstMove(25), 6); // 25 ms = 6 steps
  assert.equal(firstMove(50), 12);
  assert.equal(firstMove(15), 3); // 3.6 steps: part of the force arrives at step 3, the rest at step 4

  // Position after 0.5 s falls steadily as the delay grows 1 ms at a time.
  const after = (delayMs) => {
    const s = createState(0);
    const p = { kp: 1, ki: 0, kd: 0, kff: 0, mass: 1, drag: 0, delayMs, noiseAmp: 0, disturbance: 0 };
    for (let i = 0; i < SIM_HZ / 2; i++) step(s, p, 10, () => 0);
    return s.position;
  };
  for (let d = 1; d <= 50; d++) assert.ok(after(d) < after(d - 1), `delay ${d} ms had no effect`);
});

// Drives the live loop the way the browser does: one advance() per frame.
// rawAt(t) is the pointer position; it is read at the start of each frame.
function run(fps, seconds, params, rawAt) {
  const runner = createRunner(0);
  const rand = seeded(424242);
  const samples = [];
  let heatSum = 0, heatCount = 0;
  const frames = Math.round(fps * seconds);
  for (let k = 0; k < frames; k++) {
    advance(runner, params, rawAt(k / fps), 1 / fps, rand, (s) => samples.push(s));
    if (k / fps > seconds / 2) { heatSum += runner.sim.heat; heatCount++; }
  }
  return { samples, heat: heatSum / heatCount, runner };
}

const moves = (t) => (t < 1 ? 0 : t < 4 ? 60 : t < 7 ? -40 : 20);

test("the live loop gives the same result at 60, 120, 144 and 240 frames per second", () => {
  const base = run(60, 10, DEFAULTS, moves);
  assert.ok(base.samples.length >= 598, `expected about 600 scope samples in 10 s, got ${base.samples.length}`);
  for (const fps of [120, 144, 240]) {
    const r = run(fps, 10, DEFAULTS, moves);
    assert.ok(Math.abs(r.samples.length - base.samples.length) <= 1, `${fps} fps stored ${r.samples.length} samples`);
    let worst = 0;
    const n = Math.min(r.samples.length, base.samples.length);
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(r.samples[i].follower - base.samples[i].follower));
    assert.ok(worst < 1e-6, `${fps} fps: follower differs from 60 fps by ${worst}`);
    assert.ok(Math.abs(r.heat - base.heat) < 0.01, `${fps} fps: heat ${r.heat} vs ${base.heat}`);
  }
});

test("motor heat at defaults reads about 1.3 at every frame rate", () => {
  for (const fps of [30, 60, 120, 144, 240]) {
    const r = run(fps, 60, DEFAULTS, () => 0);
    assert.ok(r.heat > 1.2 && r.heat < 1.4, `${fps} fps: heat ${r.heat.toFixed(2)}`);
  }
});

test("a pointer read once per frame gives nearly the same path at every frame rate", () => {
  const sweep = (t) => 60 * Math.sin((2 * Math.PI * t) / 4);
  const base = run(240, 10, DEFAULTS, sweep);
  for (const fps of [60, 144]) {
    const r = run(fps, 10, DEFAULTS, sweep);
    let worst = 0;
    const n = Math.min(r.samples.length, base.samples.length);
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(r.samples[i].follower - base.samples[i].follower));
    // The pointer is seen up to one frame later at a lower frame rate; nothing else differs.
    assert.ok(worst < 2.5, `${fps} fps: follower differs from 240 fps by ${worst.toFixed(2)}`);
  }
});

test("delay applies while the setpoint is moving", () => {
  const sweep = (t) => 60 * Math.sin((2 * Math.PI * t) / 2);
  const none = run(60, 6, { ...DEFAULTS, delayMs: 0 }, sweep);
  const long = run(60, 6, { ...DEFAULTS, delayMs: 50 }, sweep);
  let worst = 0;
  for (let i = 0; i < none.samples.length; i++) worst = Math.max(worst, Math.abs(none.samples[i].follower - long.samples[i].follower));
  assert.ok(worst > 1, `50 ms of delay changed the follower by only ${worst.toFixed(3)}`);
});

test("a frame slower than 50 ms does not simulate more than 50 ms", () => {
  const runner = createRunner(0);
  const steps = advance(runner, DEFAULTS, 0, 2, () => 0, null);
  assert.ok(steps <= Math.round(0.05 / DT), `ran ${steps} steps`);
});
