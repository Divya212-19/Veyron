import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

/**
 * three-globe computes: widthSegments = round(360 / globeCurvatureResolution)
 * heightSegments = widthSegments / 2
 * So 360/128 => 128 × 64 — smooth sphere (faceting was from e.g. 72 → only 5 segments!).
 */
const GLOBE_CURVATURE_RESOLUTION = 360 / 128;

const TEX_EARTH_COLOR =
  'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg';
const TEX_EARTH_TOPOLOGY =
  'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-topology.png';
const TEX_EARTH_NIGHT =
  'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-night.jpg';

const SPHERE_WIDTH_SEGMENTS = 128;
const SPHERE_HEIGHT_SEGMENTS = 128;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rgbaAtAlpha(rgba, alpha) {
  const m = rgba.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return rgba;
  const [, r, g, b] = m;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

/** Offline fallback equirectangular-style canvas (no network). */
function makeFallbackEarthTextureDataUrl() {
  const canvas = document.createElement('canvas');
  const w = 2048;
  const h = 1024;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#020810');
  grd.addColorStop(0.5, '#031018');
  grd.addColorStop(1, '#020814');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  function proj(lat, lng) {
    return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h];
  }

  function poly(pts, fill, stroke) {
    ctx.beginPath();
    pts.forEach(([lat, lng], i) => {
      const [x, y] = proj(lat, lng);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const land = 'rgba(28, 72, 52, 0.95)';
  const coast = 'rgba(0, 190, 210, 0.35)';

  poly(
    [
      [72, -168],
      [68, -140],
      [62, -100],
      [52, -82],
      [48, -66],
      [35, -75],
      [18, -82],
      [10, -97],
      [22, -118],
      [45, -130],
      [65, -168],
      [72, -168],
    ],
    land,
    coast
  );
  poly(
    [
      [12, -82],
      [5, -35],
      [-55, -35],
      [-55, -75],
      [12, -82],
    ],
    land,
    coast
  );
  poly(
    [
      [38, -18],
      [38, 52],
      [-35, 52],
      [-35, -18],
    ],
    land,
    coast
  );
  poly(
    [
      [75, -25],
      [75, 40],
      [35, 40],
      [35, 36],
      [-10, 36],
      [-10, 72],
      [-25, 72],
      [-25, 55],
      [35, 55],
      [35, 15],
      [60, 12],
      [75, 25],
    ],
    land,
    coast
  );
  poly(
    [
      [12, 60],
      [12, 150],
      [55, 150],
      [75, 130],
      [55, 48],
      [40, 48],
      [30, 35],
      [25, 65],
      [12, 60],
    ],
    land,
    coast
  );
  poly(
    [
      [-10, 110],
      [-10, 155],
      [-45, 155],
      [-45, 110],
    ],
    land,
    coast
  );

  ctx.fillStyle = 'rgba(0, 220, 255, 0.04)';
  const rand = mulberry32(4242);
  for (let i = 0; i < 1200; i += 1) {
    const lat = -55 + rand() * 125;
    const lng = -180 + rand() * 360;
    const [x, y] = proj(lat, lng);
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  return canvas.toDataURL('image/png');
}

const ARC_POOL = [
  {
    name: 'India → USA',
    startLat: 20.5937,
    startLng: 78.9629,
    endLat: 37.0902,
    endLng: -95.7129,
    color: ['rgba(0, 224, 255, 0.92)', 'rgba(0, 224, 255, 0.06)'],
    dashPhase: 0,
  },
  {
    name: 'China → Germany',
    startLat: 35.8617,
    startLng: 104.1954,
    endLat: 50.1109,
    endLng: 8.6821,
    color: ['rgba(0, 210, 255, 0.88)', 'rgba(0, 210, 255, 0.06)'],
    dashPhase: 0.12,
  },
  {
    name: 'Russia → Japan',
    startLat: 55.7558,
    startLng: 37.6173,
    endLat: 35.6762,
    endLng: 139.6503,
    color: ['rgba(255, 160, 60, 0.9)', 'rgba(255, 140, 0, 0.06)'],
    dashPhase: 0.24,
  },
  {
    name: 'UAE → India',
    startLat: 25.2048,
    startLng: 55.2708,
    endLat: 28.6139,
    endLng: 77.209,
    color: ['rgba(255, 70, 70, 0.9)', 'rgba(255, 60, 60, 0.06)'],
    dashPhase: 0.36,
  },
  {
    name: 'UK → India',
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: 19.076,
    endLng: 72.8777,
    color: ['rgba(0, 230, 255, 0.82)', 'rgba(0, 224, 255, 0.06)'],
    dashPhase: 0.48,
  },
  {
    name: 'Brazil → USA',
    startLat: -23.5505,
    startLng: -46.6333,
    endLat: 40.7128,
    endLng: -74.006,
    color: ['rgba(0, 200, 255, 0.78)', 'rgba(0, 200, 255, 0.06)'],
    dashPhase: 0.6,
  },
  {
    name: 'Australia → Singapore',
    startLat: -33.8688,
    startLng: 151.2093,
    endLat: 1.3521,
    endLng: 103.8198,
    color: ['rgba(0, 215, 255, 0.85)', 'rgba(0, 200, 255, 0.06)'],
    dashPhase: 0.18,
  },
  {
    name: 'South Korea → Canada',
    startLat: 37.5665,
    startLng: 126.978,
    endLat: 45.4215,
    endLng: -75.6972,
    color: ['rgba(255, 130, 70, 0.82)', 'rgba(255, 120, 40, 0.06)'],
    dashPhase: 0.54,
  },
];

function findGlobeSurfaceMesh(scene) {
  let found = null;
  scene.traverse((obj) => {
    if (found || !obj.isMesh || !obj.material) return;
    if (obj.__globeObjType === 'atmosphere') return;
    if (obj.parent?.__globeObjType !== 'globe') return;
    if (obj.geometry?.type !== 'SphereGeometry') return;
    found = obj;
  });
  return found;
}

function ensureSphereGeometry(mesh, radius) {
  const g = mesh.geometry;
  const ok =
    g?.type === 'SphereGeometry' &&
    g.parameters?.widthSegments === SPHERE_WIDTH_SEGMENTS &&
    g.parameters?.heightSegments === SPHERE_HEIGHT_SEGMENTS &&
    Math.abs((g.parameters?.radius ?? 0) - radius) < 1e-6;
  if (ok) return;
  if (g) g.dispose();
  mesh.geometry = new THREE.SphereGeometry(radius, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS);
}

function configureGlobeEarthMaterial(mesh, nightTex) {
  const m = mesh.material;
  if (!m || !m.map) return;

  m.color = new THREE.Color(0xffffff);
  m.emissive = new THREE.Color(0x223344);
  m.emissiveIntensity = nightTex ? 0.32 : 0.06;
  if (nightTex) {
    if (m.emissiveMap && m.emissiveMap !== nightTex) m.emissiveMap.dispose();
    m.emissiveMap = nightTex;
    m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  } else if (m.emissiveMap) {
    m.emissiveMap = null;
  }
  m.shininess = 18;
  m.specular = new THREE.Color(0x555555);
  m.bumpScale = 0.05;
  m.opacity = 1;
  m.transparent = false;
  m.depthWrite = true;
  m.side = THREE.FrontSide;
  if (m.map) {
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.map.anisotropy = Math.min(16, m.map.anisotropy || 8);
  }
  if (m.bumpMap) {
    m.bumpMap.colorSpace = THREE.NoColorSpace;
  }
  m.needsUpdate = true;
}

function styleGraticules(scene) {
  scene.traverse((obj) => {
    if (obj.type !== 'LineSegments' || !obj.material) return;
    const mat = obj.material;
    if (typeof mat.opacity === 'number' && Math.abs(mat.opacity - 0.1) < 0.001) {
      mat.color.setHex(0x66ddff);
      mat.opacity = 0.16;
      mat.transparent = true;
    }
  });
}

export default function CyberGlobe() {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const controlsReadyRef = useRef(false);
  const nightTexRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [globeImageUrl, setGlobeImageUrl] = useState(() => makeFallbackEarthTextureDataUrl());
  const [activeArcKeys, setActiveArcKeys] = useState(() => [0, 1, 2, 3, 4]);

  const activeArcs = useMemo(
    () => activeArcKeys.map((k) => ARC_POOL[k]).filter(Boolean),
    [activeArcKeys]
  );

  useEffect(() => {
    let cancelled = false;
    loadTexture(TEX_EARTH_COLOR)
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          const w = 2048;
          const h = 1024;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            tex.dispose();
            return;
          }
          const bmp = tex.image;
          ctx.drawImage(bmp, 0, 0, w, h);
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = 'rgba(4, 36, 52, 0.14)';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
          ctx.save();
          ctx.globalCompositeOperation = 'overlay';
          ctx.fillStyle = 'rgba(0, 140, 210, 0.06)';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
          tex.dispose();
          setGlobeImageUrl(canvas.toDataURL('image/jpeg', 0.94));
        } catch {
          setGlobeImageUrl(TEX_EARTH_COLOR);
        }
      })
      .catch(() => {
        if (!cancelled) setGlobeImageUrl(makeFallbackEarthTextureDataUrl());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const rotate = () => {
      setActiveArcKeys((prev) => {
        const rand = mulberry32(Date.now() % 100000 + prev.reduce((a, b) => a + b, 0));
        const count = 5 + Math.floor(rand() * 4);
        const next = new Set();
        let guard = 0;
        while (next.size < count && guard < 80) {
          guard += 1;
          next.add(Math.floor(rand() * ARC_POOL.length));
        }
        return [...next];
      });
    };
    const id = window.setInterval(rotate, 10000);
    return () => window.clearInterval(id);
  }, []);

  const syncEarthMesh = useCallback((globe) => {
    if (!globe?.scene || !globe.getGlobeRadius) return;
    const scene = globe.scene();
    const r = globe.getGlobeRadius();
    const mesh = findGlobeSurfaceMesh(scene);
    if (!mesh) return;
    ensureSphereGeometry(mesh, r);
    configureGlobeEarthMaterial(mesh, nightTexRef.current);
    styleGraticules(scene);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTexture(TEX_EARTH_NIGHT)
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        nightTexRef.current = tex;
        const globe = globeRef.current;
        const mesh = globe?.scene ? findGlobeSurfaceMesh(globe.scene()) : null;
        if (mesh) configureGlobeEarthMaterial(mesh, tex);
        else if (globe) syncEarthMesh(globe);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      const t = nightTexRef.current;
      nightTexRef.current = null;
      t?.dispose();
    };
  }, [syncEarthMesh]);

  const applyGlobeVisualConfig = useCallback(
    (globe) => {
      if (!globe?.renderer || !globe?.scene) return;

      const renderer = globe.renderer();
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = globe.scene();
      scene.fog = null;

      const ambient = new THREE.AmbientLight(0xffffff, 0.38);
      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(6, 4, 10);
      const fill = new THREE.DirectionalLight(0xb8dcff, 0.45);
      fill.position.set(-8, -2, -6);
      const rim = new THREE.DirectionalLight(0xaaccff, 0.28);
      rim.position.set(-4, 8, -10);
      globe.lights([ambient, key, fill, rim]);

      if (!controlsReadyRef.current && globe.controls) {
        const controls = globe.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.26;
        controls.enableDamping = true;
        controls.dampingFactor = 0.082;
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.rotateSpeed = 0.32;
        controls.minPolarAngle = Math.PI * 0.22;
        controls.maxPolarAngle = Math.PI * 0.78;
        controlsReadyRef.current = true;
      }

      globe.pointOfView({ lat: 14, lng: -18, altitude: 1.56 }, 900);

      syncEarthMesh(globe);
    },
    [syncEarthMesh]
  );

  useEffect(() => () => {
    controlsReadyRef.current = false;
  }, []);

  useEffect(() => {
    const timers = [40, 200, 600, 1400].map((ms) =>
      window.setTimeout(() => {
        const globe = globeRef.current;
        if (globe) syncEarthMesh(globe);
      }, ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [globeImageUrl, syncEarthMesh]);

  const bgParticles = useMemo(() => {
    const rand = mulberry32(9001);
    return Array.from({ length: 72 }, () => ({
      kind: 'bg',
      lat: -75 + rand() * 150,
      lng: -180 + rand() * 360,
      altitude: 0.14 + rand() * 0.22,
      size: 0.035 + rand() * 0.035,
      color: 'rgba(120, 220, 255, 0.18)',
    }));
  }, []);

  const points = useMemo(() => {
    const rand = mulberry32(1337);
    const regions = [
      { lat0: 15, lat1: 60, lng0: -130, lng1: -60, n: 380 },
      { lat0: -55, lat1: 15, lng0: -80, lng1: -35, n: 260 },
      { lat0: 35, lat1: 70, lng0: -10, lng1: 40, n: 300 },
      { lat0: -35, lat1: 35, lng0: -20, lng1: 50, n: 320 },
      { lat0: 5, lat1: 60, lng0: 60, lng1: 150, n: 560 },
      { lat0: -45, lat1: -10, lng0: 110, lng1: 155, n: 200 },
    ];

    const landDots = [];
    for (const r of regions) {
      for (let i = 0; i < r.n; i += 1) {
        const lat = r.lat0 + (r.lat1 - r.lat0) * rand();
        const lng = r.lng0 + (r.lng1 - r.lng0) * rand();
        const p = 0.5 + 0.5 * Math.sin(lat * 0.22 + lng * 0.16);
        if (rand() > p) continue;
        const hot = rand() > 0.9;
        landDots.push({
          kind: 'land',
          lat,
          lng,
          altitude: 0.006 + rand() * 0.012,
          size: hot ? 0.16 : 0.105,
          color: hot ? 'rgba(255, 150, 70, 0.42)' : 'rgba(0, 235, 255, 0.38)',
        });
      }
    }

    const endpoints = activeArcs.flatMap((a) => [
      {
        kind: 'endpoint',
        lat: a.startLat,
        lng: a.startLng,
        color: a.color[0],
        size: 0.42,
        altitude: 0.024,
      },
      {
        kind: 'endpoint',
        lat: a.endLat,
        lng: a.endLng,
        color: a.color[0],
        size: 0.36,
        altitude: 0.022,
      },
    ]);

    return [...bgParticles, ...landDots, ...endpoints];
  }, [activeArcs, bgParticles]);

  const rings = useMemo(
    () =>
      activeArcs.map((a) => ({
        lat: a.startLat,
        lng: a.startLng,
        maxR: 1.22,
        propagationSpeed: 1.02,
        repeatPeriod: 3200,
        color: rgbaAtAlpha(a.color[0], 0.28),
      })),
    [activeArcs]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const el = containerRef.current;
      setSize({
        width: Math.max(0, el.clientWidth || 0),
        height: Math.max(0, el.clientHeight || 0),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleGlobeReady = useCallback(() => {
    const run = () => {
      const globe = globeRef.current;
      if (!globe?.controls) {
        requestAnimationFrame(run);
        return;
      }
      applyGlobeVisualConfig(globe);
    };
    queueMicrotask(run);
  }, [applyGlobeVisualConfig]);

  const globeYOffset = size.height > 0 ? Math.round(size.height * 0.022) : 0;

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full">
      {size.width > 0 && size.height > 0 ? (
        <Globe
          ref={globeRef}
          animateIn={false}
          waitForGlobeReady
          width={size.width}
          height={size.height}
          globeOffset={[0, globeYOffset]}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={globeImageUrl}
          bumpImageUrl={TEX_EARTH_TOPOLOGY}
          showGraticules
          globeCurvatureResolution={GLOBE_CURVATURE_RESOLUTION}
          showAtmosphere
          atmosphereColor="rgba(90, 225, 255, 0.52)"
          atmosphereAltitude={0.21}
          onGlobeReady={handleGlobeReady}
          arcsData={activeArcs}
          arcColor={(d) => d.color}
          arcStartAltitude={() => 0.004}
          arcEndAltitude={() => 0.004}
          arcAltitude={() => null}
          arcAltitudeAutoScale={0.38}
          arcStroke={0.4}
          arcCurveResolution={128}
          arcCircularResolution={8}
          arcDashLength={0.36}
          arcDashGap={2.0}
          arcDashInitialGap={(d) => d.dashPhase ?? 0}
          arcDashAnimateTime={4400}
          pointsData={points}
          pointLat={(d) => d.lat}
          pointLng={(d) => d.lng}
          pointColor={(d) => d.color}
          pointAltitude={(d) => d.altitude ?? 0.02}
          pointRadius={(d) => d.size}
          pointsMerge
          ringsData={rings}
          ringLat={(d) => d.lat}
          ringLng={(d) => d.lng}
          ringColor={(d) => d.color}
          ringMaxRadius={(d) => d.maxR}
          ringPropagationSpeed={(d) => d.propagationSpeed}
          ringRepeatPeriod={(d) => d.repeatPeriod}
        />
      ) : null}
    </div>
  );
}
