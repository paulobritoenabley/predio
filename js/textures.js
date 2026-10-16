// Texturas desenhadas em canvas: telas do app, interiores, QR, CFTV, maquete.
import * as THREE from 'three';

const PURPLE = '#92228A';
const PURPLE_2 = '#B5279F';
const INK = '#1E1A2B';
const SOFT = '#6E6A7C';
const YELLOW = '#FFD84A';
const GREEN = '#2FB57A';

let logoImg = null;
export function setLogo(img) { logoImg = img; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function font(g, weight, size, family = 'Montserrat') { g.font = `${weight} ${size}px ${family}, system-ui, sans-serif`; }
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = ''; let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, yy);
  return yy + lh;
}
function check(g, x, y, r, done = true) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = done ? GREEN : '#E4E1EC'; g.fill();
  if (done) {
    g.strokeStyle = '#fff'; g.lineWidth = r * 0.28; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - r * .42, y + r * .02); g.lineTo(x - r * .1, y + r * .34); g.lineTo(x + r * .45, y - r * .3); g.stroke();
  } else {
    g.strokeStyle = PURPLE; g.lineWidth = r * .22; g.beginPath(); g.arc(x, y, r * .5, -Math.PI / 2, Math.PI * .6); g.stroke();
  }
}
function header(g, w, s, title) {
  if (logoImg) {
    const lw = 150 * s, lh = lw * (logoImg.height / logoImg.width);
    g.drawImage(logoImg, 34 * s, 40 * s, lw, lh);
  }
  font(g, 800, 46 * s); g.fillStyle = INK; g.fillText(title, 40 * s, 160 * s);
}
function ring(g, x, y, r, pct, label) {
  g.lineWidth = r * .26; g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = YELLOW; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); g.stroke();
  font(g, 800, r * .62); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, x, y + 2); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function card(g, x, y, w, h, s) {
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, PURPLE); grd.addColorStop(1, PURPLE_2);
  rr(g, x, y, w, h, 28 * s); g.fillStyle = grd; g.fill();
}
function item(g, x, y, w, s, text, done = true) {
  rr(g, x, y, w, 76 * s, 18 * s); g.fillStyle = '#fff'; g.fill();
  g.shadowColor = 'transparent';
  check(g, x + 40 * s, y + 38 * s, 17 * s, done);
  font(g, 600, 25 * s); g.fillStyle = INK; g.fillText(text, x + 74 * s, y + 47 * s);
}
function bg(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#FBFAFD'); grd.addColorStop(1, '#EEEBF4');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
}

/* ---------- Telas do app, uma por setor ---------- */
export function screenRecepcao() {
  const [c, g] = canvas(600, 1100); const s = 1; bg(g, 600, 1100);
  header(g, 600, s, 'Minha trilha');
  card(g, 34, 200, 532, 230, s);
  ring(g, 130, 315, 68, 1, '100%');
  font(g, 600, 22); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('Cargo', 230, 268);
  font(g, 800, 38); g.fillStyle = '#fff'; g.fillText('Recepcionista', 230, 312);
  font(g, 500, 22, 'Geist'); g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText('4 módulos · disponível offline', 230, 352);
  const items = ['Boas-vindas ao cliente', 'Controle de visitantes', 'Postura e atendimento', 'Emergência e evacuação'];
  items.forEach((t, i) => item(g, 34, 462 + i * 92, 532, s, t));
  rr(g, 34, 860, 532, 86, 43); g.fillStyle = YELLOW; g.fill();
  font(g, 800, 28); g.fillStyle = '#2A2006'; g.textAlign = 'center'; g.fillText('Certificado emitido', 300, 914); g.textAlign = 'left';
  font(g, 500, 22, 'Geist'); g.fillStyle = SOFT; g.fillText('Posto: Edifício Atlântico, portaria A', 40, 1010);
  return tex(c);
}

