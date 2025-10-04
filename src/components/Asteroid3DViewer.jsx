// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// Constantes para los cálculos (fuera del componente para evitar re-creación)
const DEFAULT_DENSITY = 2500; // kg/m^3
const J_PER_MT = 4.184e15;    // joules por megatón TNT
const ORBIT_SCALE = 100;      // Ajusta este número para separar más / menos las órbitas

// Helper functions (fuera del componente para evitar re-creación)
const estimateDiameterFromH = (H, albedo = 0.14) => {
  if (typeof H !== 'number' || isNaN(H)) return null;
  return (1329 / Math.sqrt(albedo)) * Math.pow(10, -H / 5);
};

const chooseDiameterKm = (diamMinKm, diamMaxKm, H, albedo = 0.14) => {
  const a = typeof diamMinKm === 'number' && diamMinKm > 0 ? diamMinKm : null;
  const b = typeof diamMaxKm === 'number' && diamMaxKm > 0 ? diamMaxKm : null;
  if (a && b) return Math.sqrt(a * b); // media geométrica
  if (a) return a;
  if (b) return b;
  const dH = estimateDiameterFromH(H, albedo);
  return typeof dH === 'number' && dH > 0 ? dH : 0.05; // fallback pequeño
};

const pickVelocityKmsFromApproaches = (approaches, preferOrbitingBody = 'Earth') => {
  if (!Array.isArray(approaches) || approaches.length === 0) return null;
  const filtered = preferOrbitingBody
    ? approaches.filter(a => a?.orbiting_body === preferOrbitingBody)
    : approaches;
  const candidates = filtered.length ? filtered : approaches;
  const sorted = [...candidates].sort((a, b) => {
    const ka = parseFloat(a?.miss_distance?.kilometers ?? 'Infinity');
    const kb = parseFloat(b?.miss_distance?.kilometers ?? 'Infinity');
    return ka - kb;
  });
  const top = sorted[0];
  const v = parseFloat(top?.relative_velocity?.kilometers_per_second ?? 'NaN');
  return Number.isFinite(v) ? v : null;
};

const computeEnergyMt = ({ diamMinKm, diamMaxKm, H, velocityKms, densityKgM3 = DEFAULT_DENSITY }) => {
  if (!(velocityKms > 0)) return null;
  const diameterKm = chooseDiameterKm(diamMinKm, diamMaxKm, H);
  if (!diameterKm || diameterKm <= 0) return null;
  const radiusM = (diameterKm * 1000) / 2;
  const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
  const massKg = densityKgM3 * volumeM3;
  const velocityMs = velocityKms * 1000;
  const energyJ = 0.5 * massKg * velocityMs * velocityMs;
  const energyMt = energyJ / J_PER_MT;
  return { energyMt, diameterKm, velocityKms };
};

const tierFromEnergyMt = (E) => {
  if (E == null || isNaN(E)) return null;
  if (E >= 100) return 'HIGH';
  if (E >= 1) return 'MEDIUM';
  return 'LOW';
};

const randomColor = () => Math.floor(Math.random() * 0xffffff);

