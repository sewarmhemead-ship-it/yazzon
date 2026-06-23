/* ════════════════════════════════════════════════════════════════════
   YAZZOON — main.js
   Kinematische Reise durch die Welt des Geschmacks.
   ────────────────────────────────────────────────────────────────────
   IDEE
     • Das Logo erscheint. Beim Scrollen fliegt die Kamera durch das "O"
       (einen leuchtenden Portal-Ring) in einen Korridor aus schwebenden
       Foto-Tafeln der echten Gerichte (Wix-Bilder als WebGL-Texturen).
     • MONOCHROM (Schwarz/Weiß). Die Fotos sind standardmäßig in
       Graustufen; beim Hover färben sie sich (interaktiv) und werden
       größer — eine kinematische, interaktive Reise, kein klassisches
       Restaurant-Menü.
     • Die "Tageszeit" verändert nur Helligkeit/Nebel (kein Farbton).

   TUNING (hier anpassen):
     • CAMERA_PATH  → Flugweg der Kamera (durch den Ring in den Korridor).
     • IMAGES       → Reihenfolge/Beschriftung der Foto-Tafeln.
     • STAGES       → Graustufen-Stimmung je Abschnitt (bg/fog/Helligkeit).
     • CHAPTER_AT   → Scroll-Fortschritt der vier Kapitel.
   HINWEIS: über HTTP starten (node serve.mjs) — file:// blockiert Module.
   ════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

/* ── Einstellungen ─────────────────────────────────────────────────── */
const REDUCED   = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = matchMedia('(max-width: 768px)').matches;
const PARTICLE_COUNT = IS_MOBILE ? 1200 : 3500;
const EASE = 0.07;

/* ── PERFORMANCE-Tuning ─────────────────────────────────────────────────
   Die Foto-Tafeln sind nie größer als ~halber Bildschirm → volle
   Wix-Originale (bis ~3 MB) sind reine Verschwendung. Wir lassen Wix die
   Bilder serverseitig verkleinern + per enc_auto als WebP/AVIF ausliefern
   (≈10–30× kleiner). MAX_DPR deckelt die Render-Auflösung.            */
const MAX_DPR = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2);
const TEX_W   = IS_MOBILE ? 640 : 900;   // Zielbreite der Foto-Texturen (px)
const TEX_Q   = 80;                       // Bildqualität (1–100)

// Kinematische Zusatz-Ebenen — einfache Schalter zum Ausprobieren/Entfernen.
// Reine Deko im 3D-Raum: berühren NICHT die Scroll-/Kamera-/Foto-Logik.
const FX = {
  godRays:   true,   // schräge Lichtschächte im Korridor
  ghostType: true,   // schwebende, schwach sichtbare Wörter (Tiefe & Seele)
  finale:    true,   // Schluss: Kamera zurück → Tafeln formen einen "O"-Ring + Wortmarke
};

// "Tageszeiten": nur Helligkeit/Nebel ändern sich. Der Nebel hält sich an
// die dunkle Hintergrund-Palette (Anthrazit mit Hauch Weinrot), damit die
// Foto-Tafeln nahtlos in den CSS-Hintergrund überblenden.
const STAGES = [
  { fog: 0x171019, lightInt: 1.5,  exposure: 1.12 }, // Dämmerung
  { fog: 0x141014, lightInt: 1.6,  exposure: 1.06 }, // Mittag
  { fog: 0x100d10, lightInt: 1.3,  exposure: 1.00 }, // Abend
  { fog: 0x0b0a0d, lightInt: 1.05, exposure: 0.94 }, // Nacht
];
const CHAPTER_AT = [0.10, 0.24, 0.38, 0.52];

// Foto-Tafeln (echte Wix-Bilder) + Unsplash-Fallback + deutscher Titel + Beschreibung (Klick-Fokus)
const IMAGES = [
  { u:'68f568_94088424872e422b9b425a9825689ad6', t:'Orientalischer Brunch', f:'photo-1540713434306-58505cf1b6fc', d:'Ein Tisch voller Farben — Mezze, Aufstriche, Eier und frisches Fladenbrot. Der Morgen im Orient, mitten in Salzburg.' },
  { u:'68f568_853305f09ecf4e87bd0e399a804c7167', t:'Crazy Hummus',          f:'photo-1577805947697-89e18249d767', d:'Cremiger Hummus, neu gedacht — geröstete Aromen, ein Hauch Schärfe und bestes Olivenöl.' },
  { u:'68f568_b26c6d5ed44848abb810dd2aa5a20281', t:'Levantinische Vorspeise', f:'photo-1601050690597-df0568f70950', d:'Kleine Vorspeisen aus der Levante — zum Teilen gemacht, voller Charakter.' },
  { u:'68f568_44cfea0a1fe84ecbbddd5862d37f4b5b', t:'Hausgemachte Mezze',    f:'photo-1542528180-a1208c5169a5', d:'Täglich frisch zubereitete Mezze — die Seele der orientalischen Tafel.' },
  { u:'68f568_b52684410d714a7194807f76e618c35d', t:'Vegetarische Auswahl',  f:'photo-1512621776951-a57141f2eefd', d:'Gemüse im Mittelpunkt: leicht, würzig und voller Frische.' },
  { u:'68f568_a6d7939e8ad44c70b543aa323e056a52', t:'Frisch zubereitet',     f:'photo-1547058430-a2c5d4f5d3f0', d:'Alles aus der offenen Küche — in genau diesem Moment für dich gemacht.' },
  { u:'68f568_56caa2554ad3421aa1c319f4cef154a5', t:'Falafel',               f:'photo-1529059997568-3d847b1154f0', d:'Goldbraun und knusprig, innen kräuterzart — ein Klassiker, perfektioniert.' },
  { u:'68f568_3b41372b0edd49ff8e0790c4b535c6d2', t:'Saftiges Steak',        f:'photo-1546964124-0cce460f38ef', d:'Fleisch von der Fleischhauerei Kriechbaum am Lochen — über Feuer zur Vollendung gebracht.' },
  { u:'68f568_58328dee341342588f9390be86bbf4a9', t:'Orientalische Aromen',  f:'photo-1533089860892-a7c6f0a88666', d:'Gewürze aus dem Süden, die Geschichten erzählen — Kreuzkümmel, Sumach, Za’atar.' },
  { u:'68f568_0b699c7a4dcd4024a8fe02d3b9f5adea', t:'Geteilte Vielfalt',     f:'photo-1606914469633-bd39206ea739', d:'Gemacht zum Teilen — viele kleine Gerichte, ein großer gemeinsamer Moment.' },
  { u:'68f568_d5c4144df7b54e8aabdcc4ff3fa572ea', t:'Levantinischer Genuss', f:'photo-1574484284002-952d92456975', d:'Syrien und Libanon auf einem Teller — Crossover-Küche mit Charakter.' },
  { u:'68f568_f67dc7dd02544e68ace5f937e027a2f6', t:'Signature Cocktail',    f:'photo-1551024601-bec78aea704b', d:'Unsere Bar bei Nacht: außergewöhnliche Drinks für lange Salzburger Stunden.' },
  { u:'68f568_fcc180e6819b407c9f01e48d7e18859c', t:'Die große Tafel',       f:'photo-1517248135467-4c7edcad34c4', d:'Wenn alles zusammenkommt — die große YAZZOON-Tafel, der Höhepunkt der Reise.' },
];
// fit = Seitenverhältnis bleibt erhalten (buildGallery liest die echten
// Bildmaße); enc_auto = Wix liefert je nach Browser WebP/AVIF.
const wixURL = id => `https://static.wixstatic.com/media/${id}~mv2.jpg/v1/fit/w_${TEX_W},h_${TEX_W},q_${TEX_Q},enc_auto/file.jpg`;
const unsplashURL = id => `https://images.unsplash.com/${id}?w=${TEX_W}&q=${TEX_Q}&auto=format`;

