// Entry point: sizes the container, adds the app's CSS and mounts the app.
// The host page only needs:  <div id="pid-sim-root"></div>  and a <script> tag for the built file.
import React from "react";
import { createRoot } from "react-dom/client";
import PIDDemo from "./app.jsx";

const ROOT_ID = "pid-sim-root";

// :where() keeps the reset at zero specificity, the same weight the original `*` rule had,
// but limits it to the app so it no longer touches the rest of the host page.
const CSS = `
:where(#${ROOT_ID}, #${ROOT_ID} *) { margin: 0; padding: 0; box-sizing: border-box; }
#${ROOT_ID} { width: 100%; height: var(--pid-sim-root-height, 100dvh); min-height: 600px; display: block; }
`;

// Fill from the top of the container to the bottom of the viewport.
function updateRootHeight() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  let available = window.innerHeight - root.getBoundingClientRect().top;
  available = Math.max(400, available);
  document.documentElement.style.setProperty("--pid-sim-root-height", available + "px");
}

function start() {
  const root = document.getElementById(ROOT_ID);
  if (!root || root.dataset.pidSimBuild) return;
  root.dataset.pidSimBuild = __BUILD__;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  updateRootHeight();
  createRoot(root).render(React.createElement(PIDDemo));
}

window.addEventListener("DOMContentLoaded", updateRootHeight);
window.addEventListener("load", updateRootHeight);
window.addEventListener("resize", updateRootHeight);

if (document.getElementById(ROOT_ID)) start();
else window.addEventListener("DOMContentLoaded", start);
