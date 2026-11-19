import React, { useState, useEffect, useRef, useCallback } from "react";
import { DT, SAMPLE_HZ, advance, createRunner, stepResponse } from "./sim.js";

const HISTORY_LENGTH = 10 * SAMPLE_HZ; // 10 seconds of scope samples (view window)
const HISTORY_BUFFER = 60 * SAMPLE_HZ; // 60 seconds of scope samples (total stored)

// --- Knob Component (compact) ---
function Knob({ label, value, min, max, step, onChange, color, size = 70, defaultValue, labelSize = 18, valueSize = 20 }) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const range = max - min;
  const norm = (value - min) / range;
  const angle = -135 + norm * 270;

  const onDown = (e) => { dragging.current = true; startY.current = e.clientY; startVal.current = value; e.target.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (!dragging.current) return; const dy = startY.current - e.clientY; let v = startVal.current + dy * (range / 200); v = Math.round(v / step) * step; onChange(Math.max(min, Math.min(max, v))); };
  const onUp = () => { dragging.current = false; };
  const onDblClick = () => { if (defaultValue !== undefined) onChange(defaultValue); };

  const s = size, h = s / 2;
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = (-135 + i * 27) * Math.PI / 180;
    ticks.push(<line key={i} x1={h+(s*0.38)*Math.cos(a)} y1={h+(s*0.38)*Math.sin(a)} x2={h+(s*0.44)*Math.cos(a)} y2={h+(s*0.44)*Math.sin(a)} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, userSelect: "none" }} onDoubleClick={onDblClick}>
      <span style={{ fontFamily: "monospace", fontSize: labelSize, fontWeight: 700, color, letterSpacing: 1.5 }}>{label}</span>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ cursor: "ns-resize", touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        {ticks}
        <path d={describeArc(h,h,s*0.34,-135,135)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" strokeLinecap="round"/>
        <path d={describeArc(h,h,s*0.34,-135,angle)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" style={{filter:`drop-shadow(0 0 3px ${color})`}}/>
        <circle cx={h} cy={h} r={s*0.24} fill="#1a1d24" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <line x1={h} y1={h} x2={h+s*0.18*Math.cos(angle*Math.PI/180)} y2={h+s*0.18*Math.sin(angle*Math.PI/180)} stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span style={{ fontFamily: "monospace", fontSize: valueSize, fontWeight: 600, color: "#ccc", background: "#0c0e12", border: `1px solid ${color}33`, borderRadius: 3, padding: "1px 5px" }}>
        {value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 1)}
      </span>
    </div>
  );
}

function polarToCartesian(cx, cy, r, a) { const rad = a * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
function describeArc(cx, cy, r, sa, ea) { if (ea - sa >= 360) ea = sa + 359.99; const s = polarToCartesian(cx,cy,r,ea), e = polarToCartesian(cx,cy,r,sa); return `M ${s.x} ${s.y} A ${r} ${r} 0 ${ea-sa>180?1:0} 0 ${e.x} ${e.y}`; }

// --- Vertical Slider (compact) ---
function VSlider({ label, value, min, max, step, onChange, color, height = 100, defaultValue, labelSize = 16, valueSize = 18 }) {
  const trackH = height - 16;
  const norm = (value - min) / (max - min);
  const thumbY = (1 - norm) * trackH;
  const ref = useRef(null);
  const drag = useRef(false);
  const update = (e) => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); const n = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / trackH)); let v = min + n * (max - min); v = Math.round(v / step) * step; onChange(Math.max(min, Math.min(max, v))); };
  const onDblClick = () => { if (defaultValue !== undefined) onChange(defaultValue); };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, userSelect: "none" }} onDoubleClick={onDblClick}>
      {label && <span style={{ fontFamily: "monospace", fontSize: labelSize, fontWeight: 700, color, letterSpacing: 1 }}>{label}</span>}
      <div ref={ref} style={{ position: "relative", width: 24, height, cursor: "ns-resize", touchAction: "none" }}
        onPointerDown={(e) => { drag.current = true; e.target.setPointerCapture(e.pointerId); update(e); }}
        onPointerMove={(e) => { if (drag.current) update(e); }}
        onPointerUp={() => { drag.current = false; }}>
        <div style={{ position: "absolute", left: "50%", top: 8, width: 3, height: trackH, marginLeft: -1.5, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}/>
        <div style={{ position: "absolute", left: "50%", top: thumbY + 8, width: 3, height: trackH - thumbY, marginLeft: -1.5, background: color, borderRadius: 2, opacity: 0.3 }}/>
        <div style={{ position: "absolute", left: "50%", top: thumbY + 8, width: 18, height: 8, marginLeft: -9, marginTop: -4, borderRadius: 2, background: "#1a1d24", border: `1px solid ${color}`, boxShadow: `0 0 4px ${color}33` }}/>
      </div>
      <span style={{ fontFamily: "monospace", fontSize: valueSize, fontWeight: 600, color: "#bbb", background: "#0c0e12", border: `1px solid ${color}33`, borderRadius: 3, padding: "0px 4px", minWidth: 32, textAlign: "center" }}>
        {value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 1)}
      </span>
    </div>
  );
}