export function screenSeguranca() {
  const [c, g] = canvas(1280, 820); bg(g, 1280, 820);
  if (logoImg) g.drawImage(logoImg, 46, 40, 170, 170 * logoImg.height / logoImg.width);
  font(g, 600, 26, 'Geist'); g.fillStyle = SOFT; g.fillText('Posto Embaixada · turno da noite', 860, 78);
  font(g, 800, 54); g.fillStyle = INK; g.fillText('Vigilante patrimonial', 50, 180);
  card(g, 50, 220, 560, 300, 1);
  ring(g, 170, 370, 84, .75, '75%');
  font(g, 600, 24); g.fillStyle = 'rgba(255,255,255,.78)'; g.fillText('Sua trilha', 290, 320);
  font(g, 800, 40); g.fillStyle = '#fff'; g.fillText('3 de 4 módulos', 290, 368);
  font(g, 500, 24, 'Geist'); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('Termina hoje no posto', 290, 410);
  // selo offline
  rr(g, 50, 552, 560, 96, 22); g.fillStyle = '#1F1A33'; g.fill();
  g.fillStyle = YELLOW; g.beginPath(); g.arc(102, 600, 20, 0, Math.PI * 2); g.fill();
  font(g, 800, 30); g.fillStyle = '#fff'; g.fillText('Funciona sem internet', 140, 596);
  font(g, 500, 22, 'Geist'); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('Conteúdo baixado no tablet do posto', 140, 628);
  const items = [['Ronda e controle de acesso', true], ['Rádio e protocolo de chamada', true], ['Abordagem segura', true], ['Plano de emergência do posto', false]];
  items.forEach(([t, d], i) => item(g, 650, 220 + i * 98, 580, 1.08, t, d));
  rr(g, 650, 640, 580, 84, 42); g.fillStyle = PURPLE; g.fill();
  font(g, 800, 30); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Continuar módulo 4', 940, 693); g.textAlign = 'left';
  return tex(c);
}

export function screenLimpeza() {
  const [c, g] = canvas(600, 1100); bg(g, 600, 1100);
  header(g, 600, 1, 'Checklist');
  font(g, 500, 24, 'Geist'); g.fillStyle = SOFT; g.fillText('Sanitário · 10º andar · bloco B', 40, 204);
  rr(g, 34, 236, 532, 70, 35); g.fillStyle = '#F1E6F3'; g.fill();
  font(g, 700, 22); g.fillStyle = PURPLE; g.fillText('Aberto pelo QR code do ponto', 64, 280);
  const items = [['Diluição 1:10 do desinfetante', true], ['Sequência: alto para baixo', true], ['Louças e metais', true], ['Reposição de papel e sabonete', true], ['Piso e sinalização', true], ['Registro de horário', false]];
  items.forEach(([t, d], i) => item(g, 34, 334 + i * 92, 532, 1, t, d));
  font(g, 800, 64); g.fillStyle = INK; g.fillText('5 de 6', 40, 950);
  font(g, 500, 24, 'Geist'); g.fillStyle = SOFT; g.fillText('Supervisão recebe ao concluir', 40, 992);
  return tex(c);
}

export function screenImobiliaria() {
  const [c, g] = canvas(600, 1100); bg(g, 600, 1100);
  header(g, 600, 1, 'Comunicados');
  rr(g, 34, 196, 532, 330, 28); g.fillStyle = YELLOW; g.fill();
  font(g, 700, 22); g.fillStyle = '#5A4500'; g.fillText('Lançamento', 66, 246);
  font(g, 800, 40); g.fillStyle = '#2A2006'; g.fillText('Residencial Aurora', 66, 296);
  font(g, 500, 24, 'Geist'); g.fillStyle = '#3D3109';
  wrap(g, 'Tabela de vendas e memorial descritivo atualizados. Leia antes do plantão.', 66, 340, 470, 34);
  rr(g, 66, 430, 468, 70, 35); g.fillStyle = '#2A2006'; g.fill();
  font(g, 800, 25); g.fillStyle = YELLOW; g.textAlign = 'center'; g.fillText('Confirmar leitura', 300, 474); g.textAlign = 'left';
  // AI Companion
  font(g, 800, 30); g.fillStyle = INK; g.fillText('AI Companion', 40, 600);
  rr(g, 150, 630, 416, 110, 26); g.fillStyle = PURPLE; g.fill();
  font(g, 500, 24, 'Geist'); g.fillStyle = '#fff'; wrap(g, 'A vaga da torre B é coberta?', 178, 680, 370, 32);
  rr(g, 34, 768, 470, 170, 26); g.fillStyle = '#fff'; g.fill();
  font(g, 500, 24, 'Geist'); g.fillStyle = INK; wrap(g, 'Sim. Pelo memorial oficial, todas as vagas da torre B são cobertas e demarcadas.', 62, 816, 420, 32);
  font(g, 500, 20, 'Geist'); g.fillStyle = SOFT; g.fillText('Fonte: memorial descritivo, versão 3', 40, 990);
  return tex(c);
}

