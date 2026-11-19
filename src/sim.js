// The simulation. One PID + physics step at a fixed rate, used by both the live loop and the
// step-response chart, so the two cannot drift apart and nothing depends on the monitor's
// refresh rate.

export const SIM_HZ = 240;
export const DT = 1 / SIM_HZ;

// The smoothing factors and the heat gauge were tuned with one step per 60 Hz frame. REF_HZ
// converts them so they keep the same time constants and the same size at SIM_HZ.
const REF_HZ = 60;
const perStep = (alphaPerFrame) => 1 - Math.pow(1 - alphaPerFrame, REF_HZ * DT);

const TARGET_ALPHA = perStep(0.15); // setpoint follows the pointer through a lowpass
const FF_ALPHA = perStep(0.15); // lowpass on feedforward, to prevent a spike when the setpoint first moves
const HEAT_UP = perStep(0.2);
const HEAT_DOWN = perStep(0.02);

const INTEGRAL_LIMIT = 200;
const DELAY_SLOTS = 64; // force history for the delay line: 64 steps = 266 ms

// The scope stores 60 samples per simulated second, whatever the frame rate.
export const SAMPLE_HZ = 60;
const STEPS_PER_SAMPLE = SIM_HZ / SAMPLE_HZ;

// Longest stretch of real time one frame may simulate. A slower frame runs in slow motion
// instead of jumping.
export const MAX_FRAME = 0.05;

export function createState(position = 0) {
  return {
    position,
    velocity: 0,
    integral: 0,
    steps: 0,
    prevNoisy: position,
    prevTarget: position,
    prevNoise: 0,
    ffSmooth: 0,
    noiseSum: 0,
    noiseCount: 0,
    heat: 0,
    forces: new Float64Array(DELAY_SLOTS),
    head: 0,
    // Outputs of the latest step, for the scope.
    noise: 0,
    pTerm: 0,
    iTerm: 0,
    dTerm: 0,
    ffTerm: 0,
  };
}

// Advance the state by DT.
//   p: { kp, ki, kd, kff, mass, drag, delayMs, noiseAmp, disturbance }
//   rand: returns a number in [-1, 1)
export function step(s, p, target, rand) {
  const first = s.steps === 0;
  const error = target - s.position;
  s.integral = Math.max(-INTEGRAL_LIMIT, Math.min(INTEGRAL_LIMIT, s.integral + error * DT));

  // Gyro noise, with the running mean subtracted so it is zero-mean over time.
  const raw = p.noiseAmp * rand();
  s.noiseSum += raw;
  s.noiseCount++;
  const noise = raw - s.noiseSum / s.noiseCount;
  const noisy = s.position + noise;

  // D acts on the measured (noisy) position, not on the error.
  const gyroRate = first ? 0 : (noisy - s.prevNoisy) / DT;
  s.ffSmooth = s.ffSmooth * (1 - FF_ALPHA) + ((target - s.prevTarget) / DT) * FF_ALPHA;

  const pTerm = p.kp * error;
  const iTerm = p.ki * s.integral;
  const dTerm = -p.kd * gyroRate;
  const ffTerm = p.kff * s.ffSmooth;
  const force = pTerm + iTerm + dTerm + ffTerm;

  // Motor heat: the part of the D term that comes from noise alone, kd * |noise change| / DT,
  // scaled by REF_HZ * DT so it reads what one step per 60 Hz frame used to read.
  const dNoise = first ? 0 : p.kd * Math.abs(noise - s.prevNoise) * REF_HZ;
  const heatAlpha = dNoise > s.heat ? HEAT_UP : HEAT_DOWN;
  s.heat = s.heat * (1 - heatAlpha) + dNoise * heatAlpha;

  // Delay line. The delay is rarely a whole number of steps, so the force is interpolated
  // between the two nearest stored steps. Before any force is that old, the output is zero.
  const n = s.forces.length;
  s.forces[s.head] = force;
  const delaySteps = Math.min((Math.max(0, p.delayMs) * SIM_HZ) / 1000, n - 2);
  const whole = Math.floor(delaySteps);
  const frac = delaySteps - whole;
  const newer = s.forces[(s.head - whole + n) % n];
  const older = frac > 0 ? s.forces[(s.head - whole - 1 + n) % n] : 0;
  const delayed = newer * (1 - frac) + older * frac;
  s.head = (s.head + 1) % n;

  const accel = delayed / p.mass - (p.drag * s.velocity) / p.mass + p.disturbance;
  s.velocity += accel * DT;
  s.position += s.velocity * DT;

  s.prevNoisy = noisy;
  s.prevNoise = noise;
  s.prevTarget = target;
  s.steps++;
  s.noise = noise;
  s.pTerm = pTerm;
  s.iTerm = iTerm;
  s.dTerm = dTerm;
  s.ffTerm = ffTerm;
}