// Kamerapfad: vom Hero (z+) durch den Ring (z≈6) in den Foto-Korridor (z−)
const CAMERA_PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3( 0.0,  0.4,  22.0),
  new THREE.Vector3( 0.0,  0.2,  12.0),
  new THREE.Vector3( 0.0,  0.0,   6.0),   // Durchflug durch das "O"
  new THREE.Vector3(-1.6,  0.5,  -3.0),
  new THREE.Vector3( 1.8, -0.4, -16.0),
  new THREE.Vector3(-1.8,  0.6, -30.0),
  new THREE.Vector3( 1.4,  0.0, -46.0),
  new THREE.Vector3( 0.0,  0.2, -62.0),
], false, 'catmullrom', 0.3);

/* ── DOM ───────────────────────────────────────────────────────────── */
const canvas     = document.getElementById('bg');
const loaderEl   = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct  = document.getElementById('loaderPct');
const chapterEls = [...document.querySelectorAll('#chapters li')];
const giantWords = [...document.querySelectorAll('#giantWords span')];
const scrollHint = document.getElementById('scrollHint');
const captionEl  = document.getElementById('photoCaption');
const coldOpenEl = document.getElementById('coldOpen');

// Intro-Schleier sofort aktivieren (unter dem Loader verborgen) → kein Aufblitzen
// des Heros, bevor der Cold Open läuft. Bei reduzierter Bewegung übersprungen.
if (!REDUCED) document.body.classList.add('is-intro');

/* ════════════════════════════════════════════════════════════════════
   RENDERER / SZENE / KAMERA
   ════════════════════════════════════════════════════════════════════ */
// alpha:true → der Canvas ist transparent, der animierte CSS-Gradient-Mesh
// (Anthrazit + Weinrot + gedämpftes Gold) scheint hindurch.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: true });
renderer.setPixelRatio(MAX_DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = STAGES[0].exposure;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.FogExp2(STAGES[0].fog, 0.024);

// Mobil (Hochformat) ist das horizontale Sichtfeld sehr schmal → weiteres
// FOV, damit die seitlichen Foto-Tafeln im Bild bleiben statt am Rand zu kleben.
const camera = new THREE.PerspectiveCamera(IS_MOBILE ? 68 : 58, innerWidth/innerHeight, 0.1, 120);
camera.position.copy(CAMERA_PATH.getPointAt(0));

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, STAGES[0].lightInt);
keyLight.position.set(4, 8, 6);
scene.add(keyLight);

/* ── Hinweis: Das "Portal" ist das echte "O" der HTML-Überschrift.
   Der Durchflug wird per CSS-Transform (setupPortal) erzeugt, nicht im 3D. ── */

/* ════════════════════════════════════════════════════════════════════
   DAMPF / STAUB im Korridor — feiner weißer Nebelflug für Tiefe.
   Weiche, additive Punkte treiben langsam nach oben durch den Foto-
   Korridor. Sie gehorchen dem Fog (fog:true) → ferne Partikel verblassen,
   nahe klären sich auf (Tiefen-Nebel). Monochrom, dezent, vom Bloom
   sanft zum Glühen gebracht.
   ════════════════════════════════════════════════════════════════════ */