export function screenObra() {
  const [c, g] = canvas(1280, 820); bg(g, 1280, 820);
  if (logoImg) g.drawImage(logoImg, 46, 40, 170, 170 * logoImg.height / logoImg.width);
  font(g, 600, 26, 'Geist'); g.fillStyle = SOFT; g.fillText('Obra Torre 2 · frente norte', 900, 78);
  font(g, 800, 54); g.fillStyle = INK; g.fillText('Trabalho em altura', 50, 180);
  card(g, 50, 220, 560, 280, 1);
  font(g, 600, 24); g.fillStyle = 'rgba(255,255,255,.78)'; g.fillText('Equipe da frente', 90, 290);
  font(g, 900, 110); g.fillStyle = '#fff'; g.fillText('18/20', 90, 410);
  font(g, 500, 26, 'Geist'); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('aptos para subir hoje', 92, 460);
  const items = [['Assinatura eletrônica', true], ['Prova com 9,0', true], ['Recertificação em 12 dias', false], ['Checklist do cinto e talabarte', true]];
  items.forEach(([t, d], i) => item(g, 650, 220 + i * 98, 580, 1.08, t, d));
  rr(g, 50, 540, 560, 96, 22); g.fillStyle = '#1F1A33'; g.fill();
  font(g, 800, 30); g.fillStyle = '#fff'; g.fillText('2 pendentes avisados', 90, 598);
  return tex(c);
}

export function screenLancamento() {
  const [c, g] = canvas(1280, 720);
  const grd = g.createLinearGradient(0, 0, 0, 720);
  grd.addColorStop(0, '#1B2457'); grd.addColorStop(.6, '#6A3E7A'); grd.addColorStop(1, '#F0A070');
  g.fillStyle = grd; g.fillRect(0, 0, 1280, 720);
  // torre ilustrada
  g.fillStyle = '#121735'; g.fillRect(760, 120, 260, 600);
  g.fillStyle = '#0D1129'; g.fillRect(1020, 230, 120, 490);
  for (let y = 140; y < 700; y += 26) for (let x = 776; x < 1004; x += 22) {
    g.fillStyle = Math.random() > .35 ? 'rgba(255,200,130,.9)' : 'rgba(80,90,140,.6)'; g.fillRect(x, y, 14, 14);
  }
  font(g, 600, 30, 'Geist'); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText('Lançamento', 80, 300);
  font(g, 900, 86); g.fillStyle = '#fff'; g.fillText('Aurora', 76, 390);
  font(g, 500, 30, 'Geist'); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('2 e 3 dormitórios · plantão aberto', 80, 446);
  return tex(c);
}

/* ---------- Ambientes ---------- */
// Fundo de escritório visto pelo vidro: luz quente, divisórias, mesas e pessoas em silhueta.
export function interiorStrip(seed = 1) {
  const W = 2048, H = 320; const [c, g] = canvas(W, H);
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#FFE7C4'); grd.addColorStop(.55, '#E9B57E'); grd.addColorStop(1, '#5B3B2A');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // colunas e divisórias
  for (let x = 0; x < W; x += 180 + rnd() * 160) {
    g.fillStyle = `rgba(60,38,30,${.25 + rnd() * .35})`; g.fillRect(x, 0, 10 + rnd() * 26, H);
  }
  // telas acesas
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = H * .52 + rnd() * 20;
    g.fillStyle = rnd() > .5 ? 'rgba(190,220,255,.95)' : 'rgba(255,245,225,.95)';
    g.fillRect(x, y, 34 + rnd() * 20, 22);
  }
  // pessoas e mesas
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W, s = .55 + rnd() * .3;
    g.fillStyle = 'rgba(48,30,26,.82)';
    g.beginPath(); g.arc(x, H * .5 - 34 * s, 13 * s, 0, Math.PI * 2); g.fill();
    rr(g, x - 20 * s, H * .5 - 18 * s, 40 * s, 80 * s, 14 * s); g.fill();
  }
  g.fillStyle = 'rgba(40,24,20,.9)';
  for (let x = 0; x < W; x += 120 + rnd() * 120) g.fillRect(x, H * .66, 90 + rnd() * 80, 10);
  g.fillStyle = 'rgba(35,22,18,.75)'; g.fillRect(0, H * .82, W, H * .18);
  return tex(c);
}