// --- Scope ---
function Scope({ history, width, height, paused, yScale, onYScaleChange, maximized }) {
  const canvasRef = useRef(null);
  const [view, setView] = useState({ panX: 0, xZoom: 1 });
  const [panY, setPanY] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Trace visibility
  const [visible, setVisible] = useState({ tgt:true, fol:true, err:true, p:true, i:true, d:true, ff:true, n:true });
  const toggle = (key) => setVisible(v => ({ ...v, [key]: !v[key] }));

  // Reset pan/scroll/xZoom when unpaused
  useEffect(() => {
    if (!paused) { setView({ panX: 0, xZoom: 1 }); setPanY(0); setScrollOffset(0); }
  }, [paused]);

  const onWheel = useCallback((e) => {
    if (!paused) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // X axis zoom centered on screen center
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setView(v => {
        const newZ = Math.max(0.5, Math.min(10, v.xZoom * factor));
        const ratio = newZ / v.xZoom;
        return { panX: v.panX * ratio, xZoom: newZ };
      });
    } else {
      // Y axis zoom
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      if (onYScaleChange) onYScaleChange(s => Math.max(5, Math.min(1000, Math.round(s * factor))));
    }
  }, [paused, onYScaleChange]);

  const onPointerDown = useCallback((e) => {
    if (!paused) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: view.panX, py: panY };
    e.target.setPointerCapture(e.pointerId);
  }, [paused, view.panX, panY]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    setView(v => ({ ...v, panX: dragStart.current.px + dx }));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr; ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.save();

    // Fixed Y axis: center is always 0, range is ±yScale
    const scMin = -yScale;
    const scMax = yScale;

    // Use all available history, draw with pixel-based pan and zoom
    const data = history;
    const viewLen = HISTORY_LENGTH;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const x = (i/10)*width; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
    // Center crosshair
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(width/2, 0); ctx.lineTo(width/2, height); ctx.stroke(); // vertical center
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.moveTo(0, height/2); ctx.lineTo(width, height/2); ctx.stroke(); // horizontal center
    ctx.setLineDash([]);

    if (data.length < 2) { ctx.restore(); return; }

    const { panX, xZoom } = view;

    const lw2 = maximized ? 2 : 1;
    // When running (not paused): anchor the most recent sample at the right edge
    // When paused: anchor the center of visible data at screen center for symmetric zoom
    const pixelsPerSample = (width * xZoom) / viewLen;
    let anchorIdx, anchorScreenX;
    if (!paused) {
      anchorIdx = data.length - 1;
      anchorScreenX = width;
    } else {
      anchorIdx = data.length - 1 - Math.min(viewLen, data.length) / 2;
      anchorScreenX = width / 2;
    }
    const draw = (get, col, a=1, lw=1.5) => { ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.globalAlpha=a; ctx.beginPath();
      let started = false;
      for (let i=0;i<data.length;i++) {
        const x = anchorScreenX + (i - anchorIdx) * pixelsPerSample + panX;
        if (x < -50 || x > width + 50) { started = false; continue; }
        const val=get(data[i]), y=height-((val-scMin)/(scMax-scMin))*height;
        if (!started) { ctx.moveTo(x,y); started = true; } else { ctx.lineTo(x,y); }
      }
      ctx.stroke(); ctx.globalAlpha=1; };
    if (visible.n) draw(h=>(h.noise||0)*1000,"#888888",0.25, 1);
    if (visible.p) draw(h=>h.pTerm||0,"#22d3ee",0.3, 1*lw2);
    if (visible.i) draw(h=>h.iTerm||0,"#a78bfa",0.3, 1*lw2);
    if (visible.d) draw(h=>h.dTerm||0,"#34d399",0.3, 1*lw2);
    if (visible.ff) draw(h=>h.ffTerm||0,"#fb7185",0.3, 1*lw2);
    if (visible.tgt) draw(h=>h.target,"#f59e0b",0.5, 1.5*lw2);
    if (visible.fol) draw(h=>h.follower,"#22d3ee",1, 1.5*lw2);
    if (visible.err) draw(h=>h.error*2,"#f43f5e",0.4, 1.5*lw2);

    ctx.restore();
  }, [history, width, height, view, panY, yScale, visible, scrollOffset, maximized, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const legendItem = (key, color, label, dim = false) => (
    <span key={key} onClick={() => toggle(key)} style={{ cursor: "pointer", opacity: visible[key] ? 1 : 0.3, transition: "opacity 0.15s" }}>
      <span style={{ color, opacity: dim ? 0.4 : 1 }}>■</span> {label}
    </span>
  );

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width, height, borderRadius: 4, background: "#0c0e14", border: "1px solid rgba(255,255,255,0.18)", display: "block", cursor: paused ? (dragging.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}/>
      <div style={{ position: "absolute", top: 3, right: 6, display: "flex", gap: 6, fontFamily: "monospace", fontSize: 14, color: "#666", flexWrap: "wrap", userSelect: "none", alignItems: "center" }}>
        {legendItem("tgt", "#f59e0b", "SetPt")}
        {legendItem("fol", "#22d3ee", "Fol")}
        {legendItem("err", "#f43f5e", "Err")}
        {legendItem("p", "#22d3ee", "P", true)}
        {legendItem("i", "#a78bfa", "I", true)}
        {legendItem("d", "#34d399", "D", true)}
        {legendItem("ff", "#fb7185", "FF", true)}
        {legendItem("n", "#888888", "N×1k", true)}
      </div>
      {paused && (
        <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 16, fontFamily: "monospace", fontSize: 14, color: "#556", pointerEvents: "none" }}>
          {scrollOffset > 0 && <span>-{(scrollOffset/60).toFixed(1)}s</span>}
          <span>WHEEL — Y ZOOM</span>
          <span>CTRL+WHEEL — X ZOOM</span>
          <span>DRAG — PAN</span>
        </div>
      )}
    </div>
  );
}