let steam = null;
function makeSoftSprite(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32,32,0, 32,32,32);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25,'rgba(255,255,255,0.5)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0,0,64,64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildSteam(){
  if (REDUCED) return;                         // bei reduzierter Bewegung kein Flug
  const N = IS_MOBILE ? 70 : 220;
  const pos   = new Float32Array(N*3);
  const baseX = new Float32Array(N);
  const seed  = new Float32Array(N);
  const spd   = new Float32Array(N);
  for (let i=0;i<N;i++){
    const x = (Math.random()-0.5)*13;
    pos[i*3]   = x;
    pos[i*3+1] = (Math.random()-0.5)*9.2;
    pos[i*3+2] = 2 - Math.random()*70;         // entlang des gesamten Korridors
    baseX[i] = x; seed[i] = Math.random()*6.2831; spd[i] = 0.12 + Math.random()*0.22;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({
    map: makeSoftSprite(), color:0xffffff, size: IS_MOBILE ? 0.5 : 0.72,
    sizeAttenuation:true, transparent:true, opacity:0.22,
    depthWrite:false, blending:THREE.AdditiveBlending, fog:true,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  steam = { pts, pos, baseX, seed, spd, N };
}
function updateSteam(dt, t){
  if (!steam) return;
  const { pos, baseX, seed, spd, N } = steam;
  for (let i=0;i<N;i++){
    let y = pos[i*3+1] + spd[i]*dt;             // langsam nach oben treiben
    if (y > 4.7) y = -4.7;                       // oben austreten → unten neu eintreten
    pos[i*3+1] = y;
    pos[i*3]   = baseX[i] + Math.sin(t*0.5 + seed[i])*0.35;   // sanftes seitliches Wehen
  }
  steam.pts.geometry.attributes.position.needsUpdate = true;
}

/* ════════════════════════════════════════════════════════════════════
   LICHTSCHÄCHTE (God Rays) — schräge, additive Lichtbänder, die den
   Korridor durchschneiden. Reine Deko (kein Logik-Eingriff). Vom Bloom
   sanft verstärkt; pulsieren leicht wie lebendiges Licht.
   ── Zum Entfernen: FX.godRays = false (oder diesen Block löschen). ──
   ════════════════════════════════════════════════════════════════════ */
let godRays = null;
function makeBeamTexture(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0,0,64,0);             // Breite des Strahls
  grd.addColorStop(0.0,'rgba(255,255,255,0)');
  grd.addColorStop(0.5,'rgba(255,255,255,0.9)');
  grd.addColorStop(1.0,'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0,0,64,256);
  g.globalCompositeOperation = 'destination-in';            // oben/unten weich auslaufen
  const vg = g.createLinearGradient(0,0,0,256);
  vg.addColorStop(0.0,'rgba(0,0,0,0)');
  vg.addColorStop(0.5,'rgba(0,0,0,1)');
  vg.addColorStop(1.0,'rgba(0,0,0,0)');
  g.fillStyle = vg; g.fillRect(0,0,64,256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildGodRays(){
  if (!FX.godRays) return;
  const tex = makeBeamTexture();
  const grp = new THREE.Group();
  const defs = [
    { z:-6,  x:-3.0, rot: 0.50, w:5, h:16, o:0.10 },
    { z:-16, x: 3.0, rot:-0.60, w:6, h:18, o:0.09 },
    { z:-28, x:-2.0, rot: 0.42, w:5, h:16, o:0.08 },
    { z:-42, x: 2.5, rot:-0.52, w:6, h:18, o:0.09 },
    { z:-55, x:-1.0, rot: 0.55, w:5, h:16, o:0.08 },
  ];
  godRays = [];
  for (const d of defs){
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w, d.h),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:d.o,
        depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false })
    );
    m.position.set(d.x, 1.2, d.z);
    m.rotation.z = d.rot; m.rotation.y = 0.3;
    grp.add(m);
    godRays.push({ m, base:d.o, seed:Math.random()*6.2831 });
  }
  scene.add(grp);
}
function updateGodRays(t){
  if (!godRays) return;
  for (const r of godRays){
    r.m.material.opacity = r.base * (0.7 + 0.3*Math.sin(t*0.6 + r.seed));   // sanftes Pulsieren
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCHWEBENDE TYPOGRAFIE (Ghost Type) — sehr schwach sichtbare Wörter
   (deutsch + arabisch) treiben in der Peripherie des Korridors vorbei
   und geben Tiefe & Seele. Reine Deko (kein Logik-Eingriff).
   ── Zum Entfernen: FX.ghostType = false (oder diesen Block löschen). ──
   ════════════════════════════════════════════════════════════════════ */
let ghostType = null;
function makeTextTexture(text, font){
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 160;
  ctx.font = `${fs}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + 60;
  c.width  = THREE.MathUtils.ceilPowerOfTwo(w);
  c.height = 256;
  ctx.font = `${fs}px ${font}`;                 // nach Canvas-Resize neu setzen
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width/2, c.height/2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}
function buildGhostType(){
  if (!FX.ghostType) return;
  const words = [
    { t:'ORIENT',    f:'"Playfair Display", serif' },
    { t:'مَزة',       f:'"Cairo", sans-serif' },
    { t:'seit 2024', f:'"Space Mono", monospace' },
    { t:'LEVANTE',   f:'"Playfair Display", serif' },
    { t:'ضِيافة',     f:'"Cairo", sans-serif' },
    { t:'SALZBURG',  f:'"Space Mono", monospace' },
    { t:'FUSION',    f:'"Playfair Display", serif' },
  ];
  ghostType = new THREE.Group();
  words.forEach((wd, i) => {
    const { tex, aspect } = makeTextTexture(wd.t, wd.f);
    const h = 2.2, w = h * aspect;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:0.07,
        depthWrite:false, fog:true, side:THREE.DoubleSide })
    );
    const side = i % 2 ? 1 : -1;
    // weit außen in der Peripherie (hinter den Foto-Tafeln) → nur angedeutet
    m.position.set(side*(5.5 + Math.random()*2.2), (Math.random()-0.5)*5, -8 - i*7.5);
    m.rotation.y = -side*0.5;
    m.userData = { bobSeed: Math.random()*6.2831, baseY: m.position.y };
    ghostType.add(m);
  });
  scene.add(ghostType);
}
function updateGhostType(t){
  if (!ghostType) return;
  for (const m of ghostType.children){
    m.position.y = m.userData.baseY + Math.sin(t*0.3 + m.userData.bobSeed)*0.18;  // träges Schweben
  }
}

/* ════════════════════════════════════════════════════════════════════
   FOTO-TAFELN — Graustufen-Material mit Farb-Mix beim Hover
   ════════════════════════════════════════════════════════════════════ */
const photoVert = `
  varying vec2 vUv;
  void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const photoFrag = `
  uniform sampler2D map; uniform float uMix; uniform float uBright; uniform float uOpacity;
  varying vec2 vUv;
  void main(){
    vec4 tex=texture2D(map,vUv);
    float lum=dot(tex.rgb, vec3(0.299,0.587,0.114));
    vec3 col=mix(vec3(lum), tex.rgb, uMix);      // 0 = Graustufen, 1 = Farbe
    gl_FragColor=vec4(col*uBright, tex.a*uOpacity);
  }`;

// Spiegelung (Boden-Reflexion): vertikal gespiegeltes Bild, das nach unten
// verblasst — wirkt wie eine polierte Galerie-/Saal-Bodenfläche unter der Tafel.
const reflFrag = `
  uniform sampler2D map; uniform float uMix; uniform float uBright; uniform float uOpacity;
  varying vec2 vUv;
  void main(){
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // Bild vertikal spiegeln
    vec4 tex=texture2D(map, uv);
    float lum=dot(tex.rgb, vec3(0.299,0.587,0.114));
    vec3 col=mix(vec3(lum), tex.rgb, uMix);
    float fade = smoothstep(0.0, 1.0, vUv.y) * 0.42;  // oben (an der Tafel) am stärksten, nach unten weg
    gl_FragColor=vec4(col*uBright, tex.a*uOpacity*fade);
  }`;

const photoPlanes = [];   // { mesh, frame, baseScale }
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2,-2);
let hovered = null;
const galleryState = { v: 1 };   // 1 = Tafeln sichtbar (Reise), 0 = ausgeblendet (Textbereiche)

function makePhotoMaterial(tex){
  return new THREE.ShaderMaterial({
    uniforms:{ map:{value:tex}, uMix:{value:0}, uBright:{value:0.92}, uOpacity:{value:1} },
    vertexShader:photoVert, fragmentShader:photoFrag, transparent:true, side:THREE.DoubleSide,
  });
}

function buildGallery(textures){
  textures.forEach((tex, i) => {
    if (!tex) return;
    const img = tex.image;
    let aspect = (img && img.width && img.height) ? img.width/img.height : 1.4;
    aspect = THREE.MathUtils.clamp(aspect, 0.7, 1.7);   // keine extrem breiten Tafeln
    const h = IS_MOBILE ? 1.95 : 2.7, w = h*aspect;     // mobil kleinere Tafeln (Hochformat)

    const mat = makePhotoMaterial(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

    // dünner weißer Rahmen hinter dem Foto
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(w+0.1, h+0.1),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.12 })
    );
    frame.position.z = -0.02;
    mesh.add(frame);

    // Boden-Reflexion direkt unter der Tafel — teilt sich die uniforms mit dem
    // Foto, damit sie beim Hover/Fokus automatisch mit ein-/ausfärbt und folgt.
    const reflMat = new THREE.ShaderMaterial({
      uniforms: mat.uniforms,                    // SELBE uniform-Objekte → synchron
      vertexShader: photoVert, fragmentShader: reflFrag,
      transparent:true, side:THREE.DoubleSide, depthWrite:false,
    });
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), reflMat);
    refl.position.set(0, -h - 0.05, 0);          // genau unter der Tafel
    mesh.add(refl);

    // Platzierung: abwechselnd links/rechts, großzügiger z-Abstand → höchstens
    // ~3 Tafeln gleichzeitig sichtbar, alle innerhalb des Sichtfelds.
    const side = i % 2 ? 1 : -1;
    mesh.position.set(
      side * (IS_MOBILE ? 1.9 + (i % 2) * 0.25 : 2.6 + (i % 2) * 0.5),
      Math.sin(i * 1.7) * (IS_MOBILE ? 0.9 : 1.4),
      -3 - i * (IS_MOBILE ? 4.4 : 5.0)
    );
    mesh.rotation.y = -side * (IS_MOBILE ? 0.05 : 0.07);   // sanfte Neigung
    mesh.userData = {
      title: IMAGES[i] ? IMAGES[i].t : '',
      desc:  IMAGES[i] ? IMAGES[i].d : '',
      bobSeed: Math.random()*6.28, baseY: mesh.position.y,
      // Ruhe-Transform im Korridor → für die Rückkehr nach dem Klick-Fokus
      homePos:   mesh.position.clone(),
      homeQuat:  mesh.quaternion.clone(),
    };
    scene.add(mesh);
    photoPlanes.push(mesh);
  });
}

