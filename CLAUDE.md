# PID Controller Simulator

Interactive PID demo embedded on fpvknowitall.com. Build, deploy and the embed stub: README.md.

- The WordPress page holds only the two-line stub. App code is never pasted into WordPress;
  a change ships by pushing to `main`.
- JB makes WordPress page edits himself, on staging, and they reach live with his next staging
  push. Claude only loads the staging and live pages anonymously, read-only. Addresses and
  rules: `../fpvshoppinglist/CLAUDE.md`, Rule #1.
- A push to `main` reaches live visitors within about 10 minutes and does not pass through
  staging. Check every change on `npm run dev` first. JB checks motion in his own browser:
  the built-in browser pane runs animation at about 1.5 fps.
- After a push, confirm the deploy by the build stamp: the first line of the published script,
  or `data-pid-sim-build` on `#pid-sim-root`.
- In PowerShell use `npm.cmd`; `npm.ps1` is blocked by the execution policy.
