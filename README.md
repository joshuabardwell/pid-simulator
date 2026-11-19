# PID Controller Simulator

An interactive PID controller demo: drag a setpoint, watch a follower chase it, and see how the
P, I, D and feedforward gains change the response. It is conceptual; the gains do not map to real
flight-controller values.

Live at https://www.fpvknowitall.com/pid-controller-simulator/

## How it is deployed

A push to `main` runs `.github/workflows/pages.yml`, which builds one self-contained file and
publishes it to GitHub Pages:

- Standalone page: https://joshuabardwell.github.io/pid-simulator/
- Script: https://joshuabardwell.github.io/pid-simulator/pid-simulator.js

A host page embeds the app with:

```html
<div id="pid-sim-root"></div>
<script async src="https://joshuabardwell.github.io/pid-simulator/pid-simulator.js"></script>
```

`async` keeps the rest of the host page loading if GitHub Pages is slow or unreachable.

On a container 700 px wide or more, the script fills the `pid-sim-root` element from its top edge
to the bottom of the viewport (minimum 600 px). On a narrower container (a phone) the panels are
stacked, the element is as tall as its content, and the host page scrolls.

The build that is running is readable from the element's `data-pid-sim-build` attribute and from
the comment on the first line of the script.

## Developing

Requires Node 24.

```
npm install
npm run dev      # rebuilds on change, serves http://localhost:8137
npm run build    # writes dist/pid-simulator.js and dist/index.html
npm test         # simulation tests; the Pages workflow runs them before building
```

- `src/sim.js`: the simulation. One PID + physics step at a fixed 240 Hz, used by both the live
  loop and the step-response chart, so the result does not depend on the monitor's refresh rate.
- `src/app.jsx`: the interface (React components, scope, step-response chart, both layouts).
- `src/main.js`: container sizing, scoped CSS and mounting.
- `test/sim.test.mjs`: tests for `src/sim.js`.
- `index.html`: the standalone page.
- `scripts/build.mjs`: the esbuild build.