/* ── Hover-Interaktion (Raycaster) ─────────────────────────────────── */
if (!IS_MOBILE){
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX/innerWidth)*2 - 1;
    pointer.y = -(e.clientY/innerHeight)*2 + 1;
  });
}
/* ════════════════════════════════════════════════════════════════════
   KLICK-GALERIE — Klick auf eine Tafel öffnet einen ISOLIERTEN Streifen aus
   3 eigenen Bild-Plätzen vor der Kamera. Beim Öffnen wird ALLES andere
   ausgeblendet (Korridor-Tafeln, Geister-Wörter, Lichtschächte, Dampf,
   Hintergrund gedimmt) → volle Isolation. Schließen (daneben/Esc) bringt
   die Reise zurück. Berührt nur Bild-Logik + Karte.
   ── EIGENE BILDER: Pfade in SLOT_IMAGES eintragen (sonst leere Platzhalter). ──
   ════════════════════════════════════════════════════════════════════ */
const focusEl    = document.getElementById('dishFocus');
const focusTitle = document.getElementById('dishFocusTitle');
const focusDesc  = document.getElementById('dishFocusDesc');
const focusClose = document.getElementById('dishFocusClose');

const GAL_COUNT        = 3;      // Anzahl der Bild-Plätze (gemeinsame Galerie)
// FELD-LOGIK: jede Schiebe (Bild-Platz) hat ihre EIGENE Bildgruppe.
// Schieben mit mehreren Bildern rotieren sanft durch ihre eigenen Bilder.
const SLOT_IMAGES = [
  ['images/brunch-1.avif'],
  ['images/brunch-2.avif', 'images/brunch-2b.avif', 'images/brunch-2c.jpg'],
  ['images/brunch-3.avif'],
];
const GAL_DIST         = 9.5;    // Abstand der Reihe vor der Kamera
const GAL_SPACING      = 4.4;    // seitlicher Abstand (für Querformat-Bilder)
const GAL_SCALE        = 1.0;    // Größe der Bilder in der Reihe
const GAL_SCALE_ACTIVE = 1.1;    // aktives Bild (Hover) etwas größer
const GAL_DIST_ACTIVE  = 8.9;    // aktives Bild etwas näher (tritt hervor)
// Mobil (Hochformat): Bilder stapeln sich VERTIKAL statt nebeneinander.
const GAL_DIST_M       = 8.8;    // Abstand vor der Kamera (mobil)
const GAL_SPACING_M    = 2.5;    // vertikaler Abstand (mobil)
const GAL_LIFT_M       = 1.7;    // Stapel anheben → Platz für die Karte unten
const _camR=new THREE.Vector3(), _camF=new THREE.Vector3(), _camU=new THREE.Vector3(), _gt=new THREE.Vector3();
const _ONE = new THREE.Vector3(1,1,1);

let gallery = null;          // { active:mesh|null, from:mesh } während geöffnet
const gallerySlots = [];     // dedizierte Bild-Plätze (eigene Bilder / Platzhalter)

// Platzhalter-Textur: dunkles Panel mit Rahmen, „+" und Label
function makeSlotTexture(label){
  const W=600, H=800, c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='rgba(16,16,20,0.6)'; g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,0.26)'; g.lineWidth=3; g.strokeRect(16,16,W-32,H-32);
  g.strokeStyle='rgba(255,255,255,0.3)'; g.lineWidth=4;
  const cx=W/2, cy=H/2, s=58;
  g.beginPath(); g.moveTo(cx-s,cy); g.lineTo(cx+s,cy); g.moveTo(cx,cy-s); g.lineTo(cx,cy+s); g.stroke();
  g.fillStyle='rgba(255,255,255,0.5)'; g.textAlign='center'; g.font='30px "Space Mono", monospace';
  g.fillText(label, cx, cy+150);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
// Bild auf eine Schiebe anwenden + Seitenverhältnis der Geometrie anpassen
function applySlotTexture(m, tex){
  m.material.map = tex; m.material.needsUpdate = true;
  const im = tex.image;
  if (im && im.width && im.height){
    const asp = THREE.MathUtils.clamp(im.width/im.height, 0.55, 1.8);
    m.geometry.dispose();
    m.geometry = new THREE.PlaneGeometry(m.userData.H*asp, m.userData.H);
  }
}
function buildGallerySlots(){
  const H = 2.4;
  for (let i=0;i<GAL_COUNT;i++){
    const group = SLOT_IMAGES[i] || [];
    const mat = new THREE.MeshBasicMaterial({ map:makeSlotTexture('BILD '+(i+1)), transparent:true, depthWrite:false, side:THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, H), mat);
    m.visible = false; m.scale.setScalar(0.01);
    m.userData = { H, textures:new Array(group.length), idx:0 };  // eigene Bildgruppe je Schiebe
    scene.add(m); gallerySlots.push(m);
    group.forEach((src, gi)=>{                    // alle Bilder DIESER Schiebe laden
      new THREE.TextureLoader().load(src, (tex)=>{
        tex.colorSpace = THREE.SRGBColorSpace;
        m.userData.textures[gi] = tex;
        if (gi === 0) applySlotTexture(m, tex);    // erstes Bild der Schiebe sofort zeigen
      });
    });
  }
}
// Mehrbild-Schieben sanft durch IHRE eigenen Bilder rotieren (nur bei offener Galerie)
function advanceSlots(){
  if (!gallery) return;
  for (const m of gallerySlots){
    const td = m.userData, texs = td.textures.filter(Boolean);
    if (texs.length < 2) continue;
    td.idx = (td.idx + 1) % texs.length;
    const next = texs[td.idx];
    gsap.to(m.material, { opacity:0, duration:0.5, ease:'power2.in', onComplete:()=>{
      applySlotTexture(m, next);
      gsap.to(m.material, { opacity:1, duration:0.5, ease:'power2.out' });
    }});
  }
}
setInterval(advanceSlots, 3200);

// alles außer der Galerie aus-/einblenden (volle Isolation)
function setIsolation(on){
  if (ghostType) ghostType.visible = !on;
  if (godRays) for (const r of godRays) r.m.visible = !on;
  if (steam) steam.pts.visible = !on;
  document.body.classList.toggle('is-gallery', on);
}

function setActive(mesh){                          // Hover/Klick hebt ein Bild hervor
  if (!gallery || gallery.active === mesh) return;
  gallery.active = mesh;
}

function openGallery(clicked){
  if (gallery){ return; }
  gallery = { active:null, from:clicked };
  _camF.set(0,0,-1).applyQuaternion(camera.quaternion);
  for (const m of gallerySlots){                  // gesammelt in der Mitte → fächern auf (Pop-in)
    gsap.killTweensOf(m.material);
    m.material.opacity = 1; m.userData.idx = 0;   // jede Schiebe startet bei ihrem ersten Bild
    if (m.userData.textures[0]) applySlotTexture(m, m.userData.textures[0]);
    m.visible = true;
    m.position.copy(camera.position).addScaledVector(_camF, IS_MOBILE ? GAL_DIST_M : GAL_DIST);
    m.quaternion.copy(camera.quaternion);
    m.scale.setScalar(0.01);
  }
  setIsolation(true);
  hovered = null; document.body.style.cursor = '';
  captionEl.classList.remove('is-on');
  if (focusEl){
    focusTitle.textContent = clicked.userData.title;
    focusDesc.textContent  = clicked.userData.desc || '';
    focusEl.classList.add('is-on');
  }
  if (lenisRef) lenisRef.stop();                  // Scrollen einfrieren → Kamera ruht
}

