import { useEffect, useRef } from "react";

// Rough continent outlines as [lon, lat] polygons. Coastlines are roughened with noise at load.
const LAND = [
  [[-168,66],[-156,71],[-125,70],[-95,72],[-80,73],[-62,60],[-55,50],[-67,44],[-76,35],[-81,25],[-97,26],[-97,18],[-87,21],[-83,10],[-78,8],[-92,15],[-105,20],[-115,30],[-124,40],[-125,49],[-140,60],[-165,60]],
  [[-73,78],[-55,82],[-20,82],[-20,70],[-42,60],[-55,68]],
  [[-78,8],[-62,11],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-42],[-68,-54],[-74,-50],[-72,-30],[-70,-18],[-81,-6],[-80,2]],
  [[-17,21],[-6,35],[10,37],[32,31],[43,12],[51,12],[40,-3],[40,-16],[33,-26],[20,-35],[12,-18],[9,-1],[-8,4],[-17,14]],
  [[-10,36],[-9,43],[-2,48],[5,52],[10,57],[20,70],[40,68],[70,73],[100,77],[140,72],[180,68],[170,60],[160,52],[142,46],[135,35],[122,30],[122,22],[108,18],[105,9],[100,14],[98,8],[103,1],[95,18],[80,8],[73,20],[58,25],[48,30],[56,17],[43,13],[35,28],[34,36],[27,37],[20,40],[12,44],[3,43],[-6,36]],
  [[114,-22],[122,-18],[131,-12],[142,-11],[146,-19],[153,-26],[150,-37],[141,-38],[131,-31],[115,-34]],
  [[130,32],[135,35],[141,41],[142,38],[135,33]],
  [[95,5],[105,-6],[120,-9],[140,-8],[135,-1],[118,1],[110,-3]],
  [[-6,50],[1,51],[-2,58],[-6,56]],
  [[44,-25],[50,-15],[48,-13],[44,-20]],
  [[-180,-72],[180,-72],[180,-90],[-180,-90]],
];
const W = 512, H = 256;

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, px) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const m = (n) => ((n % px) + px) % px;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(m(xi), yi), b = hash(m(xi + 1), yi), c = hash(m(xi), yi + 1), d = hash(m(xi + 1), yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
const fbm = (x, y, px, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, px * f); a /= 2; f *= 2; } return v; };

function bakeMaps() {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff"; g.filter = "blur(2px)";
  LAND.forEach((poly) => { g.beginPath(); poly.forEach(([lo, la], i) => { const x = ((lo + 180) / 360) * W, y = ((90 - la) / 180) * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); });
  const px = g.getImageData(0, 0, W, H).data;
  const land = new Float32Array(W * H), cloud = new Float32Array(W * H), relief = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const n = fbm(x / 20, y / 20, W / 20, 5);
    land[i] = px[i * 4] / 255 + (n - 0.5) * 0.55;
    relief[i] = fbm(x / 9 + 50, y / 9, W / 9, 4);
    cloud[i] = Math.max(0, fbm(x / 26 + 100, y / 22, W / 26, 5) - 0.46) * 3.2;
  }
  return { land, cloud, relief };
}

export default function Earth() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const S = 420; cv.width = cv.height = S;
    const { land, cloud, relief } = bakeMaps();
    const img = ctx.createImageData(S, S), d = img.data;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tilt = 0.38, ct = Math.cos(tilt), st = Math.sin(tilt);
    let rot = 3.6, raf, last = 0;
    const frame = (t) => {
      if (t - last > 33 || reduce) {
        last = t; if (!reduce) rot += 0.006;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const nx = (x / S) * 2 - 1, ny = (y / S) * 2 - 1, r2 = nx * nx + ny * ny, o = (y * S + x) * 4;
          if (r2 >= 1) { d[o + 3] = 0; continue; }
          const nz = Math.sqrt(1 - r2);
          // axial tilt, then spin
          const y2 = ny * ct - nz * st, z2 = ny * st + nz * ct;
          const lat = Math.asin(-y2), lon = Math.atan2(nx, z2) + rot;
          const u = (((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1, v = 0.5 - lat / Math.PI;
          const ix = Math.min(W - 1, (u * W) | 0), iy = Math.min(H - 1, Math.max(0, (v * H) | 0)), i = iy * W + ix;
          const al = Math.abs(lat) * 57.3;
          let R, G, B;
          if (land[i] > 0.5) {
            const rl = relief[i];
            if (al > 68) { R = 236; G = 242; B = 248; }
            else if (al > 15 && al < 36 && rl > 0.4) { R = 176 + rl * 50; G = 146 + rl * 36; B = 92; }       // deserts
            else { R = 52 + rl * 70; G = 104 + rl * 58; B = 52 + rl * 20; }                                    // vegetation
            if (rl > 0.64) { R += 30; G += 24; B += 20; }                                                      // highlands
          } else {
            const shore = Math.max(0, 1 - (0.5 - land[i]) * 6);
            R = 10 + shore * 26; G = 46 + shore * 70; B = 112 + shore * 70;
          }
          const c = Math.min(1, cloud[i] + (al > 62 ? 0.15 : 0));
          R += (250 - R) * c * 0.85; G += (252 - G) * c * 0.85; B += (255 - B) * c * 0.85;
          const L = nx * -0.55 + ny * -0.35 + nz * 0.75;
          const sh = Math.max(0.07, Math.min(1.1, 0.12 + L * 1.0));
          const rim = Math.pow(1 - nz, 2.6);
          d[o] = R * sh + rim * 70; d[o + 1] = G * sh + rim * 120; d[o + 2] = B * sh + rim * 255; d[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="earth-canvas" role="img" aria-label="Rotating Earth" />;
}
