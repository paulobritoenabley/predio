// Enabley · Do topo ao térreo
// Um único palco 3D fixo. O scroll é a câmera do elevador descendo pela fachada.
// Assinatura: o prédio acende atrás de você. Cada andar que a câmera passa fica aceso.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
// Celular: sem pós-processamento, menos pixels, menos luzes por shader.
const MOBILE = COARSE || Math.min(innerWidth, innerHeight) < 700;
const LIGHT_SLOTS = MOBILE ? 3 : 5;

/* ======================================================================
   Trilha: posições em alturas de viewport (vh)
   ====================================================================== */
const TOTAL = 11.9;
const WAYPOINTS = [
  { id: 'cobertura', t: 0, num: 'C', name: 'Cobertura', rest: 0 },
  { id: 'recepcao', t: 1.95, num: '18', name: 'Recepção', rest: 2.15 },
  { id: 'seguranca', t: 3.2, num: '14', name: 'Segurança', rest: 4.45 },
  { id: 'limpeza', t: 5.8, num: '10', name: 'Limpeza', rest: 6.1 },
  { id: 'imobiliaria', t: 7.1, num: '6', name: 'Imobiliária', rest: 7.4 },
  { id: 'obra', t: 8.4, num: '3', name: 'Obra', rest: 8.7 },
  { id: 'terreo', t: 9.7, num: 'T', name: 'Térreo', rest: 10.0 },
  { id: 'praca', t: TOTAL, num: 'E', name: 'Entrada', rest: TOTAL },
];

const FH = 4, FLOORS = 20, HW = 12, H = FH * FLOORS;
const FEATURE = { 18: 'recepcao', 14: 'seguranca', 10: 'limpeza', 6: 'imobiliaria' };

// Quadros-chave da câmera: [t, posição, alvo, parada]
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KEYS = [
  [0.0, V(-40, 99, 92), V(2, 84, 0), 1],
  [0.85, V(-31, 94, 70), V(1, 80, 2), 0],
  [1.45, V(-17, 84, 46), V(0, 74, 6), 0],
  [1.95, V(-6.2, 74.2, 21.5), V(2.2, 73.6, 5), 1],
  [2.5, V(-5.4, 74.1, 20.4), V(2.2, 73.6, 5), 1],
  [2.85, V(3, 65, 40), V(0, 60, 5), 0],
  [3.2, V(0.6, 58.2, 21.5), V(2.2, 57.7, 4), 1],
  [4.95, V(0.2, 58.0, 19.6), V(2.2, 57.7, 4), 1],
  [5.4, V(14, 48, 40), V(0, 44, 5), 0],
  [5.8, V(7.2, 42.3, 20.5), V(1.2, 41.5, 5), 1],
  [6.4, V(6.4, 42.1, 19.4), V(1.2, 41.5, 5), 1],
  [6.75, V(-12, 33, 42), V(0, 28, 5), 0],
  [7.1, V(-6.6, 27.4, 23.5), V(2.4, 25.1, 5), 1],
  [7.7, V(-5.8, 27.1, 22.2), V(2.4, 25.1, 5), 1],
  [8.05, V(6, 19, 40), V(22, 14, 2), 0],
  [8.4, V(17, 15, 36), V(52, 12.5, 0), 1],
  [9.0, V(19.5, 14.2, 33.5), V(52, 12.5, 0), 1],
  [9.35, V(6, 6.5, 46), V(0, 4.5, 2), 0],
  [9.7, V(-2.4, 3.5, 26), V(1.2, 3.9, 0), 1],
  [10.3, V(-1.9, 3.5, 24.4), V(1.2, 3.9, 0), 1],
  [10.75, V(8, 3.2, 50), V(2, 16, 0), 0],
  [11.1, V(12, 2.4, 70), V(0, 34, 0), 1],
  [11.35, V(11, 2.6, 72.5), V(-1, 33, 0), 0],
  [11.7, V(-10.4, 6.8, 86), V(-10.6, 9.3, 66), 1],
  [TOTAL, V(-10.4, 6.8, 85.2), V(-10.6, 9.3, 66), 1],
];

/* ======================================================================
   Renderizador, cena, pós
   ====================================================================== */
const canvas = document.getElementById('world');
// No desktop a cena passa pelo bloom (o antialias vem do alvo com MSAA); no celular desenha direto na tela.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: MOBILE, powerPreference: 'high-performance' });
let DPR = Math.min(devicePixelRatio || 1, MOBILE ? 1.3 : 1.75);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#5B4A78');
scene.fog = new THREE.Fog(HORIZON, 160, 820);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.3, 3000);

let composer = null, bloom = null;
if (!MOBILE) {
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
const draw = () => composer ? composer.render() : renderer.render(scene, camera);

const clock = new THREE.Clock();
const U = { uTime: { value: 0 }, uDim: { value: 1 } };

/* ---------- Céu ---------- */
const SUN_DIR = new THREE.Vector3(-0.55, 0.06, -0.83).normalize();
function makeSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#0A1230') }, mid: { value: new THREE.Color('#2A2D68') },
      hor: { value: new THREE.Color('#E58D6E') }, sun: { value: new THREE.Color('#FFB46E') },
      low: { value: new THREE.Color('#141634') }, sunDir: { value: SUN_DIR },
    },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top,mid,hor,sun,low,sunDir; varying vec3 vD;
      void main(){ float h=vD.y;
        vec3 c=mix(hor,mid,smoothstep(-0.01,0.2,h)); c=mix(c,top,smoothstep(0.16,0.72,h));
        float s=max(dot(normalize(vD),sunDir),0.);
        c+=sun*(pow(s,6.)*.55+pow(s,60.)*.6)*(1.-smoothstep(0.,.35,h));
        c=mix(c,low,smoothstep(0.0,-0.08,h));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), m);
}
const sky = makeSky(); sky.renderOrder = -10; sky.userData.keep = true; scene.add(sky);

// Reflexo do céu no vidro
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(makeSky());
const ENV = pmrem.fromScene(envScene, 0.02).texture;
scene.environment = null;

// Estrelas discretas
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - Math.random() * .75);
    pos.set([Math.sin(ph) * Math.cos(th) * 1400, Math.cos(ph) * 1400 + 60, Math.sin(ph) * Math.sin(th) * 1400], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#C9D4FF', size: 1.6, sizeAttenuation: false, transparent: true, opacity: .55, fog: false, depthWrite: false })));
}

/* ---------- Luzes globais ---------- */
const hemi = new THREE.HemisphereLight('#5468B8', '#2A1A28', 0.9); scene.add(hemi);
const dusk = new THREE.DirectionalLight('#FFB58A', 0.9); dusk.position.copy(SUN_DIR).multiplyScalar(-1).setY(0.5).multiplyScalar(100); scene.add(dusk);
const rim = new THREE.DirectionalLight('#FF9A6A', 1.2); rim.position.copy(SUN_DIR).multiplyScalar(200).setY(40); scene.add(rim);

/* ======================================================================
   Cidade (shader por instância, janelas calculadas no espaço do mundo)
   ====================================================================== */
const CITY_VS = `
  attribute float aSeed; varying vec3 vWP; varying vec3 vN; varying float vSeed;
  void main(){ vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.); vWP=wp.xyz; vSeed=aSeed;
    vN = normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`;