function closeGallery(){
  if (!gallery) return;
  gallery = null;
  for (const m of gallerySlots) m.visible = false;
  setIsolation(false);
  if (focusEl) focusEl.classList.remove('is-on');
  if (lenisRef) lenisRef.start();
}

// Klick: Tafel treffen → Galerie öffnen; in der Galerie daneben → schließen
if (!IS_MOBILE){
  window.addEventListener('click', (e)=>{
    if (focusEl && e.target instanceof Node && focusEl.contains(e.target)) return;   // Klicks auf der Karte ignorieren
    raycaster.setFromCamera(pointer, camera);
    if (gallery){
      const hit = raycaster.intersectObjects(gallerySlots, false)[0];
      if (hit) setActive(hit.object); else closeGallery();
    } else {
      const hit = raycaster.intersectObjects(photoPlanes, false)[0];
      if (hit) openGallery(hit.object);
    }
  });
}
// MOBIL: Tippen statt Hover/Klick. Tippen auf eine Tafel öffnet die Galerie;
// in der Galerie hebt Tippen ein Bild hervor, Tippen daneben schließt.
// Tap-vs-Scroll-Erkennung: nur kurze, ortsfeste Berührungen zählen als Tap.
if (IS_MOBILE){
  let tsx=0, tsy=0, tst=0;
  window.addEventListener('touchstart', (e)=>{
    const t=e.changedTouches[0]; tsx=t.clientX; tsy=t.clientY; tst=performance.now();
  }, {passive:true});
  window.addEventListener('touchend', (e)=>{
    if (focusEl && e.target instanceof Node && focusEl.contains(e.target)) return;  // Tipp auf die Karte ignorieren
    const t=e.changedTouches[0]; if (!t) return;
    if (Math.hypot(t.clientX-tsx, t.clientY-tsy) > 16) return; // war ein Scroll/Wisch
    if (performance.now()-tst > 500) return;                  // war ein Long-Press
    pointer.x=(t.clientX/innerWidth)*2-1; pointer.y=-(t.clientY/innerHeight)*2+1;
    raycaster.setFromCamera(pointer, camera);
    if (gallery){
      const hit = raycaster.intersectObjects(gallerySlots, false)[0];
      if (hit) setActive(hit.object); else closeGallery();
    } else {
      const hit = raycaster.intersectObjects(photoPlanes, false)[0];
      if (hit) openGallery(hit.object);
    }
  }, {passive:true});
}
if (focusClose) focusClose.addEventListener('click', closeGallery);
addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && gallery) closeGallery(); });

function updateHover(){
  raycaster.setFromCamera(pointer, camera);
  if (gallery){                                   // in der Galerie: Hover → Bild hervorheben
    const hit = raycaster.intersectObjects(gallerySlots, false)[0];
    document.body.style.cursor = hit ? 'pointer' : '';
    setActive(hit ? hit.object : null);
    return;
  }
  const hit = raycaster.intersectObjects(photoPlanes, false)[0];
  const obj = hit ? hit.object : null;
  if (obj === hovered) return;
  if (hovered){                                  // alten zurücksetzen → Graustufen
    gsap.to(hovered.material.uniforms.uMix,    { value:0,    duration:.6 });
    gsap.to(hovered.material.uniforms.uBright, { value:0.92, duration:.6 });
    gsap.to(hovered.scale, { x:1, y:1, z:1, duration:.6, ease:'power3.out' });
  }
  hovered = obj;
  if (hovered){                                  // neuen einfärben + vergrößern
    gsap.to(hovered.material.uniforms.uMix,    { value:1,   duration:.6 });
    gsap.to(hovered.material.uniforms.uBright, { value:1.1, duration:.6 });
    gsap.to(hovered.scale, { x:1.1, y:1.1, z:1.1, duration:.6, ease:'power3.out' });
    captionEl.textContent = hovered.userData.title;
    captionEl.classList.add('is-on');
    document.body.style.cursor = 'pointer';
  } else {
    captionEl.classList.remove('is-on');
    document.body.style.cursor = '';
  }
}

// Pro Frame: Galerie-Plätze als Reihe vor der Kamera verankern
function updateGallery(){
  if (!gallery) return;
  _camF.set(0,0,-1).applyQuaternion(camera.quaternion);     // Kamera-Achsen (frisch nach lookAt)
  if (IS_MOBILE) _camU.set(0,1,0).applyQuaternion(camera.quaternion);
  else           _camR.set(1,0,0).applyQuaternion(camera.quaternion);
  const n = gallerySlots.length;
  const dist  = IS_MOBILE ? GAL_DIST_M    : GAL_DIST;
  const distA = IS_MOBILE ? GAL_DIST_M-0.4: GAL_DIST_ACTIVE;
  const space = IS_MOBILE ? GAL_SPACING_M : GAL_SPACING;
  for (let i=0;i<n;i++){
    const m = gallerySlots[i], on = (m === gallery.active);
    const off = (i - (n-1)/2) * space;
    _gt.copy(camera.position).addScaledVector(_camF, on ? distA : dist);
    if (IS_MOBILE) _gt.addScaledVector(_camU, GAL_LIFT_M - off);   // i=0 oben; Stapel angehoben
    else           _gt.addScaledVector(_camR, off);
    m.position.lerp(_gt, 0.18);
    m.quaternion.slerp(camera.quaternion, 0.18);             // bildschirm-parallel
    m.scale.lerp(_ONE.clone().setScalar(on ? GAL_SCALE_ACTIVE : GAL_SCALE), 0.18);
  }
}

/* ════════════════════════════════════════════════════════════════════
   POST-PROCESSING (Bloom für Ring/Partikel) — auf Mobile aus
   ════════════════════════════════════════════════════════════════════ */
let composer = null, bloomPass = null;
if (!IS_MOBILE){
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom in halber Auflösung berechnen → deutlich weniger Füllrate, optisch
  // praktisch identisch (Bloom ist ohnehin weichgezeichnet).
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth*0.5, innerHeight*0.5), 0.5, 0.7, 0.82);
  composer.addPass(bloomPass);
}

/* ════════════════════════════════════════════════════════════════════
   GRAUSTUFEN-STIMMUNG je Scroll-Fortschritt
   ════════════════════════════════════════════════════════════════════ */
const _fog=new THREE.Color(),a=new THREE.Color(),b=new THREE.Color();
function applyStage(p){
  let i=0; while(i<CHAPTER_AT.length-1 && p>=CHAPTER_AT[i+1]) i++;
  const s0=STAGES[i], s1=STAGES[Math.min(i+1,STAGES.length-1)];
  const start=CHAPTER_AT[i], end=CHAPTER_AT[Math.min(i+1,CHAPTER_AT.length-1)];
  const t=end>start?THREE.MathUtils.clamp((p-start)/(end-start),0,1):0;
  scene.fog.color.copy(_fog.copy(a.setHex(s0.fog)).lerp(b.setHex(s1.fog),t));
  keyLight.intensity = THREE.MathUtils.lerp(s0.lightInt, s1.lightInt, t);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(s0.exposure, s1.exposure, t);
}

/* ════════════════════════════════════════════════════════════════════
   SCROLL — Lenis + ScrollTrigger
   ════════════════════════════════════════════════════════════════════ */