const Asteroid3DViewer = () => {
  const mountRef = useRef(null);

  // Referencias para objetos de Three.js que necesitan persistir
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const earthRef = useRef(null);
  const orbitGroupRef = useRef(null);
  const asteroidMeshesRef = useRef([]); // Array para almacenar los meshes de asteroides actuales
  const animationIdRef = useRef(null);
  const cameraDistanceRef = useRef(100);
  const cameraRotationRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6 });

  // Estados para los datos de asteroides y el filtro
  const [apiAsteroids, setApiAsteroids] = useState([]);
  const [manualAsteroids, setManualAsteroids] = useState([]);
  const [filterTerm, setFilterTerm] = useState('');
  const [viewMode, setViewMode] = useState('api'); // 'api', 'manual', 'all'
  const [hasAddedFirstManualAsteroid, setHasAddedFirstManualAsteroid] = useState(false); // Nuevo estado

  // Estados para los campos del formulario de entrada
  const [newAsteroidName, setNewAsteroidName] = useState('');
  const [newAsteroidA, setNewAsteroidA] = useState('1.5'); // semi_major_axis (AU)
  const [newAsteroidE, setNewAsteroidE] = useState('0.1'); // eccentricity
  const [newAsteroidI, setNewAsteroidI] = useState('10'); // inclination (degrees)
  const [newAsteroidDiamMin, setNewAsteroidDiamMin] = useState('0.1'); // estimated_diameter_min (km)
  const [newAsteroidDiamMax, setNewAsteroidDiamMax] = useState('0.2'); // estimated_diameter_max (km)
  const [newAsteroidH, setNewAsteroidH] = useState('20'); // absolute_magnitude_h
  const [newAsteroidVelocity, setNewAsteroidVelocity] = useState('15'); // velocityKms (km/s)

  // Función para agregar asteroides a la escena (limpia y vuelve a dibujar)
  const updateAsteroidsInScene = useCallback((dataList) => {
    const scene = sceneRef.current;
    const orbitGroup = orbitGroupRef.current;
    const asteroidMeshes = asteroidMeshesRef.current;

    if (!scene || !orbitGroup || !asteroidMeshes) return;

    // Limpiar asteroides y órbitas existentes de la escena
    asteroidMeshes.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    orbitGroup.children.forEach(child => {
      if (child.isLine) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    orbitGroup.clear(); // Limpiar todas las líneas de órbita
    asteroidMeshes.length = 0; // Vaciar el array de meshes

    dataList.forEach((data) => {
      const scaledA = data.a * ORBIT_SCALE;
      const orbitPoints = [];
      const segments = 128;
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const r = (scaledA * (1 - data.e * data.e)) / (1 + data.e * Math.cos(theta));
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        // Ajuste para la inclinación de la órbita en el plano YZ
        const y = z * Math.sin(data.i * Math.PI / 180);
        const zAdjusted = z * Math.cos(data.i * Math.PI / 180);
        orbitPoints.push(new THREE.Vector3(x, y, zAdjusted));
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.4
      });
      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      orbitGroup.add(orbitLine);

      const visualRadius = Math.max(data.size, 0.01) * 5;
      const asteroidGeometry = new THREE.SphereGeometry(visualRadius, 16, 16);
      const asteroidMaterial = new THREE.MeshPhongMaterial({
        color: data.color,
        shininess: 5
      });
      const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
      asteroid.userData = {
        name: data.name,
        type: 'asteroid',
        orbit: data,
        orbitPoints,
        currentIndex: 0,
        energyMt: data.energyMt ?? null,
        severity: data.severity ?? null,
        velocityKms: data.velocityKms ?? null,
        diameterKm: data.diameterKm ?? null
      };

      if (data.energyMt != null) {
        console.log(
          `[SEVERITY] ${data.name} | E≈${data.energyMt.toFixed(2)} Mt | v≈${(data.velocityKms ?? 0).toFixed(2)} km/s | D≈${(data.diameterKm ?? 0).toFixed(3)} km | ${data.severity}`
        );
      } else {
        console.log(`[ASTEROID] ${data.name} | No hay datos de energía para calcular severidad.`);
      }

      asteroid.position.copy(orbitPoints[0]);
      scene.add(asteroid);
      asteroidMeshes.push(asteroid);
    });
  }, []);


  // --- useEffect para inicialización de Three.js y carga de API (se ejecuta una vez) ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Escena, cámara y renderizador
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.z = cameraDistanceRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Luz direccional y ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Earth con textura realista
    const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    let earthMaterial;
    textureLoader.load(
      '/earthmap.jpg',
      (texture) => {
        earthMaterial = new THREE.MeshPhongMaterial({
          map: texture,
          shininess: 25,
          specular: 0x333333
        });
        earthRef.current = new THREE.Mesh(earthGeometry, earthMaterial);
        earthRef.current.castShadow = true;
        earthRef.current.receiveShadow = true;
        earthRef.current.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        scene.add(earthRef.current);
      },
      undefined,
      (err) => {
        earthMaterial = new THREE.MeshPhongMaterial({
          color: 0x2233ff,
          shininess: 25,
          specular: 0x333333
        });
        earthRef.current = new THREE.Mesh(earthGeometry, earthMaterial);
        earthRef.current.castShadow = true;
        earthRef.current.receiveShadow = true;
        earthRef.current.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        scene.add(earthRef.current);
        console.error('No se pudo cargar la textura de la Tierra:', err);
      }
    );

    // Atmosfera de la Tierra
    const atmosphereGeometry = new THREE.SphereGeometry(6.8, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Grupo para órbitas
    const orbitGroup = new THREE.Group();
    orbitGroupRef.current = orbitGroup;
    scene.add(orbitGroup);

    // Estrellas
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.0,
      transparent: true,
      opacity: 0.8
    });
    const starsVertices = [];
    for (let i = 0; i < 3000; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const y = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;
      starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Fetch de la API NASA NEO
    const controller = new AbortController();
    const API_KEY = import.meta.env.VITE_NASA_API_KEY || '2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK';
    const FEED_URL = `https://api.nasa.gov/neo/rest/v1/feed?start_date=2015-09-07&end_date=2015-09-08&api_key=${API_KEY}`;

    const fetchAsteroids = async () => {
      try {
        const res = await fetch(FEED_URL, { signal: controller.signal });
        if (!res.ok) throw new Error('Error al obtener feed NEO');
        const feed = await res.json();
        const byDate = feed.near_earth_objects || {};
        const neoList = [];
        Object.values(byDate).forEach((arr) => {
          if (Array.isArray(arr)) neoList.push(...arr);
        });
        const links = Array.from(new Set(neoList.map(n => n.links && n.links.self).filter(Boolean)));

        const detailed = [];
        for (const url of links) {
          if (controller.signal.aborted) return;
          try {
            const r = await fetch(url, { signal: controller.signal });
            if (!r.ok) continue;
            const neo = await r.json();
            const orbital = neo.orbital_data || {};

            const diamMinKm = neo?.estimated_diameter?.kilometers?.estimated_diameter_min;
            const diamMaxKm = neo?.estimated_diameter?.kilometers?.estimated_diameter_max;
            const H = neo?.absolute_magnitude_h;
            const vKms = pickVelocityKmsFromApproaches(neo?.close_approach_data || [], 'Earth');

            let energyMt = null;
            let severity = null;
            let diameterKmUsed = null;

            if (vKms && vKms > 0) {
              const eCalc = computeEnergyMt({ diamMinKm, diamMaxKm, H, velocityKms: vKms });
              if (eCalc) {
                energyMt = eCalc.energyMt;
                severity = tierFromEnergyMt(energyMt);
                diameterKmUsed = eCalc.diameterKm;
              }
            } else {
              diameterKmUsed = chooseDiameterKm(diamMinKm, diamMaxKm, H);
            }

            const sizeKmForViz = typeof diameterKmUsed === 'number' ? diameterKmUsed : (typeof diamMinKm === 'number' ? diamMinKm : 0.05);

            const parsed = {
              name: neo.name || neo.designation || 'NEO',
              a: parseFloat(orbital.semi_major_axis) || 1,
              e: parseFloat(orbital.eccentricity) || 0,
              i: parseFloat(orbital.inclination) || 0,
              size: sizeKmForViz,
              color: randomColor(),
              energyMt,
              severity,
              velocityKms: vKms ?? null,
              diameterKm: diameterKmUsed ?? null
            };
            detailed.push(parsed);
          } catch (err) {
            // console.error('Error NEO individual', err);
          }
        }
        if (detailed.length) {
          setApiAsteroids(detailed); // Actualizar el estado con los asteroides de la API
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Fallo obteniendo asteroides NASA:', e);
        }
      }
    };

    fetchAsteroids();

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      cameraRotationRef.current.theta -= deltaX * 0.005;
      cameraRotationRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraRotationRef.current.phi + deltaY * 0.005));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraDistanceRef.current += e.deltaY * 0.1;
      cameraDistanceRef.current = Math.max(20, Math.min(500, cameraDistanceRef.current));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animación
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      if (earthRef.current) {
        earthRef.current.rotation.y += 0.003;
      }

      asteroidMeshesRef.current.forEach(asteroid => {
        const points = asteroid.userData.orbitPoints;
        if (points) {
          asteroid.userData.currentIndex = (asteroid.userData.currentIndex + 0.2) % points.length;
          const pos = points[Math.floor(asteroid.userData.currentIndex)];
          asteroid.position.copy(pos);
          asteroid.rotation.x += 0.01;
          asteroid.rotation.y += 0.02;
        }
      });

      cameraRef.current.position.x = cameraDistanceRef.current * Math.sin(cameraRotationRef.current.phi) * Math.sin(cameraRotationRef.current.theta);
      cameraRef.current.position.y = cameraDistanceRef.current * Math.cos(cameraRotationRef.current.phi);
      cameraRef.current.position.z = cameraDistanceRef.current * Math.sin(cameraRotationRef.current.phi) * Math.cos(cameraRotationRef.current.theta);
      cameraRef.current.lookAt(0, 0, 0);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Limpieza al desmontar el componente
    return () => {
      controller.abort();
      cancelAnimationFrame(animationIdRef.current);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (mount.contains(rendererRef.current.domElement)) {
          mount.removeChild(rendererRef.current.domElement);
        }
      }
      // Limpiar geometrías y materiales de la escena (opcional, para una limpieza más profunda)
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
    };
  }, []); // Se ejecuta solo una vez al montar

  // --- useEffect para actualizar la visualización de asteroides (se ejecuta al cambiar datos/filtro/viewMode) ---
  useEffect(() => {
    let asteroidsToDisplay = [];

    if (viewMode === 'api') {
      asteroidsToDisplay = apiAsteroids;
    } else if (viewMode === 'manual') {
      asteroidsToDisplay = manualAsteroids;
    } else if (viewMode === 'all') {
      asteroidsToDisplay = [...apiAsteroids, ...manualAsteroids];
    }

    // Aplicar filtro al conjunto de asteroides seleccionado
    const filteredAsteroids = asteroidsToDisplay.filter(asteroid =>
      asteroid.name.toLowerCase().includes(filterTerm.toLowerCase())
    );

    updateAsteroidsInScene(filteredAsteroids);

  }, [apiAsteroids, manualAsteroids, filterTerm, viewMode, updateAsteroidsInScene]); // Dependencias: re-ejecutar cuando cambien los asteroides, el filtro o el modo de vista

  // --- HANDLER PARA AGREGAR ASTEROIDE MANUALMENTE ---
  const handleAddAsteroid = useCallback(() => {
    const vKms = parseFloat(newAsteroidVelocity);
    const diamMinKm = parseFloat(newAsteroidDiamMin);
    const diamMaxKm = parseFloat(newAsteroidDiamMax);
    const H = parseFloat(newAsteroidH);

    let energyMt = null;
    let severity = null;
    let diameterKmUsed = null;

    if (vKms && vKms > 0) {
      const eCalc = computeEnergyMt({ diamMinKm, diamMaxKm, H, velocityKms: vKms });
      if (eCalc) {
        energyMt = eCalc.energyMt;
        severity = tierFromEnergyMt(energyMt);
        diameterKmUsed = eCalc.diameterKm;
      }
    } else {
      diameterKmUsed = chooseDiameterKm(diamMinKm, diamMaxKm, H);
    }

    const newAsteroid = {
      name: newAsteroidName || `Manual-${Date.now().toString().slice(-4)}`,
      a: parseFloat(newAsteroidA) || 1,
      e: parseFloat(newAsteroidE) || 0,
      i: parseFloat(newAsteroidI) || 0,
      size: diameterKmUsed || 0.05,
      color: randomColor(),
      energyMt,
      severity,
      velocityKms: vKms,
      diameterKm: diameterKmUsed,
    };

    setManualAsteroids((prevAsteroids) => [...prevAsteroids, newAsteroid]);

    // Si es el primer asteroide manual añadido, cambiamos el modo de vista
    if (!hasAddedFirstManualAsteroid) {
      setViewMode('manual');
      setHasAddedFirstManualAsteroid(true);
    }

    // Limpiar formulario después de agregar
    setNewAsteroidName('');
    setNewAsteroidA('1.5');
    setNewAsteroidE('0.1');
    setNewAsteroidI('10');
    setNewAsteroidDiamMin('0.1');
    setNewAsteroidDiamMax('0.2');
    setNewAsteroidH('20');
    setNewAsteroidVelocity('15');
  }, [newAsteroidName, newAsteroidA, newAsteroidE, newAsteroidI, newAsteroidDiamMin, newAsteroidDiamMax, newAsteroidH, newAsteroidVelocity, hasAddedFirstManualAsteroid]);


  return (
    <div
      ref={mountRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}
    >
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        fontFamily: 'monospace',
        zIndex: 10,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
      }}>
        <h3>Añadir Asteroide Manualmente</h3>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Nombre:</label>
          <input type="text" value={newAsteroidName} onChange={(e) => setNewAsteroidName(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Semieje Mayor (AU):</label>
          <input type="number" step="0.1" value={newAsteroidA} onChange={(e) => setNewAsteroidA(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Excentricidad:</label>
          <input type="number" step="0.01" value={newAsteroidE} onChange={(e) => setNewAsteroidE(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Inclinación (deg):</label>
          <input type="number" step="1" value={newAsteroidI} onChange={(e) => setNewAsteroidI(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Diámetro Mín (km):</label>
          <input type="number" step="0.01" value={newAsteroidDiamMin} onChange={(e) => setNewAsteroidDiamMin(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Diámetro Máx (km):</label>
          <input type="number" step="0.01" value={newAsteroidDiamMax} onChange={(e) => setNewAsteroidDiamMax(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Magnitud Absoluta (H):</label>
          <input type="number" step="0.1" value={newAsteroidH} onChange={(e) => setNewAsteroidH(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '3px' }}>Velocidad (km/s):</label>
          <input type="number" step="0.1" value={newAsteroidVelocity} onChange={(e) => setNewAsteroidVelocity(e.target.value)} style={{ width: 'calc(100% - 10px)', padding: '5px', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }} />
        </div>
        <button onClick={handleAddAsteroid} style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '10px 15px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          width: '100%'
        }}>Añadir Asteroide</button>

        <h3 style={{ marginTop: '25px', borderTop: '1px solid #555', paddingTop: '15px' }}>Opciones de Visualización</h3>
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => setViewMode('api')}
            style={{
              backgroundColor: viewMode === 'api' ? '#007bff' : '#555',
              color: 'white',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
          >
            Ver Asteroides API
          </button>
          <button
            onClick={() => setViewMode('manual')}
            style={{
              backgroundColor: viewMode === 'manual' ? '#007bff' : '#555',
              color: 'white',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
          >
            Ver Asteroides Manuales
          </button>
          <button
            onClick={() => setViewMode('all')}
            style={{
              backgroundColor: viewMode === 'all' ? '#007bff' : '#555',
              color: 'white',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Ver Todos
          </button>
        </div>


        <h3 style={{ marginTop: '25px', borderTop: '1px solid #555', paddingTop: '15px' }}>Filtrar Asteroides</h3>
        <input
          type="text"
          placeholder="Filtrar por nombre..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          style={{ width: 'calc(100% - 10px)', padding: '8px', boxSizing: 'border-box', border: '1px solid #555', borderRadius: '3px', background: '#333', color: 'white' }}
        />
        <p style={{ marginTop: '15px', fontSize: '0.9em' }}>Total de asteroides (API + Manuales): {apiAsteroids.length + manualAsteroids.length}</p>
        <p style={{ fontSize: '0.9em' }}>Asteroides filtrados en escena: {
          (() => {
            let asteroidsCount = [];
            if (viewMode === 'api') {
              asteroidsCount = apiAsteroids;
            } else if (viewMode === 'manual') {
              asteroidsCount = manualAsteroids;
            } else if (viewMode === 'all') {
              asteroidsCount = [...apiAsteroids, ...manualAsteroids];
            }
            return asteroidsCount.filter(a => a.name.toLowerCase().includes(filterTerm.toLowerCase())).length;
          })()
        }</p>
      </div>
    </div>
  );
};

export default Asteroid3DViewer;