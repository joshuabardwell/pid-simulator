# Changelog

Newest first.

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
