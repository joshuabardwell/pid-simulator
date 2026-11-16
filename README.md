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
<script src="https://joshuabardwell.github.io/pid-simulator/pid-simulator.js"></script>
```

The script fills the `pid-sim-root` element from its top edge to the bottom of the viewport
(minimum 600 px). The build that is running is readable from the element's `data-pid-sim-build`
attribute and from the comment on the first line of the script.

## Developing

Requires Node 24.

```
npm install
npm run dev      # rebuilds on change, serves http://localhost:8137
npm run build    # writes dist/pid-simulator.js and dist/index.html
```

- `src/app.jsx`: the simulator (React components, PID loop, scope, step response).
- `src/main.js`: container sizing, scoped CSS and mounting.
- `index.html`: the standalone page.
- `scripts/build.mjs`: the esbuild build.