let targetProgress = 0, smoothProgress = 0;
let lenisRef = null;   // Referenz, damit der Klick-Fokus das Scrollen pausieren kann

if (!REDUCED){
  const lenis = new Lenis({ lerp:0.1, smoothWheel:true, wheelMultiplier:0.9 });
  lenisRef = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time)=> lenis.raf(time*1000));
  gsap.ticker.lagSmoothing(0);
}

ScrollTrigger.create({
  trigger: document.body, start:'top top', end:'bottom bottom',
  onUpdate:(self)=>{ targetProgress=self.progress; updateChapters(self.progress); },
});

/* ── DURCHFLUG DURCH DAS "O" ──────────────────────────────────────────
   Das echte "O" der Überschrift wird in die Bildschirmmitte verschoben
   und aus seinem eigenen Zentrum heraus stark vergrößert — die Öffnung
   des Buchstabens "verschluckt" den Bildschirm und gibt die 3D-Welt frei. */
function setupPortal(){
  if (REDUCED) return;
  const title = document.getElementById('heroTitle');
  const o = document.getElementById('portalO');
  if (!title || !o) return;

  // dx/dy verschieben das O in die Bildschirmmitte; der Transform-Origin
  // (in PROZENT, damit skalierungs-invariant) bleibt exakt auf dem O.
  let dx = 0, dy = 0;
  function measure(){
    // 1) Schriftgröße IMMER so setzen, dass die Wortmarke einzeilig genau
    //    ~86 % der Viewport-Breite einnimmt (unabhängig von der tatsächlich
    //    geladenen Schrift) → das "N" wird nie abgeschnitten.
    title.style.fontSize = '';
    const cur = parseFloat(getComputedStyle(title).fontSize);
    const natural = title.scrollWidth;            // Layoutbreite bei Basisgröße
    if (natural > 0) {
      const target = innerWidth * 0.86;
      let fs = cur * (target / natural);
      fs = Math.min(fs, innerHeight * 0.32);      // nicht zu hoch auf breiten Screens
      title.style.fontSize = fs + 'px';
    }
    // 2) O vermessen
    const tr = title.getBoundingClientRect();
    const or = o.getBoundingClientRect();
    if (!tr.width || !or.width) return;
    const ocx = or.left + or.width/2, ocy = or.top + or.height/2;
    // Verhältnis ist unter Skalierung/Translation invariant → auch im
    // transformierten Zustand korrekt messbar.
    const rx = (ocx - tr.left) / tr.width;
    const ry = (ocy - tr.top)  / tr.height;
    title.style.transformOrigin = `${(rx*100).toFixed(3)}% ${(ry*100).toFixed(3)}%`;
    dx = innerWidth/2  - ocx;   // gültig im Ruhezustand (onRefreshInit revertiert dazu)
    dy = innerHeight/2 - ocy;
  }

  // Hero wird während des Zooms FIXIERT (pin), damit der Titel nicht
  // wegscrollt. onRefreshInit misst neu, sobald Schriften/Layout fertig sind.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger:'#hero', start:'top top', end:'+=140%',
      scrub:true, pin:true, anticipatePin:1, invalidateOnRefresh:true,
      onRefreshInit: measure,
    },
  });
  measure();
  // 1) übrige Hero-Texte sofort ausblenden — nur der Name bleibt
  tl.to('.hero__fade', { opacity:0, y:-18, ease:'power1.in', duration:0.10 }, 0);
  // 2) O in die Mitte holen und langsam hineinzoomen
  tl.to(title, { x:()=>dx, y:()=>dy, scale:46, ease:'power2.in', duration:1 }, 0);
  // 3) zum Schluss ausblenden — die 3D-Welt übernimmt
  tl.to(title, { opacity:0, ease:'none', duration:0.30 }, 0.70);

  // Nach Schrift-Laden / vollständigem Laden neu vermessen
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>ScrollTrigger.refresh());
  addEventListener('load', ()=>ScrollTrigger.refresh());
  addEventListener('resize', ()=>ScrollTrigger.refresh());
}

ScrollTrigger.create({ start:1, end:99999,
  onEnter:()=>scrollHint.classList.add('is-hidden'),
  onLeaveBack:()=>scrollHint.classList.remove('is-hidden') });
// (Foto-Tafeln bleiben durchgehend sichtbar — der Zitat-Abschnitt bekommt
//  nur mehr Raum, siehe .section--atmo in style.css.)

let activeChapter=-1;
function updateChapters(p){
  let idx=0; for(let i=0;i<CHAPTER_AT.length;i++) if(p>=CHAPTER_AT[i]-0.05) idx=i;
  if(idx===activeChapter) return; activeChapter=idx;
  chapterEls.forEach((el,i)=>el.classList.toggle('is-active', i===idx));
  giantWords.forEach((w,i)=>{
    const on=i===idx;
    gsap.to(w,{ opacity:on?1:0, x:on?'0vw':(i<idx?'-40vw':'40vw'),
      filter:on?'blur(0px)':'blur(8px)', duration:1.1, ease:'power3.out', overwrite:true });
  });
}

// Reveals + Kapitel-Bildtitel (.cap)
if (!REDUCED){
  ScrollTrigger.batch('.reveal', { start:'top 85%',
    onEnter:(els)=>gsap.to(els,{opacity:1,y:0,duration:1,ease:'power3.out',stagger:0.12,overwrite:true}) });
  ScrollTrigger.batch('.cap', { start:'top 80%', end:'bottom 20%',
    onEnter:(els)=>gsap.to(els,{opacity:1,y:0,duration:1,ease:'power3.out',overwrite:true}),
    onLeave:(els)=>gsap.to(els,{opacity:0,y:-30,duration:.6,overwrite:true}),
    onEnterBack:(els)=>gsap.to(els,{opacity:1,y:0,duration:.8,overwrite:true}),
    onLeaveBack:(els)=>gsap.to(els,{opacity:0,y:30,duration:.6,overwrite:true}) });
} else {
  gsap.set('.reveal,.cap',{opacity:1,y:0});
}

// Zähler
document.querySelectorAll('#stats b').forEach((el)=>{
  const end=+el.dataset.count, suffix=el.dataset.suffix||'', plain=el.dataset.plain==='1';
  ScrollTrigger.create({ trigger:el, start:'top 88%', once:true, onEnter:()=>{
    const o={v:0}; gsap.to(o,{v:end,duration:1.8,ease:'power2.out',
      onUpdate:()=>el.textContent=Math.round(o.v)+(plain?'':suffix),
      onComplete:()=>el.textContent=end+(plain?'':suffix) }); } });
});

/* ── Maus-Parallax ─────────────────────────────────────────────────── */
const mouse={x:0,y:0,tx:0,ty:0};
if(!IS_MOBILE) window.addEventListener('pointermove',(e)=>{
  mouse.tx=(e.clientX/innerWidth-0.5)*2; mouse.ty=(e.clientY/innerHeight-0.5)*2; });

/* ════════════════════════════════════════════════════════════════════
   RENDER-SCHLEIFE
   ════════════════════════════════════════════════════════════════════ */
