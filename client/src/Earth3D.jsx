import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Earth from "./Earth.jsx"; // procedural fallback if textures can't load

// Tries your local copy first, then a CDN mirror of the three.js example textures.
const BASES = ["/textures/", "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/"];
const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");
function loadTex(file, srgb = true) {
  return new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= BASES.length) return reject(new Error("texture failed: " + file));
      loader.load(BASES[i++] + file, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, next);
    };
    next();
  });
}

export default function Earth3D() {
  const box = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 3.5;
    const size = () => { const w = el.clientWidth || 600; renderer.setSize(w, w, false); renderer.domElement.style.cssText = "width:100%;height:100%;display:block"; };
    size(); addEventListener("resize", size);

    const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(-3, 1, 2.5);
    scene.add(sun, new THREE.AmbientLight(0x6f86c8, 0.35));
    const tilt = new THREE.Group(); tilt.rotation.z = THREE.MathUtils.degToRad(23.4); scene.add(tilt);

    // atmosphere glow (fresnel)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 64), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: "varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec3 n;void main(){float i=pow(0.62-dot(n,vec3(0,0,1.)),3.);gl_FragColor=vec4(.35,.55,1.,1.)*i*1.6;}",
    }));
    scene.add(atmo);

    let earth, clouds, raf, dead = false;
    Promise.all([loadTex("earth_atmos_2048.jpg"), loadTex("earth_specular_2048.jpg", false), loadTex("earth_normal_2048.jpg", false), loadTex("earth_clouds_1024.png")])
      .then(([map, specularMap, normalMap, cloudMap]) => {
        if (dead) return;
        earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.MeshPhongMaterial({ map, specularMap, normalMap, normalScale: new THREE.Vector2(0.8, 0.8), specular: new THREE.Color(0x4a5a7a), shininess: 18 }));
        clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 96), new THREE.MeshPhongMaterial({ map: cloudMap, transparent: true, opacity: 0.85, depthWrite: false }));
        earth.rotation.y = 2.2; // start facing Africa/Europe
        tilt.add(earth, clouds);
        const tick = () => {
          if (!reduce) { earth.rotation.y += 0.0016; clouds.rotation.y += 0.002; }
          renderer.render(scene, camera);
          if (!reduce) raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => !dead && setFailed(true));

    return () => { dead = true; cancelAnimationFrame(raf); removeEventListener("resize", size); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);
  if (failed) return <Earth />;
  return <div ref={box} className="earth3d" role="img" aria-label="Rotating Earth" />;
}
