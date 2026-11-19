# Changelog

Newest first.

## 2026-11-17
- Delay now applies all the time. The loop used to restart on every setpoint change and empty
  its delay buffer, so delay was zero while the setpoint moved and for a few seconds after. The
  loop now reads the setpoint and the settings without restarting (review item 1).
- The simulation runs at a fixed 240 Hz in `src/sim.js`, as many steps per frame as the elapsed
  time needs, instead of one step per frame. The follower's path, the heat gauge and the scope's
  10-second window are now the same at every refresh rate. Before, default settings read heat 1.3
  (OK) on a 60 Hz monitor, 3.1 (WARM) at 144 Hz and 5.2 (BURN) at 240 Hz (review item 2).
- The step-response chart and the live loop call the same step function. They were two separate
  simulations.
- Phone layout: on a container narrower than 700 px the panels stack (gains, physics, buttons,
  step chart, setpoint track, scope, then drone and heat gauge side by side), the app is as tall
  as its content and the page scrolls. Before, the scope had no height on a phone and the track
  was cut off. Containers 700 px and wider are laid out exactly as before (review item 3).
- Added `npm test` (9 tests of `src/sim.js`) and a test step in the Pages workflow, so a push
  with a broken simulation does not deploy.
- Decided to interpolate the delay between simulation steps, because the slider moves in 1 ms
  steps and one step is 4.2 ms. The step chart's rise time at defaults reads 646 ms instead of
  642 ms; its other three numbers are unchanged.
- Decided to scale the heat gauge to what one step per 60 Hz frame used to read (about 1.3, OK,
  at defaults), because 60 Hz is the most common monitor and the gauge's thresholds only make
  sense at one rate.
- Decided to keep the scope at 60 samples per simulated second, with the P, I, D and FF traces
  averaged over the four steps each sample covers, so the traces look as they did at 60 Hz.

## 2026-11-16
- JB replaced the pasted document in the page's Avada code block with the two-line stub, on the
  staging site. Checked at 1440x900: build e3b7738 mounts, the app container and the sidebar text
  sit at the same positions as on the old page, the step-response numbers match, nothing is
  requested from cdnjs (no Babel), and the console shows no new messages. The live page changes
  when JB next pushes staging to live.
- The stub's script tag is now `async`, so the host page keeps loading if GitHub Pages is slow or
  unreachable.

## 2026-11-15
- Split the app into `src/app.jsx` and `src/main.js` and added an esbuild build that produces one
  self-contained `pid-simulator.js` with React 18.2.0 bundled in, so the browser no longer
  downloads Babel and compiles the code on every visit (165 KB, 54 KB gzipped, against 385 KB for
  Babel alone). Component code is unchanged.
- The app's CSS reset now applies only inside `#pid-sim-root` instead of to the whole host page.
- Decided to deploy through GitHub Pages from a public repo, with the WordPress page loading the
  built script, because pasting 700 lines into the Avada code block for every change is manual and
  has no history or rollback.
- Decided to bundle React into the script rather than load it from cdnjs, so the page makes one
  outside request instead of three.
- Saved the live app from https://www.fpvknowitall.com/pid-controller-simulator/ (the embedded
  document and the full page, in `original/`), so there is a local source to work from. The app
  was built in Claude web and had no local copy.
- Reviewed the app and listed the findings for fixing later. No behaviour changed.
