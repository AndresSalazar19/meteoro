// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// Constantes y funciones helper (fuera del componente para evitar re-creación)
const DEFAULT_DENSITY = 2500; // kg/m^3
const J_PER_MT = 4.184e15;    // joules por megatón TNT
const ORBIT_SCALE = 100;      // Ajusta este número para separar más / menos las órbitas

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


// --- Componente principal ---
const Asteroid3DViewer = () => {
  const mountRef = useRef(null);

  // Referencias para objetos de Three.js que necesitan persistir
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const earthRef = useRef(null);
  const orbitGroupRef = useRef(null);
  const asteroidMeshesRef = useRef([]);
  const animationIdRef = useRef(null);
  const cameraDistanceRef = useRef(100);
  const cameraRotationRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6 });

  // Estados para la lógica de la aplicación
  const [apiAsteroids, setApiAsteroids] = useState([]);
  const [manualAsteroids, setManualAsteroids] = useState([]);
  const [filterTerm, setFilterTerm] = useState('');
  const [viewMode, setViewMode] = useState('api'); // 'api', 'manual', 'all'
  const [viewState, setViewState] = useState('inputForm'); // 'inputForm' o 'simulation'
  const [lastSimulatedAsteroid, setLastSimulatedAsteroid] = useState(null);

  // Estados para los campos del formulario de entrada
  const [newAsteroidName, setNewAsteroidName] = useState('');
  const [newAsteroidA, setNewAsteroidA] = useState('1.5');
  const [newAsteroidE, setNewAsteroidE] = useState('0.1');
  const [newAsteroidI, setNewAsteroidI] = useState('10');
  const [newAsteroidDiamMin, setNewAsteroidDiamMin] = useState('0.1');
  const [newAsteroidDiamMax, setNewAsteroidDiamMax] = useState('0.2');
  const [newAsteroidH, setNewAsteroidH] = useState('20');
  const [newAsteroidVelocity, setNewAsteroidVelocity] = useState('15');


  // Función para agregar/actualizar asteroides en la escena Three.js
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
    orbitGroup.clear();
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

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Tierra con textura
    const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/earthmap.jpg',
      (texture) => {
        const earthMaterial = new THREE.MeshPhongMaterial({
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
        const earthMaterial = new THREE.MeshPhongMaterial({
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

    // Atmósfera de la Tierra
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
            // Ignora errores individuales
          }
        }
        if (detailed.length) {
          setApiAsteroids(detailed);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Fallo obteniendo asteroides NASA:', e);
        }
      }
    };

    fetchAsteroids();

    // Controles de ratón
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
    let currentAsteroidSet = [];

    // Prioriza el asteroide simulado si estamos en la vista de simulación
    if (viewState === 'simulation' && lastSimulatedAsteroid) {
        // En modo simulación, el asteroide simulado es el foco principal.
        // Si el viewMode es 'manual' (el comportamiento por defecto al simular),
        // o si el filtro coincide con su nombre, se asegura de que sea el único en 'currentAsteroidSet'.
        // Esto permite al usuario cambiar el viewMode *mientras ve la simulación*
        // para, por ejemplo, ver todos los asteroides de la API.
        if (viewMode === 'manual' || filterTerm.toLowerCase() === lastSimulatedAsteroid.name.toLowerCase()) {
            currentAsteroidSet = [lastSimulatedAsteroid];
        } else {
            // Si el viewMode ha cambiado a 'api' o 'all', usa esos sets
            if (viewMode === 'api') {
                currentAsteroidSet = apiAsteroids;
            } else if (viewMode === 'all') {
                currentAsteroidSet = [...apiAsteroids, ...manualAsteroids];
            }
            // Si viewMode es 'manual' pero el filtro no coincide con el simulado, currentAsteroidSet estará vacío, lo cual es correcto.
        }
    } else {
        // Si no estamos en la vista de simulación, o si no hay un asteroide simulado,
        // nos basamos completamente en el viewMode seleccionado.
        if (viewMode === 'api') {
            currentAsteroidSet = apiAsteroids;
        } else if (viewMode === 'manual') {
            currentAsteroidSet = manualAsteroids;
        } else if (viewMode === 'all') {
            currentAsteroidSet = [...apiAsteroids, ...manualAsteroids];
        }
    }

    // Aplicar filtro al conjunto de asteroides seleccionado
    asteroidsToDisplay = currentAsteroidSet.filter(asteroid =>
      asteroid.name.toLowerCase().includes(filterTerm.toLowerCase())
    );

    updateAsteroidsInScene(asteroidsToDisplay);

  }, [apiAsteroids, manualAsteroids, filterTerm, viewMode, viewState, lastSimulatedAsteroid, updateAsteroidsInScene]);

  // --- HANDLER PARA EL BOTÓN "SIMULAR" ---
  const handleSimulate = useCallback(() => {
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
    setLastSimulatedAsteroid(newAsteroid); // Guardar el asteroide para la vista de simulación
    setFilterTerm(newAsteroid.name);       // Filtrar por el nombre del nuevo asteroide
    setViewMode('manual');                 // Asegurar que el modo manual esté activo
    setViewState('simulation');            // Cambiar a la vista de simulación

    // Limpiar formulario después de agregar
    setNewAsteroidName('');
    setNewAsteroidA('1.5');
    setNewAsteroidE('0.1');
    setNewAsteroidI('10');
    setNewAsteroidDiamMin('0.1');
    setNewAsteroidDiamMax('0.2');
    setNewAsteroidH('20');
    setNewAsteroidVelocity('15');
  }, [newAsteroidName, newAsteroidA, newAsteroidE, newAsteroidI, newAsteroidDiamMin, newAsteroidDiamMax, newAsteroidH, newAsteroidVelocity]);

  // --- HANDLER PARA VOLVER AL FORMULARIO ---
  const handleGoBack = useCallback(() => {
    setViewState('inputForm');
    setFilterTerm(''); // Limpiar el filtro
    setViewMode('api'); // Volver a mostrar los asteroides de la API por defecto
    setLastSimulatedAsteroid(null); // Limpiar el asteroide simulado
  }, []);


  // --- Función para mapear severidad a valores de escala de Turín y probabilidad ---
  const getImpactDetails = (severity) => {
    switch (severity) {
      case 'LOW':
        return { prob: '1%', turin: '0', riesgo: 'Bajo', accion: 'Seguro' };
      case 'MEDIUM':
        return { prob: '55%', turin: '5', riesgo: 'Medio', accion: 'Peligro. Correr.' };
      case 'HIGH':
        return { prob: '90%', turin: '8', riesgo: 'Alto', accion: 'Impacto Inminente!' };
      default:
        return { prob: 'N/A', turin: 'N/A', riesgo: 'Desconocido', accion: 'Información no disponible' };
    }
  };

  const impactDetails = lastSimulatedAsteroid ? getImpactDetails(lastSimulatedAsteroid.severity) : getImpactDetails(null);

  // Calcular contadores para el panel lateral
  const totalAsteroidsCount = apiAsteroids.length + manualAsteroids.length;
  const filteredAsteroidsCount = (() => {
    let asteroidsToCount = [];
    if (viewMode === 'api') {
      asteroidsToCount = apiAsteroids;
    } else if (viewMode === 'manual') {
      asteroidsToCount = manualAsteroids;
    } else if (viewMode === 'all') {
      asteroidsToCount = [...apiAsteroids, ...manualAsteroids];
    }
    // Asegurarse de que el asteroide simulado se cuenta si es el único en la escena en modo simulación
    if (viewState === 'simulation' && lastSimulatedAsteroid && viewMode === 'manual') {
        asteroidsToCount = [lastSimulatedAsteroid];
    }
    return asteroidsToCount.filter(a => a.name.toLowerCase().includes(filterTerm.toLowerCase())).length;
  })();

  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'black', // Fondo negro global
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Three.js Canvas se renderiza aquí por debajo de los overlays */}

      {viewState === 'inputForm' && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.9)', // Fondo más oscuro para el formulario
          zIndex: 20, // Asegura que esté por encima del canvas
          overflowY: 'auto', // Para permitir scroll si el contenido es grande
          padding: '20px'
        }}>
          <h1 style={{ fontSize: '3em', marginBottom: '10px', color: 'white', letterSpacing: '2px' }}>WHAT IF ?</h1>
          <p style={{ fontSize: '1.2em', marginBottom: '5px', color: '#ccc' }}>Simula escenarios en segundos</p>
          <p style={{ fontSize: '1.2em', marginBottom: '30px', color: '#ccc' }}>Cambia las variables y mira el impacto en tiempo real.</p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)', // Dos columnas
            gap: '20px 40px', // Espacio entre filas y columnas
            marginBottom: '40px',
            width: '80%', // Ajustar ancho del contenedor de variables
            maxWidth: '800px'
          }}>
            {/* Campos de entrada */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 1:</label>
              <input type="text" value={newAsteroidName} onChange={(e) => setNewAsteroidName(e.target.value)}
                placeholder="Nombre"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 2:</label>
              <input type="number" step="0.1" value={newAsteroidA} onChange={(e) => setNewAsteroidA(e.target.value)}
                placeholder="1.5"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 3:</label>
              <input type="number" step="0.01" value={newAsteroidE} onChange={(e) => setNewAsteroidE(e.target.value)}
                placeholder="0.1"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 4:</label>
              <input type="number" step="1" value={newAsteroidI} onChange={(e) => setNewAsteroidI(e.target.value)}
                placeholder="10"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 5:</label>
              <input type="number" step="0.01" value={newAsteroidDiamMin} onChange={(e) => setNewAsteroidDiamMin(e.target.value)}
                placeholder="0.1"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 6:</label>
              <input type="number" step="0.1" value={newAsteroidVelocity} onChange={(e) => setNewAsteroidVelocity(e.target.value)}
                placeholder="15"
                style={{
                  width: 'calc(100% - 130px)', padding: '8px', border: '1px solid #555',
                  borderRadius: '5px', background: '#333', color: 'white', fontSize: '1em'
                }} />
            </div>
          </div>

          <button onClick={handleSimulate} style={{
            backgroundColor: '#FF0000',
            color: 'white',
            padding: '15px 40px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.5em',
            fontWeight: 'bold',
            boxShadow: '0 0 15px rgba(255,0,0,0.6)',
            transition: 'background-color 0.3s, box-shadow 0.3s',
            marginBottom: '40px'
          }}>
            SIMULAR
          </button>
        </div>
      )}

      {/* Este div contendrá los controles de visualización y filtro, siempre visibles */}
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
        fontFamily: 'Arial, sans-serif',
        zIndex: 10,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        {viewState === 'simulation' && (
             <button onClick={handleGoBack} style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '2em',
                cursor: 'pointer',
                padding: '5px 10px',
                marginBottom: '10px',
                display: 'block',
                width: 'fit-content'
             }}>
             &#8592; {/* Flecha hacia la izquierda */}
           </button>
        )}

        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>Opciones de Visualización</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => { setViewMode('api'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'api' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Asteroides API
          </button>
          <button
            onClick={() => { setViewMode('manual'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'manual' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Asteroides Manuales
          </button>
          <button
            onClick={() => { setViewMode('all'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'all' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Todos
          </button>
        </div>

        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>Filtrar Asteroides</h3>
        <input
          type="text"
          placeholder="Filtrar por nombre..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          style={{
            width: 'calc(100% - 20px)', padding: '10px', boxSizing: 'border-box',
            border: '1px solid #555', borderRadius: '5px', background: '#333', color: 'white',
            fontSize: '0.9em', marginBottom: '10px'
          }}
        />
        <p style={{ marginTop: '15px', fontSize: '0.9em' }}>Total de asteroides (API + Manuales): {totalAsteroidsCount}</p>
        <p style={{ fontSize: '0.9em' }}>Asteroides filtrados en escena: {filteredAsteroidsCount}</p>
      </div>

      {viewState === 'simulation' && (
        <>
          {/* Panel Superior de SIMULACIÓN (título) */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '60px',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center', // Centrar título
            padding: '0 20px',
            zIndex: 15
          }}>
            <h1 style={{ fontSize: '2em', color: 'white', margin: '0', letterSpacing: '2px' }}>SIMULACIÓN</h1>
          </div>

          {/* Panel Derecho de Variables */}
          <div style={{
            position: 'absolute',
            top: '80px', // Debajo del panel superior
            right: '20px',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            width: '250px',
            zIndex: 10,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            fontSize: '1em'
          }}>
            <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>Variables del Asteroide</h3>
            {lastSimulatedAsteroid && (
              <>
                <p style={{ margin: '5px 0' }}>Variable 1: {lastSimulatedAsteroid.name}</p>
                <p style={{ margin: '5px 0' }}>Variable 2: {lastSimulatedAsteroid.a.toFixed(2)} AU</p>
                <p style={{ margin: '5px 0' }}>Variable 3: {lastSimulatedAsteroid.e.toFixed(2)}</p>
                <p style={{ margin: '5px 0' }}>Variable 4: {lastSimulatedAsteroid.i.toFixed(2)} deg</p>
                <p style={{ margin: '5px 0' }}>Variable 5: {lastSimulatedAsteroid.diameterKm ? lastSimulatedAsteroid.diameterKm.toFixed(3) + ' km' : 'N/A'}</p>
                <p style={{ margin: '5px 0' }}>Variable 6: {lastSimulatedAsteroid.velocityKms ? lastSimulatedAsteroid.velocityKms.toFixed(2) + ' km/s' : 'N/A'}</p>
              </>
            )}
            {!lastSimulatedAsteroid && <p>No hay asteroide simulado.</p>}
          </div>

          {/* Paneles Inferiores */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            zIndex: 10,
            pointerEvents: 'none' // Para que los eventos del ratón pasen al canvas 3D
          }}>
            {/* Panel Inferior Izquierdo: Probabilidad, Escala de Turín, Riesgo */}
            <div style={{
              flex: 1,
              maxWidth: '300px', // Limitar el ancho
              background: '#3A3F47',
              color: 'white',
              padding: '10px 15px', // Reducir padding
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              fontSize: '0.9em', // Reducir tamaño de fuente
              pointerEvents: 'auto' // Permitir eventos de ratón en el panel
            }}>
              <p style={{ margin: '3px 0' }}>Prob. de impacto: {impactDetails.prob}</p>
              <p style={{ margin: '3px 0' }}>Escala de Turín: {impactDetails.turin}</p>
              <p style={{ margin: '3px 0' }}>Riesgo: {impactDetails.riesgo}</p>
              {/* Placeholder para el medidor de riesgo (gauge) */}
              <div style={{
                width: '80px', height: '40px', // Reducir tamaño del gauge
                border: '1px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '8px', fontSize: '0.7em',
                background: `conic-gradient(#4CAF50 ${parseInt(impactDetails.turin) * 10}%, #FFC107 ${parseInt(impactDetails.turin) * 10}% ${parseInt(impactDetails.turin) * 20}%, #FF0000 ${parseInt(impactDetails.turin) * 20}%)`
              }}>
                {/* Puedes usar una imagen o un componente real de gauge aquí */}
                {impactDetails.riesgo === 'Bajo' && '🟢'}
                {impactDetails.riesgo === 'Medio' && '🟠'}
                {impactDetails.riesgo === 'Alto' && '🔴'}
              </div>
            </div>

            {/* Panel Inferior Derecho: Impacto Peligro Correr */}
            <div style={{
              flex: 1,
              maxWidth: '300px', // Limitar el ancho, similar al otro panel
              background: '#2C2F3A',
              color: 'white',
              padding: '10px 15px', // Reducir padding
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2em', // Reducir tamaño de fuente
              fontWeight: 'bold',
              textAlign: 'center',
              pointerEvents: 'auto' // Permitir eventos de ratón en el panel
            }}>
              {impactDetails.accion}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Asteroid3DViewer;