const clock=new THREE.Clock(); const look=new THREE.Vector3(); let running=true;
function tick(){
  if(!running) return;
  const dt=clock.getDelta(), t=clock.elapsedTime;

  smoothProgress += (targetProgress-smoothProgress)*(REDUCED?1:EASE);
  const p=THREE.MathUtils.clamp(smoothProgress,0,1);

  CAMERA_PATH.getPointAt(p, camera.position);
  CAMERA_PATH.getPointAt(Math.min(p+0.04,1), look);
  // Mobil: seitliches Pendeln dämpfen → Kamera fliegt mittiger/gerader durch
  // den Korridor (keine Parallaxe, Tafeln sind näher an der Mitte).
  if (IS_MOBILE){ camera.position.x *= 0.4; look.x *= 0.4; }
  mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;
  camera.position.x+=mouse.x*1.1; camera.position.y+=-mouse.y*0.8;

  // FINALE: in den letzten ~10% Scroll die Kamera zurückziehen + heben,
  // damit der Tafel-Ring sichtbar wird. Darunter (finaleT=0) keinerlei Eingriff.
  const finaleT = (FX.finale && finale) ? THREE.MathUtils.smoothstep(p, FINALE_START, 1.0) : 0;
  if (finaleT > 0){
    camera.position.lerp(OVERVIEW_POS, finaleT);
    _flook.lerpVectors(look, finale.C, finaleT);
    camera.lookAt(_flook);
  } else {
    camera.lookAt(look);
  }

  applyStage(p);

  // Die Foto-Tafeln existieren NUR während der Reise (ca. 0–0.5) und
  // verschwinden vollständig vor dem Zitat-Abschnitt → die Textbereiche
  // (Atmosphäre/Geschichte/Öffnungszeiten) bleiben sauber, ohne Bilder dahinter.
  const galleryFade = galleryState.v;
  for(let i=0;i<photoPlanes.length;i++){
    const m = photoPlanes[i];
    if (finaleT > 0.0001){
      applyFinaleToPlane(m, finale.ring[i], finaleT);     // Tafel in den Ring führen
    } else {
      m.position.y = m.userData.baseY + Math.sin(t*0.6 + m.userData.bobSeed)*0.12;
    }
    m.material.uniforms.uOpacity.value = galleryFade;
    if (m.children[0]) m.children[0].material.opacity = 0.12 * galleryFade;
    // während die Galerie offen ist, ist der ganze Korridor ausgeblendet (Isolation)
    m.visible = !gallery && galleryFade > 0.01;
  }

  if (FX.finale && finale) updateFinale(finaleT);

  updateGallery();
  updateSteam(dt, t);
  updateGodRays(t);
  updateGhostType(t);
  if(!IS_MOBILE) updateHover();

  composer ? composer.render() : renderer.render(scene,camera);
  requestAnimationFrame(tick);
}

/* ── Resize / Sichtbarkeit ─────────────────────────────────────────── */
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer){
    composer.setSize(innerWidth,innerHeight);
    if(bloomPass) bloomPass.setSize(innerWidth*0.5, innerHeight*0.5);   // Bloom halbauflösend halten
  }
  ScrollTrigger.refresh();
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ running=false; }
  else if(!running){ running=true; clock.getDelta(); tick(); }
});

/* ════════════════════════════════════════════════════════════════════
   TEXTUREN LADEN (echter Fortschritt) → Galerie bauen → starten
   ════════════════════════════════════════════════════════════════════ */
function loadTexture(img){
  return new Promise((resolve)=>{
    const loader=new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
    loader.load(wixURL(img.u),
      (tex)=>{ tex.colorSpace=THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      ()=>{ // Wix fehlgeschlagen → Unsplash-Fallback
        loader.load(unsplashURL(img.f),
          (tex)=>{ tex.colorSpace=THREE.SRGBColorSpace; resolve(tex); },
          undefined, ()=>resolve(null));
      });
  });
}

/* ── Bokeh-Lichtkreise (warm, weich, langsam treibend) ─────────────── */
function buildBokeh(){
  const c = document.getElementById('bg-bokeh');
  if (!c || REDUCED) return;
  const n = IS_MOBILE ? 12 : 22;            // geringe Dichte (≤ 25)
  for (let i=0;i<n;i++){
    const s = document.createElement('span');
    s.className = 'bokeh';
    const size = 40 + Math.random()*120;
    s.style.width = s.style.height = size + 'px';
    s.style.left = (Math.random()*100) + '%';
    s.style.top  = (Math.random()*100) + '%';
    s.style.opacity = (0.15 + Math.random()*0.15).toFixed(2);   // 0.15–0.30
    s.style.animationDuration = (20 + Math.random()*16) + 's';
    s.style.animationDelay = (-Math.random()*24) + 's';
    c.appendChild(s);
  }
}

/* ════════════════════════════════════════════════════════════════════
   COLD OPEN — Glut (Funke) + aufsteigender Dampf auf einem 2D-Canvas.
   Monochrom (reines Weiß/Grau, kein Gold). Läuft EINMAL; danach blendet
   die Schleier-Ebene aus und das Logo erscheint. Vollständig isoliert —
   kein Eingriff in 3D/Scroll/Portal.
   ════════════════════════════════════════════════════════════════════ */
let coldOpen = null;
function initColdOpen(){
  const cv = coldOpenEl; if (!cv) return null;
  const ctx = cv.getContext('2d');
  let W=0, H=0; const dpr = Math.min(devicePixelRatio, 2);
  function resize(){ W = cv.width = Math.floor(innerWidth*dpr); H = cv.height = Math.floor(innerHeight*dpr); }
  resize();
  const parts = [];
  const state = { ember:0, burst:0, alive:true, t0:performance.now()/1000, raf:0 };
  function spawn(ex, ey){
    parts.push({ x: ex + (Math.random()-0.5)*16*dpr, y: ey,
      vy: -(16 + Math.random()*22)*dpr, vx: (Math.random()-0.5)*8*dpr,
      life:0, max: 1.6 + Math.random()*1.6, r: (16 + Math.random()*24)*dpr,
      seed: Math.random()*6.2831 });
  }
  let acc = 0;
  function frame(){
    if (!state.alive) return;
    const t = performance.now()/1000, dt = Math.min(0.05, t - state.t0); state.t0 = t;
    ctx.clearRect(0,0,W,H);
    const ex = W*0.5, ey = H*0.54;
    // Dampf nachschieben, solange die Glut lebt und noch nicht „explodiert" ist
    acc += dt;
    while (acc > 0.045){ acc -= 0.045; if (state.ember > 0.15 && state.burst < 0.6 && !IS_MOBILE) spawn(ex, ey); }
    // Dampf-Partikel (hinter der Glut)
    for (let i=parts.length-1;i>=0;i--){
      const p = parts[i]; p.life += dt;
      const k = p.life/p.max; if (k >= 1){ parts.splice(i,1); continue; }
      p.x += p.vx*dt + Math.sin(t*1.2 + p.seed)*6*dpr*dt;
      p.y += p.vy*dt; p.vy *= 0.995;
      const a   = Math.sin(k*Math.PI) * 0.15 * state.ember;     // weich ein-/ausblenden
      const rad = p.r * (0.6 + k*1.2);
      const g = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y,rad);
      g.addColorStop(0, `rgba(228,228,232,${a})`);
      g.addColorStop(1, 'rgba(228,228,232,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,rad,0,6.2832); ctx.fill();
    }
    // Glut (weißer Kern, flackernd) — beim „Zünden" kurz aufflammen
    const flick = 0.82 + 0.18*Math.sin(t*9) + 0.06*Math.sin(t*23);
    const eA = Math.min(1, state.ember*flick*(1 + state.burst*5));
    const eR = (24*dpr) * (0.5 + state.ember*0.8) * (1 + state.burst*3.5);
    const eg = ctx.createRadialGradient(ex,ey,0, ex,ey,eR);
    eg.addColorStop(0,   `rgba(255,255,255,${eA})`);
    eg.addColorStop(0.45,`rgba(255,255,255,${eA*0.4})`);
    eg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex,ey,eR,0,6.2832); ctx.fill();
    state.raf = requestAnimationFrame(frame);
  }
  state.raf = requestAnimationFrame(frame);
  const onResize = () => resize(); addEventListener('resize', onResize);
  state.destroy = () => { state.alive = false; cancelAnimationFrame(state.raf); removeEventListener('resize', onResize); };
  return state;
}