// --- Live loop ---

export function createRunner(position = 0) {
  return { sim: createState(position), target: position, roll: 0, acc: 0, count: 0, pSum: 0, iSum: 0, dSum: 0, ffSum: 0 };
}

// Run as many steps as `frameSeconds` of real time calls for. Returns the number of steps.
// `rawTarget` is where the pointer is; the setpoint moves toward it through a lowpass.
// `onSample` receives one scope sample per 1/SAMPLE_HZ of simulated time. The four force terms
// in it are averaged over the steps the sample covers, so the D trace shows the same noise it
// showed at one step per 60 Hz frame.
export function advance(run, params, rawTarget, frameSeconds, rand, onSample) {
  run.acc += Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
  let steps = 0;
  while (run.acc >= DT - 1e-9) {
    run.acc -= DT;
    steps++;
    run.target += (rawTarget - run.target) * TARGET_ALPHA;
    const s = run.sim;
    step(s, params, run.target, rand);
    // Roll: follower position maps to rotation rate. At +/-100 position, +/-360 deg/s.
    run.roll = (run.roll - (s.position / 100) * 360 * DT) % 360;
    run.pSum += s.pTerm;
    run.iSum += s.iTerm;
    run.dSum += s.dTerm;
    run.ffSum += s.ffTerm;
    run.count++;
    if (run.count === STEPS_PER_SAMPLE) {
      if (onSample) {
        onSample({
          target: run.target,
          follower: s.position,
          error: run.target - s.position,
          pTerm: run.pSum / run.count,
          iTerm: run.iSum / run.count,
          dTerm: run.dSum / run.count,
          ffTerm: run.ffSum / run.count,
          noise: s.noise,
        });
      }
      run.count = 0;
      run.pSum = run.iSum = run.dSum = run.ffSum = 0;
    }
  }
  return steps;
}

// --- Step response ---

// Simulates a step from 0 to `size` and measures it. Feedforward is left out: a pure step has an
// infinite rate of change, which makes FF's contribution unrealistic. FF only matters with
// smoothed inputs. The noise comes from a fixed seed, so the chart does not flicker.
export function stepResponse({ kp, ki, kd, mass, drag, delayMs, noiseAmp, disturbance }, duration = 10, size = 50) {
  let seed = 12345;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
  const params = { kp, ki, kd, kff: 0, mass, drag, delayMs, noiseAmp, disturbance };
  const steps = Math.ceil(duration / DT);
  const positions = new Array(steps);
  const s = createState(0);
  let riseStart = -1, riseEnd = -1, peak = 0, peakTime = 0, diverged = false;
  for (let i = 0; i < steps; i++) {
    step(s, params, i === 0 ? 0 : size, rand);
    const pos = s.position, t = i * DT;
    positions[i] = pos;
    if (Math.abs(pos) > 200) diverged = true;
    if (riseStart < 0 && pos >= size * 0.1) riseStart = t;
    if (riseEnd < 0 && pos >= size * 0.9) riseEnd = t;
    if (pos > peak) { peak = pos; peakTime = t; }
  }
  const last = positions[steps - 1];
  const band = size * 0.02;
  let settle = duration;
  for (let i = steps - 1; i >= 0; i--) {
    if (Math.abs(positions[i] - size) > band) { settle = Math.min(duration, (i + 1) * DT); break; }
  }
  if (Math.abs(last - size) > band) settle = duration;
  if (!diverged) {
    // Also unstable if the error in the last quarter is clearly larger than in the second quarter.
    const q = Math.floor(steps / 4);
    let second = 0, fourth = 0;
    for (let i = q; i < 2 * q; i++) second = Math.max(second, Math.abs(positions[i] - size));
    for (let i = 3 * q; i < steps; i++) fourth = Math.max(fourth, Math.abs(positions[i] - size));
    if (fourth > second * 1.5 && fourth > 2) diverged = true;
  }
  return {
    positions,
    steps,
    duration,
    size,
    band,
    riseStart,
    riseEnd,
    rise: riseStart >= 0 && riseEnd >= 0 ? riseEnd - riseStart : NaN,
    peak,
    peakTime,
    overshoot: ((peak - size) / size) * 100,
    settle,
    ssError: Math.abs(last - size),
    diverged,
  };
}