// --- Step Response ---
function StepResponse({ kp, ki, kd, mass, friction, loopDelay, gyroNoise, disturbance, width, height, compact = false }) {
  const W = width, H = height, SDT = DT, SDUR = 10, SSTEP = 50;
  // The simulation and its measurements are in sim.js, shared with the live loop.
  const res = stepResponse({ kp, ki, kd, mass, drag: friction, delayMs: loopDelay, noiseAmp: gyroNoise, disturbance }, SDUR, SSTEP);
  const tgt = SSTEP, steps = res.steps, dd = res.positions;
  const rs = res.riseStart, re = res.riseEnd, rT = res.rise, pkV = res.peak, pkT = res.peakTime;
  const bnd = res.band, stl = res.settle, os = res.overshoot, sse = res.ssError, div = res.diverged;
  let yMn=0,yMx=tgt;for(let i=0;i<steps;i++){if(dd[i]<yMn)yMn=dd[i];if(dd[i]>yMx)yMx=dd[i];}
  const yP=Math.max((yMx-yMn)*0.15,tgt*0.1);yMn-=yP;yMx+=yP;
  const tx=t=>(t/SDUR)*W, ty=v=>H-((v-yMn)/(yMx-yMn))*H;
  let pth="";for(let i=0;i<steps;i+=12){pth+=(i===0?"M":"L")+tx(i*SDT).toFixed(1)+","+ty(dd[i]).toFixed(1);}
  pth+="L"+tx((steps-1)*SDT).toFixed(1)+","+ty(dd[steps-1]).toFixed(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontSize:compact?15:18,letterSpacing:1.5,color:"#667"}}>STEP RESPONSE</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {div&&<span style={{fontSize:compact?13:16,color:"#f43f5e",fontWeight:700,whiteSpace:"nowrap"}}>⚠ UNSTABLE</span>}
          {/* On a phone there is no room for both, and the warning matters more. */}
          {!(compact&&div)&&<span style={{fontSize:compact?13:16,color:"#445",whiteSpace:"nowrap"}}>0→{SSTEP} · {SDUR}s</span>}
        </div>
      </div>
      <svg width={W} height={H} viewBox={"0 0 "+W+" "+H} style={{borderRadius:4,background:"#0c0e14",border:"1px solid rgba(255,255,255,0.18)",display:"block",flex:1}}>
        {[1,2,3,4,5,6,7,8,9].map(s=><line key={s} x1={tx(s)} y1={0} x2={tx(s)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
        <line x1={0} y1={ty(0)} x2={W} y2={ty(0)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3"/>
        <line x1={0} y1={ty(tgt)} x2={W} y2={ty(tgt)} stroke="rgba(245,158,11,0.4)" strokeWidth="1" strokeDasharray="5 3"/>
        <rect x={0} y={ty(tgt+bnd)} width={W} height={Math.max(0,ty(tgt-bnd)-ty(tgt+bnd))} fill="rgba(34,211,238,0.04)"/>
        {!isNaN(rT)&&rs>=0&&<rect x={tx(rs)} y={0} width={Math.max(0,tx(re)-tx(rs))} height={H} fill="rgba(52,211,153,0.05)"/>}
        {stl<SDUR&&<line x1={tx(stl)} y1={0} x2={tx(stl)} y2={H} stroke="rgba(167,139,250,0.3)" strokeWidth="1" strokeDasharray="3 3"/>}
        <path d={pth} fill="none" stroke={div?"#f43f5e":"#22d3ee"} strokeWidth="1.5"/>
        {os>0.5&&<circle cx={tx(pkT)} cy={ty(pkV)} r={2.5} fill="#f43f5e"/>}
        {[0,2,4,6,8,10].map(s=><text key={s} x={tx(s)} y={H-3} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="16" fontFamily="monospace">{s}s</text>)}
      </svg>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:6,textAlign:"center",fontFamily:"monospace"}}>
        {[
          ["Rise","#ccc",isNaN(rT)?"—":(rT*1000).toFixed(0)+"ms"],
          ["Overshoot","#ccc",os>0.5?os.toFixed(1)+"%":"0%"],
          ["Settle","#ccc",stl>=SDUR?">"+SDUR+"s":stl.toFixed(2)+"s"],
          ["SS Err","#ccc",sse.toFixed(2)],
        ].map(([l,c,v])=>(
          <div key={l}><span style={{fontSize:compact?12:14,color:"#556",letterSpacing:compact?0:1}}>{l}</span><br/><span style={{fontSize:compact?18:22,fontWeight:700,color:c}}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}

// --- Quadcopter 3/4 view with roll ---
function Quad({ rollAngle }) {
    // Drone coordinate system: X=right, Y=forward (into screen), Z=up
    // Camera: looking from left-rear-above toward the drone
    const camPitch = 0.5;  // radians, tilt down (~29deg)
    const camYaw = 0.4;    // radians, rotated to the left-rear (~23deg)
    const rollRad = (rollAngle * Math.PI) / 180;
    const arm = 34;

    // 4 motor positions in drone frame (X-config)
    // front-left, front-right, back-right, back-left
    const motors3D = [
      [-arm, arm, 0], [arm, arm, 0], [arm, -arm, 0], [-arm, -arm, 0]
    ];
    // Arrow tip (forward direction)
    const arrowTip = [0, arm + 10, 0];

    // Apply roll: rotation around Y (forward) axis
    // x' = x*cos - z*sin, z' = x*sin + z*cos
    const cosR = Math.cos(rollRad), sinR = Math.sin(rollRad);
    const applyRoll = ([x, y, z]) => [x*cosR - z*sinR, y, x*sinR + z*cosR];

    // Camera projection: first yaw (rotate around Z), then pitch (rotate around X)
    const cosY = Math.cos(camYaw), sinY = Math.sin(camYaw);
    const cosP = Math.cos(camPitch), sinP = Math.sin(camPitch);
    const project = ([x, y, z]) => {
      // Yaw: rotate in XY plane
      const x1 = x*cosY - y*sinY;
      const y1 = x*sinY + y*cosY;
      const z1 = z;
      // Pitch: rotate in YZ plane (tilt down)
      const y2 = y1*cosP - z1*sinP;
      const z2 = y1*sinP + z1*cosP;
      // Screen: X maps to screen X, Z2 (after pitch) maps to screen Y (inverted)
      return { sx: x1, sy: -z2, depth: y2 };
    };

    const rolledMotors = motors3D.map(applyRoll);
    const projMotors = rolledMotors.map(project);
    const rolledArrow = applyRoll(arrowTip);
    const projArrow = project(rolledArrow);
    const projCenter = project(applyRoll([0,0,0]));

    // Sort by depth for painter's algorithm
    const motorData = projMotors.map((p, i) => ({ i, ...p }));
    motorData.sort((a, b) => a.depth - b.depth);

    // Disc ellipse sizes (perspective foreshortening)
    const discR = 11;

    return (
      <svg width="130" height="110" viewBox="-65 -55 130 110">
        {/* Arms - draw far ones first */}
        {[[0,2],[1,3]].map(([a,b], idx) => {
          const avgDepth = (projMotors[a].depth + projMotors[b].depth) / 2;
          return { a, b, avgDepth, idx };
        }).sort((a,b) => a.avgDepth - b.avgDepth).map(({a, b, idx}) => (
          <line key={idx} x1={projMotors[a].sx} y1={projMotors[a].sy} x2={projMotors[b].sx} y2={projMotors[b].sy} stroke="#556" strokeWidth="2.5" strokeLinecap="round"/>
        ))}
        {/* Center body */}
        <ellipse cx={projCenter.sx} cy={projCenter.sy} rx="7" ry="5" fill="#333" stroke="#778" strokeWidth="1.5"/>
        {/* Motors sorted by depth */}
        {motorData.map(({ i, sx, sy }) => (
          <g key={i}>
            <ellipse cx={sx} cy={sy} rx={discR} ry={discR * 0.55} fill="none" stroke={i < 2 ? "#f43f5e44" : "#22d3ee44"} strokeWidth="1.5"/>
            <circle cx={sx} cy={sy} r="3.5" fill={i < 2 ? "#f43f5e" : "#22d3ee"} opacity="0.8"/>
          </g>
        ))}
      </svg>
    );
}

// Below this content width the controls stop fitting in one row with room left for the scope,
// so the app switches to the stacked (phone) layout. 676 px of content = a 700 px container.
const COMPACT_BELOW = 676;

const quadBoxStyle = { background: "#1a1e28", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };

// --- Main App ---
// onLayoutChange("compact" | "full") tells the host which layout is in use, so it can let the
// container's height follow the content in the compact one.
function PIDDemo({ onLayoutChange }) {
  const [kp, setKp] = useState(7.9);
  const [ki, setKi] = useState(1.75);
  const [kd, setKd] = useState(3.8);
  const [kff, setKff] = useState(1.0);
  const [targetPos, setTargetPos] = useState(0);
  const [followerPos, setFollowerPos] = useState(0);
  const [mass, setMass] = useState(1.0);
  const [drag, setDrag] = useState(0.10);
  const [loopDelay, setLoopDelay] = useState(15);
  const [gyroNoiseSlider, setGyroNoiseSlider] = useState(5);
  const gyroNoise = gyroNoiseSlider / 1000;
  const [disturbance, setDisturbance] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scopeYScale, setScopeYScale] = useState(150);
  const [scopeMaximized, setScopeMaximized] = useState(false);

  // The simulation lives in a ref and is stepped by the loop below. The loop reads the current
  // settings from these refs, so changing a setting or moving the setpoint never restarts it.
  const runRef = useRef(null);
  if (!runRef.current) runRef.current = createRunner(0);
  const paramsRef = useRef(null);
  paramsRef.current = { kp, ki, kd, kff, mass, drag, delayMs: loopDelay, noiseAmp: gyroNoise, disturbance };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [motorHeat, setMotorHeat] = useState(0);
  const historyRef = useRef([]);
  const [history, setHistory] = useState([]);
  const [rollAngle, setRollAngle] = useState(0);
  const trackRef = useRef(null);
  const draggingHandle = useRef(false);
  const targetRawRef = useRef(0); // raw mouse position, smoothed into targetPos

  // Measure the app's own container — works correctly when embedded in a page
  const appRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 700 });
  useEffect(() => {
    if (!appRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(appRef.current);
    return () => obs.disconnect();
  }, []);

  // Two layouts. Full: everything fits in the container's height, as on a desktop. Compact
  // (narrow containers, i.e. phones): the panels are stacked at fixed heights, the app is as
  // tall as its content, and the page scrolls.
  const compact = dims.w < COMPACT_BELOW;
  useEffect(() => { if (onLayoutChange) onLayoutChange(compact ? "compact" : "full"); }, [compact, onLayoutChange]);

  const contentW = compact ? dims.w : Math.min(dims.w - 32, 900);

  // Full layout: scale all fixed-size elements proportionally to the container height.
  // Design height 780px = what the app should look like at full size.
  // At smaller container heights everything shrinks to fit.
  // Compact layout: height is not limited, so only shrink on screens narrower than 300 px.
  const scale = compact ? Math.min(1.0, Math.max(0.6, dims.w / 300)) : Math.min(1.0, Math.max(0.5, dims.h / 780));
  const knobSize = Math.round(52 * scale);
  const sliderH = Math.round(68 * scale);
  const trackH = compact ? 60 : Math.round(55 * scale);
  const motorHeatW = Math.round(72 * scale);

  // Budget remaining height for step chart, reserving space for all other fixed elements.
  // Controls row ~120px, track row ~85px, scope header ~22px, gaps ~25px, padding ~12px.
  const fixedOverhead = Math.round((120 + 85 + 22 + 25 + 12) * scale);
  const stepH = compact ? 130 : Math.max(60, Math.round((dims.h - fixedOverhead) * 0.30));
  const scopeContainerW = contentW - motorHeatW - 6; // 6 = gap
  const compactScopeH = 252; // container height that gives a 222 px plot

  // Compact-layout variations of the controls: each box fills a row, text is smaller so five
  // sliders fit across a phone, and the buttons sit side by side with taller touch targets.
  const boxFullRow = { flex: "1 1 100%" };
  const rowSpread = { width: "100%", justifyContent: "space-evenly" };
  const knobText = compact ? { labelSize: Math.round(16 * scale), valueSize: Math.round(17 * scale) } : null;
  const sliderText = compact ? { labelSize: Math.round(13 * scale), valueSize: Math.round(15 * scale) } : null;
  const buttonFont = Math.round((compact ? 13 : 14) * scale);
  const buttonPad = compact ? "9px 4px" : "4px 10px";
  const buttonGrow = compact ? { flex: 1 } : null;

  // Measure scope container to auto-size scope canvas
  const scopeContainerRef = useRef(null);
  const [scopeDims, setScopeDims] = useState({ w: 400, h: 100 });
  useEffect(() => {
    const measure = () => {
      const el = scopeContainerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setScopeDims({ w: Math.max(100, Math.floor(r.width - 18)), h: Math.max(40, Math.floor(r.height - 30)) });
      }
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (scopeContainerRef.current) obs.observe(scopeContainerRef.current);
    return () => obs.disconnect();
  }, [dims]);

  // PID loop. Each frame runs as many fixed-size simulation steps as the elapsed time calls
  // for (see sim.js), then copies the result into React state for drawing.
  useEffect(() => {
    let lastTime = performance.now();
    let frame = null;
    const rand = () => Math.random() * 2 - 1;
    const addSample = (sample) => { historyRef.current.push(sample); };
    const tick = (now) => {
      const elapsed = (now - lastTime) / 1000; lastTime = now;
      if (!pausedRef.current) {
        const run = runRef.current;
        const before = historyRef.current.length;
        const steps = advance(run, paramsRef.current, targetRawRef.current, elapsed, rand, addSample);
        if (steps > 0) {
          setTargetPos(run.target);
          setFollowerPos(run.sim.position);
          setMotorHeat(run.sim.heat);
          setRollAngle(run.roll);
        }
        if (historyRef.current.length !== before) {
          if (historyRef.current.length > HISTORY_BUFFER) historyRef.current = historyRef.current.slice(-HISTORY_BUFFER);
          setHistory([...historyRef.current]);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const handlePointerDown = useCallback((e) => { draggingHandle.current = true; e.target.setPointerCapture(e.pointerId); updateTarget(e); }, []);
  const handlePointerMove = useCallback((e) => { if (draggingHandle.current) updateTarget(e); }, []);
  const handlePointerUp = useCallback(() => { draggingHandle.current = false; }, []);
  const updateTarget = (e) => { const r = trackRef.current?.getBoundingClientRect(); if (!r) return; targetRawRef.current = Math.max(-100, Math.min(100, ((e.clientX - r.left) / r.width) * 200 - 100)); };

  // Restart the simulation with the follower sitting on the setpoint.
  const restartAt = (position) => {
    runRef.current = createRunner(position);
    setTargetPos(position); setFollowerPos(position);
    setMotorHeat(0); setRollAngle(0);
    historyRef.current = []; setHistory([]);
  };

  const resetSystem = () => restartAt(runRef.current.target);

  const resetAll = () => {
    setKp(7.9); setKi(1.75); setKd(3.8); setKff(1.0);
    setMass(1.0); setDrag(0.10); setLoopDelay(15); setGyroNoiseSlider(5);
    setDisturbance(0); targetRawRef.current = 0;
    restartAt(0);
    setPaused(false);
    setScopeYScale(150);
  };

  const targetPx = ((targetPos/100+1)/2)*100;
  const followerPx = ((followerPos/100+1)/2)*100;
  const heatNorm = Math.min(1, motorHeat / 6);
  const heatColor = heatNorm < 0.3 ? "#34d399" : heatNorm < 0.6 ? "#f59e0b" : "#f43f5e";

  // Motor Heat vertical gauge
  const heatGauge = (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#221610,#16100c)",border:`1px solid ${heatColor}44`,borderRadius:8,padding:"4px 10px",width:motorHeatW,flexShrink:0,fontSize:Math.round(12*scale)}}>
      <span style={{fontFamily:"monospace",fontSize:Math.round(12*scale),color:"#664433",letterSpacing:1,textAlign:"center",marginBottom:4}}>MOTOR<br/>HEAT</span>
      <div style={{position:"relative",width:14,flex:1,minHeight:20,background:"#0c0e14",borderRadius:4,border:"1px solid rgba(255,255,255,0.04)",overflow:"hidden"}}>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${heatNorm*100}%`,background:heatColor,borderRadius:3,boxShadow:heatNorm>0.6?`0 0 6px ${heatColor}88`:"none"}}/>
      </div>
      <span style={{fontFamily:"monospace",fontSize:Math.round(18*scale),fontWeight:700,color:heatColor,marginTop:4}}>
        {heatNorm < 0.3 ? "OK" : heatNorm < 0.6 ? "WARM" : heatNorm < 0.85 ? "HOT" : "BURN"}
      </span>
      <span style={{fontFamily:"monospace",fontSize:Math.round(18*scale),fontWeight:600,color:"#bbb",marginTop:2}}>
        {motorHeat.toFixed(2)}
      </span>
    </div>
  );

  // Maximized scope
  const maxScopeW = dims.w - 40;
  // In the compact layout the container has no height of its own, so size to the screen.
  const maxScopeH = compact ? Math.max(200, Math.min(520, window.innerHeight - 120)) : dims.h - 50;

  if (scopeMaximized) {
    return (
      <div style={{
        height: compact ? "auto" : "100%", width: "100%", overflow: "hidden",
        background: "#08090c", color: "#e0e4ec",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, boxSizing: "border-box",
      }}>
        <div style={{ width: maxScopeW + 20, height: maxScopeH + 40, background: "#1a1e28", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 10px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 18, letterSpacing: 1.5, color: "#667" }}>SCOPE</span>
            <span onClick={() => setScopeMaximized(false)} style={{cursor:"pointer",fontSize:20,color:"#888",lineHeight:1,userSelect:"none"}} title="Restore">⊖</span>
          </div>
          <div style={{ flex: 1 }}>
            <Scope history={history} width={maxScopeW} height={maxScopeH} paused={paused} yScale={scopeYScale} onYScaleChange={setScopeYScale} maximized={true}/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={appRef} style={{
      height: compact ? "auto" : "100%", width: "100%", overflow: compact ? "visible" : "hidden",
      background: "#08090c", color: "#e0e4ec",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: compact ? "8px 12px" : `${Math.round(4*scale)}px 12px`, boxSizing: "border-box", gap: compact ? 8 : Math.round(4*scale),
    }}>
      {/* Controls Row. In the compact layout each box takes a full row. */}
      <div style={{ display: "flex", gap: compact ? 8 : 10, flexWrap: "wrap", justifyContent: "center", alignItems: "stretch", ...(compact ? { width: contentW } : null) }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "#1a1e28", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "4px 10px", ...(compact ? boxFullRow : null) }}>
          <span style={{ fontFamily: "monospace", fontSize: Math.round(14*scale), fontWeight: 700, color: "#22d3ee", letterSpacing: 2, marginBottom: 2 }}>PID GAINS</span>
          <div style={{ display: "flex", gap: 8, ...(compact ? rowSpread : null) }}>
            <Knob label="P" value={kp} min={0} max={30} step={0.1} onChange={setKp} color="#22d3ee" size={knobSize} defaultValue={7.9} {...knobText}/>
            <Knob label="I" value={ki} min={0} max={5} step={0.05} onChange={setKi} color="#a78bfa" size={knobSize} defaultValue={1.75} {...knobText}/>
            <Knob label="D" value={kd} min={0} max={15} step={0.05} onChange={setKd} color="#34d399" size={knobSize} defaultValue={3.8} {...knobText}/>
            <Knob label="FF" value={kff} min={0} max={2} step={0.01} onChange={setKff} color="#fb7185" size={knobSize} defaultValue={1.0} {...knobText}/>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(180deg,#221c14,#16130e)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "4px 6px", ...(compact ? boxFullRow : null) }}>
          <span style={{ fontFamily: "monospace", fontSize: Math.round(14*scale), fontWeight: 700, color: "#e8a030", letterSpacing: 2, marginBottom: 2 }}>PHYSICS</span>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", ...(compact ? rowSpread : null) }}>
            <VSlider label="MASS" value={mass} min={0.1} max={5} step={0.1} onChange={setMass} color="#e8a030" height={sliderH} defaultValue={1.0} {...sliderText}/>
            <VSlider label="DRAG" value={drag} min={0.1} max={1.0} step={0.01} onChange={setDrag} color="#c87830" height={sliderH} defaultValue={0.10} {...sliderText}/>
            <VSlider label="DELAY" value={loopDelay} min={0} max={50} step={1} onChange={setLoopDelay} color="#a06020" height={sliderH} defaultValue={15} {...sliderText}/>
            <VSlider label="NOISE" value={gyroNoiseSlider} min={1} max={20} step={1} onChange={setGyroNoiseSlider} color="#886030" height={sliderH} defaultValue={5} {...sliderText}/>
            <VSlider label="CG" value={disturbance} min={-50} max={50} step={1} onChange={setDisturbance} color="#d4882a" height={sliderH} defaultValue={0} {...sliderText}/>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: compact ? "row" : "column", gap: compact ? 6 : 4, justifyContent: "center", ...(compact ? boxFullRow : null) }}>
          <button onClick={() => setPaused(p => !p)} style={{
            fontFamily:"inherit",fontSize:buttonFont,letterSpacing:1,fontWeight:700,
            color: paused ? "#f59e0b" : "#34d399",
            background: paused ? "rgba(245,158,11,0.1)" : "rgba(52,211,153,0.1)",
            border: `1px solid ${paused ? "rgba(245,158,11,0.2)" : "rgba(52,211,153,0.2)"}`,
            borderRadius:4,padding:buttonPad,cursor:"pointer",whiteSpace:"nowrap",...buttonGrow,
          }}>{paused ? "RESUME" : "PAUSE"}</button>
          <button onClick={resetSystem} style={{
            fontFamily:"inherit",fontSize:buttonFont,letterSpacing:1,
            color:"#a78bfa",background:"rgba(167,139,250,0.1)",
            border:"1px solid rgba(167,139,250,0.2)",
            borderRadius:4,padding:buttonPad,cursor:"pointer",whiteSpace:"nowrap",...buttonGrow,
          }}>RESET SIM</button>
          <button onClick={resetAll} style={{
            fontFamily:"inherit",fontSize:buttonFont,letterSpacing:1,
            color:"#f43f5e",background:"rgba(244,63,94,0.1)",
            border:"1px solid rgba(244,63,94,0.2)",
            borderRadius:4,padding:buttonPad,cursor:"pointer",whiteSpace:"nowrap",...buttonGrow,
          }}>RESET ALL</button>
        </div>
      </div>

      {/* Step Response (full width) */}
      <div style={{ width: contentW, background: "#1a1e28", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 10px" }}>
        <StepResponse kp={kp} ki={ki} kd={kd} mass={mass} friction={drag} loopDelay={loopDelay} gyroNoise={gyroNoise} disturbance={disturbance} width={contentW - 20} height={stepH} compact={compact}/>
      </div>

      {/* Track + Quadcopter (in the compact layout the quadcopter moves to the last row) */}
      <div style={{ display: "flex", gap: 6, width: contentW }}>
        {/* Track / Handle+Follower */}
        <div style={{ flex: 1, background: "#1a1e28", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "6px 10px" }}>
          <div ref={trackRef} style={{ position: "relative", height: trackH, background: "#0c0e14", borderRadius: 5, cursor: "pointer", touchAction: "none", overflow: "hidden" }}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"rgba(255,255,255,0.06)"}}/>
            {Array.from({length:21},(_,i)=><div key={i} style={{position:"absolute",left:`${(i/20)*100}%`,bottom:0,width:1,height:i%5===0?10:5,background:`rgba(255,255,255,${i%5===0?0.1:0.04})`}}/>)}
            <div style={{position:"absolute",left:`${followerPx}%`,top:0,bottom:0,width:3,marginLeft:-1.5,background:"#22d3ee",borderRadius:1,boxShadow:"0 0 8px rgba(34,211,238,0.4)"}}/>
            <div onDoubleClick={(e) => { e.stopPropagation(); targetRawRef.current = 0; runRef.current.target = 0; setTargetPos(0); }} style={{position:"absolute",left:`${targetPx}%`,top:"50%",transform:"translate(-50%,-50%)",width:22,height:22,borderRadius:"50%",background:"radial-gradient(circle at 40% 35%,#f59e0b,#b45309)",border:"2px solid rgba(255,255,255,0.15)",boxShadow:"0 0 10px rgba(245,158,11,0.4)",cursor:"grab",zIndex:10}}/>
          </div>
          {compact ? (
            // Three columns with the value under its label: the one-line form is too wide for a phone.
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",marginTop:4,fontSize:Math.round(15*scale),textAlign:"center"}}>
              <span>Setpoint<br/><span style={{color:"#f59e0b"}}>{targetPos.toFixed(1)}</span></span>
              <span>Follower<br/><span style={{color:"#22d3ee"}}>{followerPos.toFixed(1)}</span></span>
              <span>Error<br/><span style={{color:"#f43f5e"}}>{(targetPos-followerPos).toFixed(1)}</span></span>
            </div>
          ) : (
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:Math.round(18*scale),alignItems:"center"}}>
              <span>Setpoint: <span style={{color:"#f59e0b"}}>{targetPos.toFixed(1)}</span></span>
              <span>Follower: <span style={{color:"#22d3ee"}}>{followerPos.toFixed(1)}</span></span>
              <span>Error: <span style={{color:"#f43f5e"}}>{(targetPos-followerPos).toFixed(1)}</span></span>
            </div>
          )}
        </div>

        {!compact && <div style={{ width: 140, minHeight: 120, ...quadBoxStyle }}><Quad rollAngle={rollAngle}/></div>}
      </div>

      {/* Scope + Motor Heat (in the compact layout the scope has a fixed height and the gauge
          moves to the last row) */}
      <div style={{ display: "flex", gap: 6, width: contentW, ...(compact ? { height: compactScopeH, flex: "none" } : { flex: 1, minHeight: 0 }) }}>
        <div ref={scopeContainerRef} style={{ flex:1, background:"#1a1e28", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, padding:"5px 8px", display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <span style={{fontSize:16,letterSpacing:1.5,color:"#667"}}>SCOPE</span>
            <span onClick={() => { setScopeMaximized(true); setPaused(true); }} style={{cursor:"pointer",fontSize:18,color:"#888",lineHeight:1,userSelect:"none"}} title="Maximize">⊕</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Scope history={history} width={scopeDims.w} height={scopeDims.h} paused={paused} yScale={scopeYScale} onYScaleChange={setScopeYScale} maximized={false}/>
          </div>
        </div>
        {!compact && heatGauge}
      </div>

      {/* Compact layout only: quadcopter and motor heat share the last row */}
      {compact && (
        <div style={{ display: "flex", gap: 6, width: contentW }}>
          <div style={{ flex: 1, minHeight: 120, ...quadBoxStyle }}><Quad rollAngle={rollAngle}/></div>
          {heatGauge}
        </div>
      )}
    </div>
  );
}


export default PIDDemo;