export function poolTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return tex(c, { srgb: false });
}
export function dotTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.25, 'rgba(255,255,255,.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false });
}

export function qrTexture() {
  const N = 29, S = 16, P = 3; const [c, g] = canvas((N + P * 2) * S, (N + P * 2) * S + 90);
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#15121F';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (rnd() > .52) g.fillRect((x + P) * S, (y + P) * S, S, S);
  const finder = (fx, fy) => {
    g.fillStyle = '#fff'; g.fillRect((fx + P - 1) * S, (fy + P - 1) * S, 9 * S, 9 * S);
    g.fillStyle = '#15121F'; g.fillRect((fx + P) * S, (fy + P) * S, 7 * S, 7 * S);
    g.fillStyle = '#fff'; g.fillRect((fx + P + 1) * S, (fy + P + 1) * S, 5 * S, 5 * S);
    g.fillStyle = '#15121F'; g.fillRect((fx + P + 2) * S, (fy + P + 2) * S, 3 * S, 3 * S);
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  g.fillStyle = PURPLE; g.fillRect(0, c.height - 90, c.width, 90);
  font(g, 800, 34); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Aponte para o procedimento', c.width / 2, c.height - 34);
  return tex(c);
}

export function cctvTexture(i) {
  const [c, g] = canvas(320, 200);
  const grd = g.createLinearGradient(0, 0, 0, 200);
  grd.addColorStop(0, '#2B3D55'); grd.addColorStop(1, '#0E1726'); g.fillStyle = grd; g.fillRect(0, 0, 320, 200);
  g.strokeStyle = 'rgba(160,190,220,.45)'; g.lineWidth = 2;
  const vx = 120 + (i * 37) % 90, vy = 70 + (i * 17) % 30;
  for (const [x, y] of [[0, 200], [320, 200], [0, 0], [320, 0]]) { g.beginPath(); g.moveTo(vx, vy); g.lineTo(x, y); g.stroke(); }
  g.strokeRect(vx - 40, vy - 26, 80, 52);
  if (i % 2 === 0) { g.fillStyle = 'rgba(20,28,40,.9)'; g.beginPath(); g.arc(vx + 20, vy + 40, 9, 0, 7); g.fill(); g.fillRect(vx + 11, vy + 50, 18, 34); }
  font(g, 600, 16, 'Geist'); g.fillStyle = 'rgba(220,235,255,.85)'; g.fillText(`CAM 0${i + 1}`, 12, 22);
  g.fillStyle = '#FF4A4A'; g.beginPath(); g.arc(300, 16, 5, 0, 7); g.fill();
  return tex(c);
}

export function woodTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#7A5136'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) {
    g.strokeStyle = `rgba(${40 + Math.random() * 40},${24 + Math.random() * 20},14,${.15 + Math.random() * .2})`;
    g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * 512;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + Math.random() * 10 - 5, 340, y + Math.random() * 10 - 5, 512, y); g.stroke();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function tileTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#C9CFD8'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#EEF1F5';
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) g.fillRect(x + 2, y + 2, 60, 60);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function latticeTexture() {
  const [c, g] = canvas(128, 512);
  g.clearRect(0, 0, 128, 512);
  g.strokeStyle = '#fff'; g.lineWidth = 10;
  g.strokeRect(5, -10, 118, 532);
  for (let y = 0; y < 512; y += 128) { g.beginPath(); g.moveTo(5, y); g.lineTo(123, y + 128); g.moveTo(123, y); g.lineTo(5, y + 128); g.stroke(); g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  const t = tex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function netTexture() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(30,70,60,.9)'; g.lineWidth = 2;
  for (let i = -256; i < 512; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function slatTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#5C3B27'; g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 24) {
    const grd = g.createLinearGradient(x, 0, x + 18, 0);
    grd.addColorStop(0, '#A06E48'); grd.addColorStop(1, '#7A5034');
    g.fillStyle = grd; g.fillRect(x + 3, 0, 16, 256);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