const CITY_FS = `
  uniform vec3 uFog; uniform float uDim; varying vec3 vWP; varying vec3 vN; varying float vSeed;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec3 n=normalize(vN); float roof=step(.5,n.y);
    float u = abs(n.x)>.5 ? vWP.z : vWP.x;
    vec2 g=vec2(u/1.8, vWP.y/3.3); vec2 id=floor(g); vec2 f=fract(g);
    float win=step(.16,f.x)*step(f.x,.84)*step(.24,f.y)*step(f.y,.76);
    float r=hash(id+vSeed*13.7);
    float lit=step(.7,r)*(1.-roof)*step(1.5,vWP.y);
    vec3 warm=vec3(1.,.66,.36), cool=vec3(.7,.82,1.);
    vec3 wc=mix(warm,cool,step(.85,hash(id.yx+vSeed*3.1)))*(.32+.5*hash(id*1.7+vSeed));
    float side = .5+.5*dot(n, normalize(vec3(.55,.0,.83)));
    vec3 col=vec3(.018,.022,.05)+vec3(.035,.022,.04)*side*smoothstep(-10.,80.,vWP.y)+vec3(.012,.012,.03)*smoothstep(0.,120.,vWP.y);
    col=mix(col, vec3(.035,.04,.08), roof);
    col=mix(col, wc*uDim, lit*win);
    float d=length(vWP-cameraPosition);
    col=mix(col,uFog,smoothstep(160.,900.,d)*.9);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
{
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const mat = new THREE.ShaderMaterial({ vertexShader: CITY_VS, fragmentShader: CITY_FS, uniforms: { uFog: { value: HORIZON }, uDim: U.uDim } });
  const items = [];
  const BLOCK = 26, STREET = 9;
  for (let bx = -26; bx <= 26; bx++) for (let bz = -26; bz <= 26; bz++) {
    const cx = bx * BLOCK, cz = bz * BLOCK, d = Math.hypot(cx, cz);
    if (d > 680) continue;
    if (Math.abs(cx) < 44 && Math.abs(cz) < 44) continue;        // praça e torre
    if (cx > 30 && cx < 78 && Math.abs(cz) < 30) continue;       // terreno da obra
    if (cz > 30 && cz < 130 && Math.abs(cx) < 50) continue;      // eixo de visão da praça
    const per = Math.random() < .3 ? 1 : 2;
    const inner = BLOCK - STREET;
    for (let i = 0; i < per; i++) for (let j = 0; j < per; j++) {
      if (Math.random() < .12) continue;
      const w = inner / per - 1.2;
      const ring = THREE.MathUtils.smoothstep(d, 60, 260);
      let h = 6 + Math.pow(Math.random(), 2.4) * (18 + 34 * ring) + (Math.random() < .05 * ring ? 30 + Math.random() * 50 : 0);
      items.push([cx - inner / 2 + (i + .5) * inner / per, cz - inner / 2 + (j + .5) * inner / per, w * (.75 + Math.random() * .25), w * (.75 + Math.random() * .25), h]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const seeds = new Float32Array(items.length); const m4 = new THREE.Matrix4();
  items.forEach(([x, z, sx, sz, h], i) => { m4.makeScale(sx, h, sz).setPosition(x, 0, z); mesh.setMatrixAt(i, m4); seeds[i] = Math.random() * 100; });
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/* ---------- Chão, ruas, postes e carros ---------- */
{
  const g = new THREE.PlaneGeometry(3000, 3000); g.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#10142A', roughness: .9, metalness: 0 })));
  // praça
  const p = new THREE.Mesh(new THREE.BoxGeometry(80, .2, 120), new THREE.MeshStandardMaterial({ color: '#2A2C3E', roughness: .55, metalness: .1, envMap: ENV, envMapIntensity: .35 }));
  p.position.set(0, .1, 26); scene.add(p);

  const dot = T.dotTexture();
  const lamps = [];
  for (let k = -26; k <= 26; k++) {
    const c = k * 26 - 13;
    for (let s = -680; s <= 680; s += 13) {
      if (Math.hypot(c, s) < 690) { lamps.push(c, 0.8, s); lamps.push(s, 0.8, c); }
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
  scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ map: dot, color: '#FFB062', size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  // carros nas avenidas
  const n = 520, base = new Float32Array(n * 3), dir = new Float32Array(n * 3), spd = new Float32Array(n), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ax = Math.random() < .5; const lane = (Math.floor(Math.random() * 9) - 4) * 52 - 13 + (Math.random() < .5 ? -1.6 : 1.6);
    const sgn = lane % 2 > 0 ? 1 : -1;
    base.set(ax ? [lane, .7, (Math.random() - .5) * 1300] : [(Math.random() - .5) * 1300, .7, lane], i * 3);
    dir.set(ax ? [0, 0, sgn] : [sgn, 0, 0], i * 3);
    spd[i] = 9 + Math.random() * 10;
    const red = Math.random() < .5; col.set(red ? [1, .18, .12] : [1, .9, .75], i * 3);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(base, 3));
  cg.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  cg.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
  cg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const cm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, map: { value: dot } },
    vertexShader: `attribute vec3 aDir; attribute float aSpd; attribute vec3 aCol; uniform float uTime; varying vec3 vC;
      void main(){ vec3 p=position+aDir*(mod(dot(position,aDir)+uTime*aSpd+650.,1300.)-650.-dot(position,aDir));
        vC=aCol; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=clamp(260./-mv.z,1.,9.); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*1.6,t.a); }`,
  });
  scene.add(new THREE.Points(cg, cm));
}

/* ======================================================================
   A torre
   ====================================================================== */
const MAT = {
  metal: new THREE.MeshStandardMaterial({ color: '#232A4A', metalness: .75, roughness: .35, envMap: ENV, envMapIntensity: .8 }),
  metalLight: new THREE.MeshStandardMaterial({ color: '#3A4268', metalness: .8, roughness: .3, envMap: ENV, envMapIntensity: 1 }),
  slab: new THREE.MeshStandardMaterial({ color: '#2E3148', roughness: .7 }),
  core: new THREE.MeshStandardMaterial({ color: '#1A1E33', roughness: .9 }),
  bone: new THREE.MeshStandardMaterial({ color: '#E9E2D5', roughness: .55 }),
  stone: new THREE.MeshStandardMaterial({ color: '#2B2E3B', roughness: .25, metalness: .2, envMap: ENV, envMapIntensity: .5 }),
  wood: new THREE.MeshStandardMaterial({ map: T.woodTexture(), roughness: .6 }),
  fabric: new THREE.MeshStandardMaterial({ color: '#5A3C5E', roughness: .95 }),
  fabric2: new THREE.MeshStandardMaterial({ color: '#B98E62', roughness: .95 }),
  plant: new THREE.MeshStandardMaterial({ color: '#2F5A3D', roughness: .8 }),
  pot: new THREE.MeshStandardMaterial({ color: '#C9BBA6', roughness: .7 }),
  black: new THREE.MeshStandardMaterial({ color: '#14151C', roughness: .45, metalness: .3 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#FFD84A', roughness: .5 }),
  crane: new THREE.MeshStandardMaterial({ color: '#E6B33C', roughness: .55, metalness: .3 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#7E8193', roughness: .95 }),
};
const tower = new THREE.Group(); scene.add(tower);
const box = (w, h, d, m, x, y, z, parent = tower) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };

// núcleo e lajes
box(22, H, 11, MAT.core, 0, H / 2, -5.5);
for (let f = 1; f <= FLOORS; f++) {
  if (f === 1) { box(24, .5, 12, MAT.slab, 0, f * FH - .25, -6); continue; }  // saguão com pé-direito duplo
  box(24, .5, 24, MAT.slab, 0, f * FH - .25, 0);
}
box(24, .5, 24, MAT.slab, 0, .25, 0);

// fachada: montantes, faixas e vidro
{
  const g = new THREE.BoxGeometry(1, 1, 1);
  const list = [];
  const faces = [[0, 1], [Math.PI / 2, 1], [-Math.PI / 2, 1], [Math.PI, 1]];
  for (const [ry] of faces) {
    for (let i = 0; i <= 8; i++) { const x = -HW + i * 3; list.push([ry, x, H / 2, HW + .15, .2, H, .38]); }
    for (let f = 0; f <= FLOORS; f++) { if (f === 1 && ry === 0) continue; list.push([ry, 0, f * FH - .2, HW + .22, 24.6, .62, .5]); }
  }
  const im = new THREE.InstancedMesh(g, MAT.metal, list.length);
  const o = new THREE.Object3D();
  list.forEach(([ry, x, y, z, sx, sy, sz], i) => {
    o.position.set(x, y, z); o.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
  });
  tower.add(im);
}
const glassFront = [];
{
  const glassMat = (op) => new THREE.MeshStandardMaterial({ color: '#5A6CA8', metalness: 1, roughness: .04, envMap: ENV, envMapIntensity: 1.1, transparent: true, opacity: op, depthWrite: false });
  const sharedGlass = glassMat(.5);
  for (let f = 0; f < FLOORS; f++) {
    if (f === 1) continue;
    const h = f === 0 ? FH * 2 : FH;
    const own = FEATURE[f] || f === 0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24, h), own ? glassMat(.5) : sharedGlass);
    if (own) m.userData.keep = true;
    m.position.set(0, f * FH + h / 2, HW); m.renderOrder = 5; tower.add(m); glassFront[f] = m;
  }
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24, H), glassMat(.62));
    m.rotation.y = s * Math.PI / 2; m.position.set(s * HW, H / 2, 0); m.renderOrder = 5; tower.add(m);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(24, H), glassMat(.9)); back.rotation.y = Math.PI; back.position.set(0, H / 2, -HW); tower.add(back);
}

/* ---------- Luz por andar (a assinatura) ---------- */
const L = new Float32Array(FLOORS + 1);       // brilho atual
const LT = new Float32Array(FLOORS + 1);      // alvo
const LON = new Float32Array(FLOORS + 1).fill(-1); // hora em que acendeu
const strips = [], backs = [], pools = [];
{
  const stripGeo = new THREE.BoxGeometry(20, .06, .28);
  const stripMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const stripIM = new THREE.InstancedMesh(stripGeo, stripMat, FLOORS * 3);
  const backMat = new THREE.MeshBasicMaterial({ map: T.interiorStrip(3), color: '#ffffff' });
  const backIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), backMat, FLOORS * 3);
  const poolMat = new THREE.MeshBasicMaterial({ map: T.poolTexture(), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, FLOORS);
  const o = new THREE.Object3D(); const black = new THREE.Color(0, 0, 0);
  let si = 0, bi = 0;
  for (let f = 0; f < FLOORS; f++) {
    const top = f === 0 ? FH * 2 : FH;
    for (let k = 0; k < 3; k++) {
      o.position.set(0, f * FH + top - .53, 2.5 + k * 3.4); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix();
      stripIM.setMatrixAt(si, o.matrix); stripIM.setColorAt(si, black); strips.push([si, f]); si++;
    }
    const feature = FEATURE[f] || f === 0;
    // fundo: parede do núcleo na frente e nas laterais
    const sets = [[0, 0, .03, 22, 0], [1, 11.03, -5.5, 11, Math.PI / 2], [2, -11.03, -5.5, 11, -Math.PI / 2]];
    for (const [k, x, z, w, ry] of sets) {
      o.position.set(x, f * FH + 1.95, z); o.rotation.set(0, ry, 0);
      o.scale.set((feature && k === 0) ? 0.0001 : w * (f % 2 ? 1 : -1), 3.4, 1); o.updateMatrix();
      backIM.setMatrixAt(bi, o.matrix); backIM.setColorAt(bi, black); backs.push([bi, f]); bi++;
    }
    o.position.set(0, f * FH + .03, 6); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.set(feature ? .0001 : 26, 13, 1); o.updateMatrix();
    poolIM.setMatrixAt(f, o.matrix); poolIM.setColorAt(f, black); pools.push([f, f]);
  }
  tower.add(stripIM, backIM, poolIM);
  strips.im = stripIM; backs.im = backIM; pools.im = poolIM;
}
const C_STRIP = new THREE.Color('#FFE2B8'), C_BACK = new THREE.Color('#FFE9CF'), C_POOL = new THREE.Color('#FF9E55');
const C_DARK_BACK = new THREE.Color('#0A0E22');
const tmpC = new THREE.Color();
function applyFloorLights(G) {
  for (const [i, f] of strips) { tmpC.copy(C_STRIP).multiplyScalar(0.015 + 1.25 * L[f] * G); strips.im.setColorAt(i, tmpC); }
  for (const [i, f] of backs) { tmpC.copy(C_DARK_BACK).lerp(C_BACK, L[f] * G); backs.im.setColorAt(i, tmpC); }
  for (const [i, f] of pools) { tmpC.copy(C_POOL).multiplyScalar(.2 * L[f] * G); pools.im.setColorAt(i, tmpC); }
  strips.im.instanceColor.needsUpdate = backs.im.instanceColor.needsUpdate = pools.im.instanceColor.needsUpdate = true;
}

/* ---------- Cobertura ---------- */
const logoImg = await loadImage('assets/enabley.webp');
T.setLogo(logoImg);
await document.fonts.load('800 40px Montserrat').catch(() => {});
await document.fonts.load('500 20px Geist').catch(() => {});
{
  box(24.4, 1.4, .6, MAT.metalLight, 0, H + .7, HW); box(24.4, 1.4, .6, MAT.metalLight, 0, H + .7, -HW);
  box(.6, 1.4, 24.4, MAT.metalLight, HW, H + .7, 0); box(.6, 1.4, 24.4, MAT.metalLight, -HW, H + .7, 0);
  box(8, 3, 6, MAT.core, -5, H + 1.5, -5); box(5, 2.2, 4, MAT.core, 6, H + 1.1, -6);
  for (let i = 0; i < 4; i++) box(1.6, .8, 1.6, MAT.metal, 4 + i * 2, H + .4, 2);
  // letreiro com a marca
  const lt = new THREE.Texture(logoImg); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; lt.needsUpdate = true;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 15 * logoImg.height / logoImg.width), new THREE.MeshBasicMaterial({ map: lt, transparent: true, color: new THREE.Color(1.25, 1.2, 1.25), toneMapped: false }));
  sign.position.set(0, H + 4.6, HW - .4); tower.add(sign);
  box(15.6, .25, .5, MAT.metal, 0, H + 1.5, HW - .6); box(.25, 3.2, .3, MAT.metal, -6, H + 2.9, HW - .6); box(.25, 3.2, .3, MAT.metal, 6, H + 2.9, HW - .6);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(15, 6), new THREE.MeshBasicMaterial({ color: '#B04BA8', map: T.poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .35 }));
  back.position.set(0, H + 4.4, HW - .7); tower.add(back);
}
// luzes vermelhas de balizamento
const beacons = [];
function beacon(x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#FF2E2E', toneMapped: false }));
  m.position.set(x, y, z); m.userData.keep = true; scene.add(m); beacons.push(m); return m;
}
beacon(-HW, H + 1.6, HW); beacon(HW, H + 1.6, HW); beacon(-HW, H + 1.6, -HW); beacon(HW, H + 1.6, -HW);

/* ======================================================================
   Andares em destaque
   ====================================================================== */
// Cada luz da cena é só um descritor. A cada frame as mais relevantes para a câmera
// ocupam um punhado fixo de PointLights, então todo shader calcula poucas luzes.
const LIGHTS = [];
const ROOM_FLOOR = { recepcao: 18, seguranca: 14, limpeza: 10, imobiliaria: 6, terreo: 0 };
function addLight(color, x, y, z, intensity, dist = 20, decay = 1.4, key = null) {
  const d = { color: new THREE.Color(color), pos: new THREE.Vector3(x, y, z), base: intensity, intensity: key ? 0 : intensity, dist, decay, key, score: 0 };
  LIGHTS.push(d); return d;
}
function roomLight(key, color, x, y, z, intensity, dist = 20) {
  return addLight(color, x, ROOM_FLOOR[key] * FH + y, z, intensity, dist, 1.4, key);
}
const lightPool = Array.from({ length: LIGHT_SLOTS }, () => { const l = new THREE.PointLight('#fff', 0, 20, 1.4); scene.add(l); return l; });
function assignLights(cam) {
  for (const d of LIGHTS) d.score = d.intensity <= 0 ? 0 : d.intensity / (1 + d.pos.distanceToSquared(cam) / (d.dist * d.dist * 4));
  const best = LIGHTS.filter(d => d.score > .05).sort((a, b) => b.score - a.score);
  lightPool.forEach((l, i) => {
    const d = best[i];
    if (!d) { l.intensity = 0; return; }
    l.position.copy(d.pos); l.color.copy(d.color); l.distance = d.dist; l.decay = d.decay; l.intensity = d.intensity;
  });
}
function device(w, h, d, screenTex, parent, landscape = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h) * .08), MAT.black); g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w * .9, h * (landscape ? .86 : .92)), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(1, 1, 1) }));
  scr.position.z = d / 2 + .005; g.add(scr); g.userData.screen = scr;
  parent.add(g); return g;
}
function plant(parent, x, y, z, s = 1) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.42 * s, .32 * s, .8 * s, 18), MAT.pot); p.position.set(x, y + .4 * s, z); parent.add(p);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((.35 + Math.random() * .25) * s, 0), MAT.plant);
    b.position.set(x + (Math.random() - .5) * .7 * s, y + (1.1 + Math.random() * 1.1) * s, z + (Math.random() - .5) * .7 * s); b.rotation.set(Math.random(), Math.random(), Math.random());
    parent.add(b);
  }
}
const rooms = {};

// 18 · Recepção
{
  const f = 18, y = f * FH, r = new THREE.Group(); r.position.y = y; tower.add(r); rooms.recepcao = r;
  const slat = T.slatTexture(); slat.repeat.set(6, 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.5), new THREE.MeshStandardMaterial({ map: slat, roughness: .7 })); wall.position.set(0, 1.75, .05); r.add(wall);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ color: '#EDE6DA', roughness: .5 })); wl.position.set(4, 1.9, .08); r.add(wl);
  const lw = 4.2, lgo = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * logoImg.height / logoImg.width), new THREE.MeshBasicMaterial({ map: (() => { const t = new THREE.Texture(logoImg); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })(), transparent: true }));
  lgo.position.set(4, 2.05, .1); r.add(lgo);
  box(7.4, 1.08, 1.5, MAT.bone, 4.2, .54, 5.2, r); box(7.8, .08, 1.9, MAT.stone, 4.2, 1.12, 5.2, r);
  const glow = box(7.2, .05, .05, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, .8), toneMapped: false }), 4.2, .06, 6.0, r);
  for (let i = 0; i < 3; i++) {
    box(.03, 1.2, .03, MAT.black, 2.4 + i * 1.8, 2.85, 5.2, r);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, .32, 24, 1, true), MAT.metalLight); sh.position.set(2.4 + i * 1.8, 2.2, 5.2); r.add(sh);
    box(.5, .02, .5, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.3), toneMapped: false }), 2.4 + i * 1.8, 2.05, 5.2, r);
  }
  // poltronas
  for (const [x, z] of [[-6.2, 6.8], [-3.6, 7.6]]) { box(1.6, .5, 1.5, MAT.fabric2, x, .45, z, r); box(1.6, .9, .3, MAT.fabric2, x, .9, z - .7, r); }
  box(1.1, .45, 1.1, MAT.stone, -4.9, .25, 8.6, r);
  plant(r, -8.6, 0, 3, 1.1); plant(r, 9.4, 0, 3.2, 1);
  const d = device(1.05, 1.75, .07, T.screenRecepcao(), r); d.position.set(1.3, 2.0, 7.3); d.rotation.set(-.05, .26, 0);
  box(.08, 1.1, .08, MAT.black, 1.3, .55, 7.2, r); box(.6, .04, .6, MAT.black, 1.3, .02, 7.2, r);
  roomLight('recepcao', '#FFC890', 3, 3, 6, 38); roomLight('recepcao', '#FFD6A8', -5, 3, 7, 18);
}

// 14 · Segurança (o pico)
const SEC = {};
{
  const f = 14, y = f * FH, r = new THREE.Group(); r.position.y = y; tower.add(r); rooms.seguranca = r;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.5), new THREE.MeshStandardMaterial({ color: '#30364E', roughness: .8 })); wall.position.set(0, 1.75, .05); r.add(wall);
  SEC.monitors = [];
  for (let i = 0; i < 6; i++) {
    const t = T.cctvTexture(i);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .94), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1, 1, 1) }));
    m.position.set(3 + (i % 3) * 1.62, 1.5 + Math.floor(i / 3) * 1.04, .12); r.add(m); SEC.monitors.push(m);
    box(1.6, 1.02, .08, MAT.black, m.position.x, m.position.y, .07, r);
  }
  box(6.4, .95, 1.6, MAT.black, 4.6, .48, 3.8, r); box(6.6, .06, 1.8, MAT.stone, 4.6, .98, 3.8, r);
  box(1.0, .06, .5, MAT.black, 3.8, 1.04, 3.6, r);
  // catracas
  for (let i = 0; i < 3; i++) {
    const x = -7 + i * 2.2;
    box(.3, 1.0, 1.6, MAT.metalLight, x, .5, 8, r);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .03), new THREE.MeshStandardMaterial({ color: '#9FB4E8', transparent: true, opacity: .35, roughness: .1 }));
    flap.position.set(x + .6, .8, 8); r.add(flap);
    box(.12, .05, .3, new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 2, .8), toneMapped: false }), x, 1.02, 7.6, r);
  }
  box(.3, 1.0, 1.6, MAT.metalLight, -7 + 3 * 2.2, .5, 8, r);
  // câmera de teto
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.black); dome.rotation.x = Math.PI; dome.position.set(-2, 3.48, 6); r.add(dome);
  SEC.rec = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, .2, .2), toneMapped: false })); SEC.rec.position.set(-2, 3.28, 6.15); SEC.rec.userData.keep = true; r.add(SEC.rec);
  // o tablet comunitário, em um totem
  box(.5, 1.5, .4, MAT.metalLight, 1.2, .75, 8.4, r);
  SEC.tablet = device(1.9, 1.24, .08, T.screenSeguranca(), r, true);
  SEC.tablet.position.set(1.2, 2.05, 8.62); SEC.tablet.rotation.set(-.12, -.05, 0);
  SEC.tablet.userData.screen.material.color.setScalar(0.02);
  SEC.halo = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshBasicMaterial({ map: T.poolTexture(), color: '#C23AB6', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  SEC.halo.position.set(1.2, 2.05, 8.5); r.add(SEC.halo);
  SEC.tabletLight = addLight('#D25BCB', 1.2, y + 2.2, 9.6, 0, 14, 1.3);
  plant(r, -9.4, 0, 3, 1);
  roomLight('seguranca', '#FFD3A0', 3, 3.1, 6, 34); roomLight('seguranca', '#C8D8FF', -5, 3.1, 6, 16);
}

// Silhueta: corpo e braço em planos separados, o braço gira a partir do ombro
const WAVE = {};
function waveSilhouette() {
  const g = new THREE.Group();
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; draw(x); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mat = map => new THREE.MeshBasicMaterial({ map, color: '#140D1C', transparent: true, alphaTest: .5, side: THREE.DoubleSide });
  const body = mk(256, 512, x => {
    x.beginPath(); x.arc(128, 66, 34, 0, 7); x.fill();
    x.beginPath(); x.ellipse(128, 40, 40, 18, 0, Math.PI, 0); x.fill();
    x.fillRect(116, 96, 24, 24);
    x.beginPath(); x.roundRect(70, 112, 116, 196, [30, 30, 12, 12]); x.fill();
    x.beginPath(); x.roundRect(170, 120, 30, 170, 15); x.fill();
    x.beginPath(); x.arc(185, 296, 15, 0, 7); x.fill();
    x.fillRect(80, 290, 44, 210); x.fillRect(134, 290, 44, 210);
    x.beginPath(); x.roundRect(70, 488, 58, 22, 8); x.roundRect(130, 488, 58, 22, 8); x.fill();
  });
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.8), mat(body)); bm.position.y = .9; g.add(bm);
  const arm = mk(64, 256, x => {
    x.beginPath(); x.roundRect(17, 40, 30, 216, 15); x.fill();
    x.beginPath(); x.arc(32, 30, 22, 0, 7); x.fill();
    x.fillRect(12, 6, 8, 24); x.fillRect(22, 0, 8, 26); x.fillRect(32, 0, 8, 26); x.fillRect(42, 4, 8, 24);
  });
  const ag = new THREE.PlaneGeometry(.225, .9); ag.translate(0, .45 - .06, 0);
  const am = new THREE.Mesh(ag, mat(arm)); am.position.set(-.2, 1.37, .01); am.rotation.z = .5; g.add(am);
  g.userData.arm = am; am.userData.keep = true;
  return g;
}

// 10 · Limpeza e facilities
{
  const f = 10, y = f * FH, r = new THREE.Group(); r.position.y = y; tower.add(r); rooms.limpeza = r;
  const tile = T.tileTexture(); tile.repeat.set(22, 3.5);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.5), new THREE.MeshStandardMaterial({ map: tile, roughness: .25, metalness: .05 })); wall.position.set(0, 1.75, .05); r.add(wall);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshStandardMaterial({ color: '#7D8699', roughness: .62, metalness: 0, envMap: ENV, envMapIntensity: .3 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .01, 6); r.add(fl);
  // bancada e espelho
  box(6, .9, .9, MAT.bone, -6.5, .45, .55, r); box(6, .06, 1.0, MAT.stone, -6.5, .93, .55, r);
  const mir = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.6), new THREE.MeshStandardMaterial({ color: '#B8C6DA', metalness: 1, roughness: .02, envMap: ENV })); mir.position.set(-6.5, 2.15, .08); r.add(mir);
  // QR na parede
  const qr = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9 * (560 + 90) / 560), new THREE.MeshBasicMaterial({ map: T.qrTexture(), toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
  qr.position.set(-1.6, 1.75, .1); r.add(qr);
  box(1.05, 1.18, .04, MAT.black, -1.6, 1.75, .07, r);
  // carrinho
  const cart = new THREE.Group(); cart.position.set(-3.6, 0, 6.8); cart.rotation.y = .5; r.add(cart);
  box(1.6, .9, .9, new THREE.MeshStandardMaterial({ color: '#3D5A8C', roughness: .5 }), 0, .62, 0, cart);
  box(1.7, .06, 1.0, MAT.metalLight, 0, 1.1, 0, cart);
  for (const [x, c] of [[-1.25, '#FFD84A'], [-1.25, null]]) if (c) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .55, 20), new THREE.MeshStandardMaterial({ color: c, roughness: .4 })); b.position.set(x, .45, 0); cart.add(b); }
  const bag = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), MAT.black); bag.scale.set(1, 1.3, 1); bag.position.set(1.15, .6, 0); cart.add(bag);
  const mop = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.6, 8), MAT.metalLight); mop.position.set(-1.2, 1.4, .1); mop.rotation.z = .18; cart.add(mop);
  for (const x of [-.6, .6]) for (const z of [-.35, .35]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .06, 12), MAT.black); w.rotation.x = Math.PI / 2; w.position.set(x, .09, z); cart.add(w); }
  const d = device(.8, 1.36, .06, T.screenLimpeza(), cart); d.position.set(.15, 1.85, .2); d.rotation.set(-.08, -.5, 0);
  box(.05, .6, .05, MAT.black, .15, 1.35, .15, cart);
  // placa de piso molhado
  const sg = new THREE.Group(); sg.position.set(.4, 0, 9.2); sg.rotation.y = -.4; r.add(sg);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.0, .03), MAT.yellow); p.position.set(0, .5, s * .17); p.rotation.x = -s * .32; sg.add(p); }
  plant(r, 8.8, 0, 2.6, 1);
  roomLight('limpeza', '#F4F2FF', -3, 3.1, 4, 22); roomLight('limpeza', '#FFE0B8', 4, 3.1, 7, 14);
  // alguém da equipe acenando na janela, em contraluz
  const wave = waveSilhouette(); wave.position.set(1.4, 0, 11.25); wave.scale.setScalar(1.08); r.add(wave); WAVE.arm = wave.userData.arm;
}

// 6 · Plantão imobiliário
{
  const f = 6, y = f * FH, r = new THREE.Group(); r.position.y = y; tower.add(r); rooms.imobiliaria = r;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.5), new THREE.MeshStandardMaterial({ color: '#E6DFD2', roughness: .8 })); wall.position.set(0, 1.75, .05); r.add(wall);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.48 * .9), new THREE.MeshBasicMaterial({ map: T.screenLancamento(), toneMapped: false })); scr.position.set(4.6, 1.9, .12); r.add(scr);
  box(6.5, 3.4, .08, MAT.black, 4.6, 1.9, .07, r);
  // mesa da maquete
  box(5.2, .85, 3.2, MAT.wood, 3.4, .43, 6.2, r);
  box(5.0, .06, 3.0, MAT.bone, 3.4, .88, 6.2, r);
  const vit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 2.6), new THREE.MeshStandardMaterial({ color: '#BFD2FF', transparent: true, opacity: .1, roughness: .05, metalness: .2, depthWrite: false })); vit.position.set(3.4, 1.66, 6.2); r.add(vit);
  // mini-torre acesa
  const mini = new THREE.Group(); mini.position.set(3.4, .92, 6.2); r.add(mini);
  const mt = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.3, .7), new THREE.MeshStandardMaterial({ color: '#1C2240', emissive: '#FFB873', emissiveIntensity: .55, roughness: .4 })); mt.position.y = .65; mini.add(mt);
  for (const [x, z, h] of [[-1.4, -.6, .5], [-1.1, .7, .35], [1.3, .6, .6], [1.5, -.7, .3], [-.2, -.9, .25]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.5, h, .5), MAT.bone); b.position.set(x, h / 2, z); mini.add(b); }
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshStandardMaterial({ color: '#3E6B47', roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = .01; mini.add(grass);
  // mesa do corretor
  box(2.6, .78, 1.2, MAT.bone, -5, .39, 6.4, r); box(2.8, .05, 1.3, MAT.wood, -5, .8, 6.4, r);
  for (const x of [-5.6, -4.4]) { box(.6, .5, .6, MAT.fabric, x, .3, 7.6, r); }
  const d = device(.82, 1.5, .06, T.screenImobiliaria(), r); d.position.set(-3.1, 1.75, 8.1); d.rotation.set(-.05, .35, 0);
  box(.06, .95, .06, MAT.black, -3.1, .48, 8.05, r);
  plant(r, -9.2, 0, 2.6, 1.1); plant(r, 9.6, 0, 8.6, .9);
  roomLight('imobiliaria', '#FFCF9A', 3, 3.1, 6, 36); roomLight('imobiliaria', '#FFD9AE', -5, 3.1, 7, 20);
}

// Saguão (térreo, pé-direito duplo)
// Tela de vídeo: mostra um poster até o vídeo realmente tocar (o iOS não pinta vídeo que nunca tocou)
const SCREENS = [];
function videoScreen(src, poster, color) {
  const video = document.createElement('video');
  Object.assign(video, { src, muted: true, defaultMuted: true, loop: true, playsInline: true, preload: 'none', crossOrigin: 'anonymous' });
  video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  const pt = new THREE.TextureLoader().load(poster); pt.colorSpace = THREE.SRGBColorSpace;
  const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: pt, toneMapped: false, color: new THREE.Color(color, color, color) });
  video.addEventListener('playing', () => { if (mat.map !== vt) { mat.map = vt; mat.needsUpdate = true; } });
  const sc = { video, mat, want: false, state: 'parado' };
  ['playing', 'pause', 'waiting', 'stalled', 'error'].forEach(ev => video.addEventListener(ev, () => { sc.state = ev; }));
  SCREENS.push(sc); return sc;
}
function wantPlay(sc, on) {
  sc.want = on;
  const v = sc.video;
  if (on) {
    if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
    if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => { sc.state = 'bloqueado'; }); }
  } else if (!v.paused) v.pause();
}
// Modo de Pouca Energia do iOS recusa o play() automático; um toque libera. Tenta de novo a cada gesto.
for (const ev of ['touchend', 'pointerdown', 'click', 'scroll', 'keydown']) {
  addEventListener(ev, () => { for (const sc of SCREENS) if (sc.want && sc.video.paused) wantPlay(sc, true); }, { passive: true });
}

let lobbyVideo = null;
{
  const r = new THREE.Group(); tower.add(r); rooms.terreo = r;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 7.5), new THREE.MeshStandardMaterial({ color: '#2A2B38', roughness: .6 })); wall.position.set(0, 4.1, .05); r.add(wall);
  lobbyVideo = videoScreen('assets/historias.mp4', 'assets/historias.webp', .9);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 6.3), lobbyVideo.mat); led.position.set(3.4, 4.2, .12); r.add(led);
  box(11.6, 6.7, .1, MAT.black, 3.4, 4.2, .07, r);
  box(6.5, 1.1, 1.4, MAT.stone, -5, .75, 5, r); box(6.7, .06, 1.6, MAT.bone, -5, 1.33, 5, r);
  box(6.3, .04, .04, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, .8), toneMapped: false }), -5, .25, 5.72, r);
  for (let i = 0; i < 4; i++) { box(.3, 1.0, 1.4, MAT.metalLight, -1 + i * 2.2, .7, 8.4, r); }
  plant(r, -9.6, .2, 9.5, 1.4); plant(r, 9.8, .2, 9.6, 1.4);
  // porta
  box(.2, 4, .3, MAT.metalLight, -2.2, 2.2, HW + .1); box(.2, 4, .3, MAT.metalLight, 2.2, 2.2, HW + .1); box(4.6, .3, .3, MAT.metalLight, 0, 4.2, HW + .1);
  // marquise
  box(14, .35, 5, MAT.metal, 0, 5.2, HW + 2.6);
  box(13, .03, 4.4, new THREE.MeshBasicMaterial({ color: new THREE.Color(.75, .6, .45), toneMapped: false }), 0, 5.01, HW + 2.6);
  roomLight('terreo', '#FFCFA0', -5, 6.8, 5, 20, 22); roomLight('terreo', '#FFE2C2', 6, 6.8, 6, 10, 18);
  // praça: balizadores e árvores
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    const x = s * (9 + (i % 2) * 2), z = HW + 8 + i * 8;
    const bl = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .9, 10), MAT.metalLight); bl.position.set(x, .55, z); scene.add(bl);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, .8), toneMapped: false })); cap.position.set(x, 1.0, z); scene.add(cap);
    if (i % 2 === 0 && z < 44) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, 3, 8), MAT.wood); tr.position.set(s * 16, 1.6, z + 2); scene.add(tr);
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), MAT.plant); cr.position.set(s * 16, 4.4, z + 2); cr.scale.y = .85; scene.add(cr);
    }
  }
}

// Placa de rua: histórias de clientes à esquerda, o formulário (HTML) projetado no painel da direita
const BOARD = {};
let boardVideo = null;
{
  const g = new THREE.Group(); g.position.set(-11, 0, 66); g.userData.keep = true; scene.add(g); BOARD.g = g;
  const VW = 16, VH = 9, VY = 8.3;
  for (const x of [-4.5, 4.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, 4.8, 16), MAT.metal); p.position.set(x, 2.4, -.25); g.add(p); }
  box(VW + .4, VH + .4, .5, MAT.metal, 0, VY, -.12, g);
  box(VW + .4, .3, .8, MAT.metalLight, 0, VY + VH / 2 + .35, .05, g);
  box(VW, .06, .08, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.5), toneMapped: false }), 0, VY + VH / 2 + .15, .45, g);
  for (const x of [-6, 0, 6]) { box(.12, .12, 1.1, MAT.metal, x, VY + VH / 2 + .45, .6, g); box(.7, .3, .4, MAT.black, x, VY + VH / 2 + .4, 1.2, g); }
  boardVideo = videoScreen('assets/clientes.mp4', 'assets/clientes.webp', .92);
  const vid = new THREE.Mesh(new THREE.PlaneGeometry(VW, VH), boardVideo.mat);
  vid.position.set(0, VY, .16); g.add(vid);
  addLight('#D8DEFF', -11, 6, 71, 18, 18);
  // área do formulário: canto inferior direito do vídeo (em coordenadas do mundo)
  BOARD.x0 = -11 + 1.3; BOARD.x1 = -11 + 7.6; BOARD.y0 = VY - VH / 2 + .5; BOARD.z = 66.2;
}

// A carga que passa na frente da câmera entre a obra e o térreo
const FLY = new THREE.Group(); FLY.visible = false; FLY.userData.keep = true; scene.add(FLY);
{
  box(2.6, .18, 1.7, MAT.wood, 0, 0, 0, FLY);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) box(.82, .42, .78, MAT.concrete, -.86 + i * .86, .32 + k * .44, -.4 + j * .82, FLY);
  for (const x of [-.6, .6]) box(.12, 1.0, 1.74, MAT.yellow, x, .55, 0, FLY);
  const hookY = 3.2;
  for (const [x, z] of [[-1.2, -.8], [1.2, -.8], [-1.2, .8], [1.2, .8]]) {
    const a = new THREE.Vector3(x, 1.0, z), b = new THREE.Vector3(0, hookY, 0), m = a.clone().add(b).multiplyScalar(.5);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, a.distanceTo(b), 6), MAT.black);
    c.position.copy(m); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); FLY.add(c);
  }
  box(.36, .5, .2, MAT.crane, 0, hookY + .2, 0, FLY);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 60, 6), MAT.black); cab.position.y = hookY + 30; FLY.add(cab);
}

// O terreno ao lado: outro prédio subindo
const CRANE = {};
let SITE = null;
{
  const site = new THREE.Group(); site.position.set(54, 0, -2); scene.add(site); SITE = site;
  const levels = 7;
  for (let l = 0; l <= levels; l++) {
    const partial = l >= levels - 1;
    const sl = box(partial ? 12 : 20, .45, 20, MAT.concrete, partial ? -4 : 0, l * FH + .22, 0, site);
    if (l < levels) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (l >= levels - 2 && i > 1) continue;
      box(.7, FH, .7, MAT.concrete, -9 + i * 6, l * FH + FH / 2 + .22, -9 + j * 6, site);
    }
  }
  // vergalhões no topo
  const reb = new THREE.Group(); site.add(reb);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 4), new THREE.MeshStandardMaterial({ color: '#7A4B32', roughness: .7 }));
    b.position.set(-9 + i * 6 + (k % 2) * .3 - .15, levels * FH + 1.3, -9 + j * 6 + Math.floor(k / 2) * .3 - .15); reb.add(b);
  }
  // tela de proteção
  const net = T.netTexture(); net.repeat.set(10, 4);
  for (const z of [10.2]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: .1, side: THREE.DoubleSide, color: '#3C7A66' })); n.position.set(0, (levels - 2) * FH + 4.2, z); site.add(n); }
  // tapume e contêineres
  box(30, 2.4, .2, new THREE.MeshStandardMaterial({ color: '#D9D4C8', roughness: .9 }), 0, 1.2, 14, site);
  for (const [x, c] of [[-8, '#3E6FB5'], [-1.5, '#D9D4C8']]) {
    box(6, 2.6, 2.4, new THREE.MeshStandardMaterial({ color: c, roughness: .6 }), x, 1.3, 17, site);
    box(1.6, .8, .05, new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.6, 1.1), toneMapped: false }), x + 1.2, 1.6, 18.22, site);
  }
  // grua
  const lat = T.latticeTexture(); lat.repeat.set(1, 18);
  const latMat = new THREE.MeshStandardMaterial({ color: '#E6B33C', alphaMap: lat, transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .5, metalness: .3 });
  const mastH = 58; const cx = 8, cz = -6;
  for (let s = 0; s < 4; s++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, mastH), latMat); const a = s * Math.PI / 2;
    p.position.set(cx + Math.sin(a) * .8, mastH / 2, cz + Math.cos(a) * .8); p.rotation.y = a; site.add(p);
  }
  const jib = new THREE.Group(); jib.position.set(cx, mastH, cz); site.add(jib); CRANE.jib = jib;
  const lat2 = T.latticeTexture(); lat2.repeat.set(1, 30); lat2.rotation = Math.PI / 2;
  const jMat = latMat.clone(); jMat.alphaMap = lat2;
  for (const z of [-.6, .6]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(52, 1.2), jMat); p.position.set(-20, .6, z); jib.add(p); }
  box(52, .12, 1.3, MAT.crane, -20, 0, 0, jib); box(52, .1, .1, MAT.crane, -20, 1.2, 0, jib);
  box(14, .5, 1.6, MAT.crane, 9, .2, 0, jib);
  box(3, 2.2, 1.8, MAT.concrete, 13.5, -1, 0, jib);
  box(2, 1.8, 1.8, new THREE.MeshStandardMaterial({ color: '#E8E4D8', roughness: .4 }), 1.6, -1, 1.2, jib);
  box(.6, 6, .6, MAT.crane, 0, 3.6, 0, jib);
  const cable = box(.04, 24, .04, MAT.black, -26, -12, 0, jib);
  const load = box(2.4, .8, 1.6, MAT.wood, -26, -24.4, 0, jib); CRANE.load = load; CRANE.cable = cable;
  load.userData.keep = cable.userData.keep = true; jib.userData.keep = true;
  CRANE.top = beacon(0, 0, 0); jib.add(CRANE.top); CRANE.top.position.set(0, 6.8, 0);
  CRANE.tip = beacon(0, 0, 0); jib.add(CRANE.tip); CRANE.tip.position.set(-46, 1.3, 0);
  jib.rotation.y = .55;
  // refletores de obra
  for (const [x, y, z] of [[-10, 10, 11], [10, 18, 11]]) {
    box(.15, 2, .15, MAT.black, x, y - 1, z, site);
    const p = box(1.2, .7, .2, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.7), toneMapped: false }), x, y, z + .1, site); p.rotation.x = -.5;
  }
  addLight('#E8F0FF', 48, 14, 14, 120, 40); addLight('#FFE7C0', 62, 22, 12, 90, 40);
  // tablet da frente de trabalho, sobre o tripé
  const tp = new THREE.Group(); tp.position.set(-8.6, 3 * FH + .45, 9.2); site.add(tp);
  for (let i = 0; i < 3; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.5, 6), MAT.black); const a = i * 2.1; lg.position.set(Math.sin(a) * .3, .7, Math.cos(a) * .3); lg.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25); tp.add(lg); }
  const dv = device(1.7, 1.1, .1, T.screenObra(), tp, true); dv.position.set(0, 1.9, 0); dv.rotation.set(-.1, -1.1, 0);
  const capacete = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.yellow); capacete.position.set(1, .02, .4); tp.add(capacete);
  addLight('#FFE0B0', 47, 3 * FH + 3, 9, 30, 12);
}

/* ======================================================================
   Desempenho: funde a geometria parada por material (menos draw calls)
   ====================================================================== */
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(), drop = [];
  const walk = o => {
    for (const c of [...o.children]) {
      if (c.userData.keep) continue;
      if (c.isMesh && !c.isInstancedMesh && !Array.isArray(c.material) && c.children.length === 0) {
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) continue;
        g.clearGroups();
        g.applyMatrix4(_rel.multiplyMatrices(_inv, c.matrixWorld));
        const key = c.material.uuid + '|' + c.renderOrder;
        if (!buckets.has(key)) buckets.set(key, { m: c.material, ro: c.renderOrder, list: [] });
        buckets.get(key).list.push(g); drop.push(c);
      } else if (!c.isLight) walk(c);
    }
  };
  walk(root);
  for (const c of drop) c.parent.remove(c);
  for (const { m, ro, list } of buckets.values()) {
    const merged = mergeGeometries(list, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m); mesh.renderOrder = ro; root.add(mesh);
  }
}
tower.name = 'torre'; SITE.name = 'obra'; BOARD.g.name = 'placa'; FLY.name = 'carga';
for (const k in rooms) { mergeStatic(rooms[k]); rooms[k].userData.keep = true; }
mergeStatic(CRANE.jib);
SITE.userData.keep = true;

mergeStatic(SITE);
mergeStatic(FLY);
mergeStatic(BOARD.g);
mergeStatic(tower); tower.userData.keep = true;
mergeStatic(scene);
// matrizes fixas para tudo que não se mexe
const MOVING = new Set([FLY, CRANE.jib, CRANE.cable, CRANE.load, WAVE.arm, ...lightPool]);
scene.traverse(o => { if (!MOVING.has(o)) { o.updateMatrix(); o.matrixAutoUpdate = false; } });

/* ======================================================================
   Câmera pelo scroll
   ====================================================================== */
const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k[1].clone()), false, 'centripetal', .5);
const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k[2].clone()), false, 'centripetal', .5);
const N = KEYS.length - 1;
const easeSeg = (u, a, b) => {
  if (a && b) return u * u * (3 - 2 * u);
  if (a) return u * u;                // sai de uma parada
  if (b) return 1 - (1 - u) * (1 - u); // chega numa parada
  return u;
};
function camAt(t, outP, outT) {
  t = THREE.MathUtils.clamp(t, 0, TOTAL);
  let i = 0; while (i < N - 1 && t >= KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = THREE.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  const s = (i + easeSeg(u, a[3], b[3])) / N;
  posCurve.getPoint(s, outP); tgtCurve.getPoint(s, outT);
}

/* ======================================================================
   Texto em janelas da trilha
   ====================================================================== */
const blocks = [...document.querySelectorAll('[data-win]')].map(el => {
  const w = el.dataset.win; let a, b, kind = 'win';
  if (w === 'hero') { a = -1; b = .8; kind = 'hero'; }
  else if (w === 'finale') { a = 11.58; b = 99; kind = 'finale'; }
  else[a, b] = w.split(' ').map(Number);
  const anchor = el.classList.contains('blk--trail') ? 'trail' : el.classList.contains('blk--center') ? 'center' : 'lead';
  return { el, a, b, kind, anchor, op: -1 };
});
const scrims = Object.fromEntries([...document.querySelectorAll('[data-scrim]')].map(s => [s.dataset.scrim, s]));
const scrimOp = {};
const sstep = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const boardEl = document.querySelector('[data-board]');
const _v = new THREE.Vector3();
const adj = m => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
const mulMM = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let v = 0; for (let k = 0; k < 3; k++) v += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = v; } return c; };
const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const basis = p => { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1]; const v = mulMV(adj(m), [p[6], p[7], 1]); return mulMM(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
const BW = 480;
let boardH = 0;
addEventListener('resize', () => { boardH = 0; });
function placeBoard(op) {
  const on = camera.aspect >= 1.1 && op > 0;
  boardEl.classList.toggle('is-board', on);
  if (!on) { boardEl.style.transform = ''; return false; }
  const h = boardH || (boardH = boardEl.offsetHeight) || 300;
  const yTop = BOARD.y0 + (BOARD.x1 - BOARD.x0) * h / BW;
  const corners = [[BOARD.x0, yTop], [BOARD.x1, yTop], [BOARD.x0, BOARD.y0], [BOARD.x1, BOARD.y0]];
  const dst = [];
  for (const [x, y] of corners) {
    _v.set(x, y, BOARD.z).project(camera);
    if (_v.z > 1) { boardEl.style.transform = 'scale(0)'; return true; }
    dst.push((_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight);
  }
  const t = mulMM(basis(dst), adj(basis([0, 0, BW, 0, 0, h, BW, h])));
  const n = t.map(v => v / t[8]);
  boardEl.style.transform = 'matrix3d(' + [n[0], n[3], 0, n[6], n[1], n[4], 0, n[7], 0, 0, 1, 0, n[2], n[5], 0, n[8]].map(v => v.toFixed(6)).join(',') + ')';
  return true;
}
function updateCopy(t) {
  const sc = { lead: 0, trail: 0, center: 0 };
  for (const B of blocks) {
    let op, prog;
    if (B.kind === 'hero') { op = 1 - sstep((t - .42) / .38); prog = t / .8; }
    else if (B.kind === 'finale') { op = sstep((t - B.a) / .3); prog = Math.min(1, (t - B.a) / .5); }
    else { const r = Math.min(.32, (B.b - B.a) * .28); op = Math.min(sstep((t - B.a) / r), sstep((B.b - t) / r)); prog = (t - B.a) / (B.b - B.a); }
    op = Math.round(op * 1000) / 1000;
    const dy = REDUCED ? 0 : (B.kind === 'finale' ? 2 * (1 - prog) : B.kind === 'hero' ? -2 * Math.max(0, prog) : 2 - 4 * THREE.MathUtils.clamp(prog, 0, 1));
    if (op !== B.op) {
      B.el.style.opacity = op; B.el.style.visibility = op < .01 ? 'hidden' : 'visible';
      B.el.classList.toggle('is-on', op > .5); B.op = op;
      if (op < .01) B.el.setAttribute('inert', ''); else B.el.removeAttribute('inert');
    }
    if (op > .005) {
      const q = Math.round(dy * 40) / 40;
      if (q !== B.dy) { B.el.style.setProperty('--dy', q + 'vh'); B.dy = q; }
    }
    if (B.kind === 'finale' && placeBoard(op)) continue;
    sc[B.anchor] = Math.max(sc[B.anchor], op);
  }
  for (const k in scrims) { const v = Math.round(sc[k] * 100) / 100; if (scrimOp[k] !== v) { scrims[k].style.opacity = v; scrimOp[k] = v; } }
}

/* ======================================================================
   Elevador (mapa clicável)
   ====================================================================== */
const liftNum = document.getElementById('liftNum'), liftName = document.getElementById('liftName');
const liftArrow = document.querySelector('.lift__arrow');
const railBtns = [...document.querySelectorAll('.lift__floors button')];
let maxReached = 0, lastNum = '', lastCur = -1, lastLit = -1, lastUp = null;
function updateLift(t, camY, vel) {
  maxReached = Math.max(maxReached, t);
  let cur = 0, lit = 0; WAYPOINTS.forEach((w, i) => { if (t >= w.t - .35) cur = i; if (maxReached >= w.t - .35) lit = i; });
  if (cur !== lastCur || lit !== lastLit) {
    railBtns.forEach((b, i) => { b.setAttribute('aria-current', String(i === cur)); b.classList.toggle('is-lit', i <= lit); });
    lastCur = cur; lastLit = lit;
  }
  let num;
  if (t > 10.7) num = 'E';
  else if (camY > H + 1) num = 'C';
  else if (camY < 7) num = 'T';
  else num = String(Math.min(FLOORS - 1, Math.max(2, Math.floor((camY - 1.2) / FH))));
  if (WAYPOINTS[cur].id === 'obra' && t > 8.05) num = '3';
  if (num !== lastNum) { liftNum.textContent = num; lastNum = num; }
  const nm = WAYPOINTS[cur].name; if (liftName.textContent !== nm) liftName.textContent = nm;
  if (Math.abs(vel) > .0005 && (vel < 0) !== lastUp) { lastUp = vel < 0; liftArrow.classList.toggle('is-up', lastUp); }
}
function goTo(id) {
  const w = WAYPOINTS.find(x => x.id === id); if (!w) return;
  const top = (w.id === 'praca' ? TOTAL : w.t + (w.id === 'seguranca' ? .05 : .15)) * vh;
  scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
}
document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault(); goTo(el.dataset.goto);
  if (el.dataset.goto === 'praca') setTimeout(() => document.querySelector('#demoForm input')?.focus({ preventScroll: true }), REDUCED ? 50 : 1400);
}));
document.querySelector('.skip').addEventListener('click', e => { e.preventDefault(); goTo('praca'); setTimeout(() => document.querySelector('#demoForm input')?.focus({ preventScroll: true }), 60); });

/* ---------- Formulário ---------- */
const ENDPOINT = ''; // conecte ao CRM antes de publicar
document.getElementById('demoForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget, msg = document.getElementById('formMsg');
  let ok = true;
  for (const el of form.querySelectorAll('[required]')) {
    const bad = !el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
    el.setAttribute('aria-invalid', String(bad)); if (bad && ok) { el.focus(); ok = false; }
  }
  msg.classList.remove('is-ok');
  if (!ok) { msg.textContent = 'Preencha os campos marcados. O e-mail precisa ser válido.'; return; }
  const btn = form.querySelector('button'); btn.disabled = true;
  try {
    if (ENDPOINT) await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    msg.textContent = 'Pedido de demonstração enviado. Vamos responder no seu e-mail de trabalho.'; msg.classList.add('is-ok');
    btn.textContent = 'Pedido enviado';
  } catch {
    msg.textContent = 'Não conseguimos enviar agora. Tente de novo em alguns segundos.'; btn.disabled = false;
  }
});

/* ======================================================================
   Layout, ponteiro, laço
   ====================================================================== */
const spacer = document.getElementById('spacer');
let vh = innerHeight || 800, vw = innerWidth || 1280;
const stageEl = document.querySelector('.stage');
let sw = 0, sh = 0;
function layout(force) {
  const w = innerWidth || vw, h = innerHeight || vh;
  if (!force && COARSE && w === vw) return;                 // só a barra do navegador mudou
  vw = w; vh = h;
  spacer.style.height = Math.round((TOTAL + 1) * vh) + 'px';
  const W = stageEl.clientWidth || w, Hh = stageEl.clientHeight || h;
  if (W !== sw || Hh !== sh || force) {
    sw = W; sh = Hh;
    renderer.setSize(W, Hh, false);
    if (composer) { composer.setSize(W, Hh); bloom.setSize(W * .5, Hh * .5); }
  }
  camera.aspect = W / Hh;
  camera.fov = camera.aspect < .9 ? 58 : camera.aspect < 1.3 ? 46 : 38;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => layout(false));
layout(true);
addEventListener('load', () => layout(true));
document.fonts?.ready?.then(() => layout(true));

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
if (!COARSE && !REDUCED) addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

let tS = (scrollY / vh) || 0, lastT = tS;
const P = new THREE.Vector3(), Q = new THREE.Vector3(), tmp = new THREE.Vector3();
const veil = document.getElementById('veil');
const rnd = n => Math.round(n * 1000) / 1000;

function portraitAdjust(p, q, t) {
  const a = camera.aspect;
  if (a < 1.1 && t > 11.4) { const w = sstep((t - 11.4) / .5); tmp.subVectors(p, q).multiplyScalar(1 + .38 * w); p.copy(q).add(tmp); q.y -= 1.0 * w; }
  if (a >= 1.2) return;
  const k = a < .9 ? 1.32 : 1.12;
  tmp.subVectors(p, q).multiplyScalar(k); p.copy(q).add(tmp); p.y = Math.max(p.y, 1.4);
  q.y -= a < .9 ? 1.1 : .4;
  // no saguão, sobe a cena para o painel de vídeo ficar acima do texto
  if (a < .9) q.y -= 2.2 * sstep((t - 9.3) / .3) * (1 - sstep((t - 10.45) / .3));
}

const LERP = COARSE ? .16 : .1;
const _right = new THREE.Vector3(), _rt = new THREE.Vector3();
const prevL = new Float32Array(FLOORS + 1).fill(-1); let prevG = -1;
let skip = false, perfN = 0, perfSum = 0, downgrades = 0;
function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, .05);
  // regulador: se o aparelho não acompanha, reduz a resolução (até 3 vezes)
  perfSum += rawDt; perfN++;
  if (perfN === 90) {
    if (perfSum / perfN > .03 && downgrades < 3 && DPR > .9) {
      DPR = Math.max(.85, DPR - .2); renderer.setPixelRatio(DPR); renderer.setSize(sw, sh, false);
      if (composer) { composer.setPixelRatio(DPR); composer.setSize(sw, sh); }
      downgrades++;
    }
    perfN = 0; perfSum = 0;
  }
  U.uTime.value += dt;
  const target = THREE.MathUtils.clamp(scrollY / vh || 0, 0, TOTAL);

  // A câmera segue o scroll também com "reduzir movimento": é o próprio dedo que move a cena.
  // Nesse modo saem só os movimentos automáticos (paralaxe, cintilação, guindaste, aceno, carga).
  tS += (target - tS) * (1 - Math.pow(1 - LERP, dt * 60));
  if (Math.abs(target - tS) < 1e-4) tS = target;
  camAt(tS, P, Q);
  portraitAdjust(P, Q, tS);
  pointer.sx += (pointer.x - pointer.sx) * .05; pointer.sy += (pointer.y - pointer.sy) * .05;
  tmp.subVectors(Q, P).normalize();
  const right = _right.crossVectors(tmp, camera.up).normalize();
  P.addScaledVector(right, pointer.sx * .7).addScaledVector(camera.up, -pointer.sy * .4);
  camera.position.copy(P); camera.lookAt(Q);

  const t = tS;
  const now = U.uTime.value;

  // assinatura: andares acendem quando a câmera passa por eles, e ficam acesos
  for (let f = 0; f < FLOORS; f++) {
    const passed = P.y < f * FH + 3.4 && t > .55;
    if (passed && LT[f] === 0) { LT[f] = 1; LON[f] = now + (REDUCED ? -10 : (f % 3) * .05); }
    if (LT[f]) {
      const age = now - LON[f];
      let v = REDUCED ? 1 : Math.min(1, Math.max(0, age) / .7);
      if (!REDUCED && age < .42) v *= (age < .08 || (age > .16 && age < .22)) ? .15 : 1; // partida de lâmpada
      L[f] = v;
    }
  }

  // o pico: blecaute na segurança
  const black = sstep((t - 3.22) / .2) * (1 - sstep((t - 3.86) / .3));
  const tab = sstep((t - 3.6) / .16);
  const G = 1 - .82 * black;
  U.uDim.value = 1 - .7 * black;
  const L14 = L[14]; L[14] = L14 * (1 - black);
  let dirty = G !== prevG;
  for (let f = 0; f < FLOORS && !dirty; f++) if (L[f] !== prevL[f]) dirty = true;
  if (dirty) { applyFloorLights(G); prevL.set(L); prevG = G; }
  L[14] = L14;
  SEC.monitors.forEach(m => m.material.color.setScalar((1 - black) * .95 + .02));
  SEC.tablet.userData.screen.material.color.setScalar(.02 + 1.05 * tab);
  SEC.halo.material.opacity = .55 * tab * (1 - .55 * (1 - black));
  SEC.tabletLight.intensity = 26 * tab;
  for (const d of LIGHTS) if (d.key) d.intensity = d.base * L[ROOM_FLOOR[d.key]] * (d.key === 'seguranca' ? (1 - black) : 1);
  assignLights(P);
  SEC.rec.visible = (now % 1.4) < .7 && black < .5;
  hemi.intensity = .9 * (1 - .55 * black);

  // vidro mais aberto onde a câmera se aproxima
  for (const f in FEATURE) glassFront[f].material.opacity = .5 - .4 * Math.max(0, 1 - Math.abs(P.y - (+f * FH + 2)) / 6) * (P.z < 30 ? 1 : 0);
  glassFront[0].material.opacity = .5 - .4 * (P.y < 8 && P.z < 32 ? 1 : 0);

  // só desenha os andares em destaque quando a câmera está por perto
  for (const k in rooms) rooms[k].visible = Math.abs(P.y - (rooms[k].position.y + 2)) < 28;

  // vida no mundo
  for (const b of beacons) b.visible = (now + b.position.x * .01) % 2 < 1.1;
  if (!REDUCED) {
    CRANE.jib.rotation.y = .55 + Math.sin(now * .12) * .18; CRANE.jib.updateMatrix();
    const drop = 24 + Math.sin(now * .35) * 3; CRANE.cable.scale.y = drop / 24; CRANE.cable.position.y = -drop / 2; CRANE.load.position.y = -drop - .4;
  }
  // aceno no 10º e a carga passando pela frente entre a obra e o térreo
  if (WAVE.arm) WAVE.arm.rotation.z = REDUCED ? .55 : .55 + Math.sin(now * 6.5) * .38;
  const fu = (t - 9.0) / .42;
  FLY.visible = !REDUCED && fu > 0 && fu < 1;
  if (FLY.visible) {
    const fwd = tmp.subVectors(Q, camera.position).normalize();
    const rt = _rt.crossVectors(fwd, camera.up).normalize();
    FLY.position.copy(camera.position).addScaledVector(fwd, 4.4).addScaledVector(rt, 7 - 14 * fu);
    FLY.position.y -= 1.0;
    FLY.rotation.set(0, Math.atan2(fwd.x, fwd.z) + .35 + Math.sin(fu * Math.PI) * .12, Math.sin(fu * 9) * .03);
  }
  // vídeos: baixam um pouco antes, tocam só quando a cena está na tela
  if (t > 10.1 && boardVideo.video.preload === 'none') { boardVideo.video.preload = 'auto'; boardVideo.video.load(); }
  if (t > 7.9 && lobbyVideo.video.preload === 'none') { lobbyVideo.video.preload = 'auto'; lobbyVideo.video.load(); }
  const wantB = t > 10.9, wantL = t > 8.9 && t < 10.9;
  if (wantB !== boardVideo.want) wantPlay(boardVideo, wantB);
  if (wantL !== lobbyVideo.want) wantPlay(lobbyVideo, wantL);

  updateCopy(t);
  updateLift(t, P.y, tS - lastT); lastT = tS;
  // celular parado: desenha a 30 fps para não esquentar (o que esquenta, trava)
  const settled = Math.abs(target - tS) < 1e-3;
  skip = MOBILE && settled && !skip;
  if (!skip) draw();
  debugHud(rawDt);
}

const DEBUG = /[?&]debug/.test(location.search);
let dbgEl = null, dbgN = 0, dbgAcc = 0;
function debugHud(dt) {
  if (!DEBUG) return;
  if (!dbgEl) { dbgEl = document.createElement('pre'); dbgEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:8px 10px;font:11px/1.35 monospace;color:#0f0;background:rgba(0,0,0,.78);border-radius:6px;pointer-events:none;white-space:pre'; document.body.appendChild(dbgEl); }
  dbgN++; dbgAcc += dt;
  if (dbgAcc < .5) return;
  const fps = Math.round(dbgN / dbgAcc); dbgN = 0; dbgAcc = 0;
  dbgEl.textContent = [
    'fps ' + fps + '  dpr ' + DPR.toFixed(2) + '  canvas ' + renderer.domElement.width + 'x' + renderer.domElement.height,
    'reduzir movimento: ' + (REDUCED ? 'SIM' : 'não') + '  toque: ' + (COARSE ? 'sim' : 'não') + '  bloom: ' + (composer ? 'sim' : 'não'),
    't ' + tS.toFixed(2) + ' / ' + TOTAL + '  draw calls ' + renderer.info.render.calls,
    'vídeo saguão: ' + lobbyVideo.state + (lobbyVideo.video.paused ? ' (pausado)' : '') + '  placa: ' + boardVideo.state + (boardVideo.video.paused ? ' (pausado)' : ''),
  ].join('\n');
}

function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

// estado inicial: tudo apagado, a cidade acesa
applyFloorLights(1);

async function warmUp() {
  const vis = Object.values(rooms).map(r => r.visible);
  Object.values(rooms).forEach(r => { r.visible = true; }); FLY.visible = true;
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch { renderer.compile(scene, camera); }
  const seen = new Set();
  scene.traverse(o => { const m = o.material; if (!m) return; for (const k of ['map', 'alphaMap', 'envMap']) { const t = m[k]; if (t && !t.isVideoTexture && !seen.has(t)) { seen.add(t); renderer.initTexture(t); } } });
  Object.values(rooms).forEach((r, i) => { r.visible = vis[i]; }); FLY.visible = false;
}
warmUp().finally(() => requestAnimationFrame(() => { frame(); setTimeout(() => veil.classList.add('is-off'), 120); }));
window.__scene = { scene, camera, renderer, L, get t() { return tS; } };