function playColdOpen(){
  const tw = document.getElementById('welcomeTw');
  let failSafe = setTimeout(finishIntro, 7000);          // harte Sicherung gegen Hänger
  function finishIntro(){
    clearTimeout(failSafe);
    if (tw){ tw.classList.remove('is-caret'); tw.style.maxWidth = 'none'; }
    if (coldOpen){ coldOpen.destroy(); coldOpen = null; }
    if (coldOpenEl) coldOpenEl.style.display = 'none';
    document.body.classList.remove('is-intro');
    if (lenisRef) lenisRef.start();
  }
  if (REDUCED){ finishIntro(); return; }                 // kein Cold Open bei reduzierter Bewegung

  if (lenisRef) lenisRef.stop();                         // Scrollen während des Intros sperren
  coldOpen = initColdOpen();
  if (tw) gsap.set(tw, { maxWidth:0 });

  const tl = gsap.timeline({ onComplete: finishIntro });
  tl.to(coldOpen,    { ember:1, duration:1.0, ease:'power2.out' }, 0.15);        // Glut wächst
  tl.to(coldOpen,    { burst:1, duration:0.45, ease:'power2.in' }, 1.7);         // Funke zündet
  tl.to(coldOpenEl,  { opacity:0, duration:1.2, ease:'power2.inOut' }, 1.75);    // Schleier weg → Logo erscheint
  // Willkommens-Zeile „tippen" (Clip-Reveal + Cursor)
  tl.add(() => { if (tw) tw.classList.add('is-caret'); }, 2.7);
  tl.to(tw, { maxWidth: () => (tw ? tw.scrollWidth + 4 : 0), duration:1.3, ease:'steps(26)' }, 2.7);
  tl.add(() => { if (tw) tw.classList.remove('is-caret'); }, 4.3);
  // (Chrome blendet danach ein, sobald finishIntro die Klasse .is-intro entfernt)
}

/* ════════════════════════════════════════════════════════════════════
   FINALE — nach der letzten Tafel zieht die Kamera zurück und die Foto-
   Tafeln gleiten in einen Ring ("O"-Motiv der Eröffnung), verbunden durch
   feine Konstellations-Linien, mit der Wortmarke YAZZOON in der Mitte.
   Greift NUR in den letzten ~10% Scroll (Schwelle FINALE_START) und mischt
   sich sanft ein — darunter bleibt alles exakt wie zuvor. Reversibel.
   ── Zum Entfernen: FX.finale = false (oder diesen Block löschen). ──
   ════════════════════════════════════════════════════════════════════ */
const FINALE_START = 0.9;
const OVERVIEW_POS  = new THREE.Vector3(0, 2.0, -12);  // zurückgezogen, fast frontal → Ring liest als Kreis ("O")
const _flook = new THREE.Vector3();
const _fUP   = new THREE.Vector3(0, 1, 0);
const _fM4   = new THREE.Matrix4();
const _fQt   = new THREE.Quaternion();
let finale = null;

function buildFinale(){
  if (!FX.finale || !photoPlanes.length) return;
  const C = new THREE.Vector3(0, 1.6, -50);           // Ring-/Wortmarken-Zentrum
  const R = 11, N = photoPlanes.length;               // großer, offener Ring → Tafeln rahmen die Mitte
  const ring = [];
  for (let i=0;i<N;i++){
    const a = (i/N)*Math.PI*2 - Math.PI/2;            // gleichmäßig auf dem Kreis
    ring.push(new THREE.Vector3(C.x + Math.cos(a)*R, C.y + Math.sin(a)*R, C.z));
  }
  // Konstellations-Linien (Schleife: Tafel i → Tafel i+1)
  const lgeo = new THREE.BufferGeometry();
  const lpos = new Float32Array(N*2*3);
  lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  const lmat = new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0,
    depthWrite:false, blending:THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(lgeo, lmat);
  lines.frustumCulled = false; scene.add(lines);
  // Wortmarke YAZZOON in der Mitte
  const { tex, aspect } = makeTextTexture('YAZZOON', '"Poiret One", sans-serif');
  const wh = 2.4, ww = wh*aspect;
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:0,
      depthWrite:false, blending:THREE.AdditiveBlending }));
  wm.position.copy(C); scene.add(wm);
  finale = { C, ring, lines, lpos, lmat, wm };
}
// Eine Tafel zwischen Korridor-Heimat und Ring-Ziel mischen, der Kamera zugewandt
function applyFinaleToPlane(m, ringPos, finaleT){
  m.position.lerpVectors(m.userData.homePos, ringPos, finaleT);
  _fM4.lookAt(m.position, camera.position, _fUP);
  _fQt.setFromRotationMatrix(_fM4);
  m.quaternion.slerpQuaternions(m.userData.homeQuat, _fQt, finaleT);
}
function updateFinale(finaleT){
  if (!finale) return;
  const N = photoPlanes.length;
  for (let i=0;i<N;i++){                               // Linien an aktuelle Tafel-Positionen
    const a = photoPlanes[i].position, b = photoPlanes[(i+1)%N].position, o = i*6;
    finale.lpos[o]=a.x;   finale.lpos[o+1]=a.y; finale.lpos[o+2]=a.z;
    finale.lpos[o+3]=b.x; finale.lpos[o+4]=b.y; finale.lpos[o+5]=b.z;
  }
  finale.lines.geometry.attributes.position.needsUpdate = true;
  finale.lmat.opacity        = THREE.MathUtils.smoothstep(finaleT, 0.55, 1.0) * 0.5;
  finale.wm.material.opacity = THREE.MathUtils.smoothstep(finaleT, 0.5,  1.0) * 0.9;
  finale.wm.lookAt(camera.position);
}

async function boot(){
  buildBokeh();
  buildSteam();
  buildGodRays();
  let done=0; const total=IMAGES.length;
  const textures = await Promise.all(IMAGES.map(img =>
    loadTexture(img).then(tex=>{ done++; loaderFill.style.width=(done/total*100)+'%';
      loaderPct.textContent=Math.round(done/total*100); return tex; })
  ));
  buildGallery(textures);
  updateChapters(0);
  // Schriften müssen geladen sein, bevor das "O" exakt gemessen wird
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
  buildGhostType();   // erst nach Schrift-Laden → arabische/Serif-Wörter rendern korrekt
  buildFinale();      // Ring + Wortmarke (Poiret One) erst nach Schrift-Laden bauen
  buildGallerySlots(); // dedizierte Bild-Plätze (eigene Bilder / Platzhalter)
  setupPortal();
  composer ? composer.render() : renderer.render(scene,camera);   // erster Frame
  ScrollTrigger.refresh();
  setTimeout(()=>{ loaderEl.classList.add('is-hidden'); tick(); playColdOpen(); }, 350);
}
boot();
