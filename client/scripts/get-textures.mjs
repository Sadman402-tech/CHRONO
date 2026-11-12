// Optional: downloads Earth textures into public/textures so the site works offline.  Run: npm run textures
import { mkdirSync, writeFileSync } from "fs";
const base = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/";
mkdirSync("public/textures", { recursive: true });
for (const f of ["earth_atmos_2048.jpg", "earth_specular_2048.jpg", "earth_normal_2048.jpg", "earth_clouds_1024.png"]) {
  const r = await fetch(base + f);
  if (!r.ok) throw new Error(f + " " + r.status);
  writeFileSync("public/textures/" + f, Buffer.from(await r.arrayBuffer()));
  console.log("saved", f);
}
