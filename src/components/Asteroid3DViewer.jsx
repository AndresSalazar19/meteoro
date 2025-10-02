// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Asteroid3DViewer = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // Escena, cámara y renderizador
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    // Variable para controlar la distancia de la cámara
    let cameraDistance = 100;
    camera.position.z = cameraDistance;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Luz direccional y ambiental para ver la textura
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Earth con textura realista
    const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    let earthMaterial;
    let earth;
    textureLoader.load(
      '/earthmap.jpg',
      (texture) => {
        earthMaterial = new THREE.MeshPhongMaterial({
          map: texture,
          shininess: 25,
          specular: 0x333333
        });
        earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        scene.add(earth);
      },
      undefined,
      (err) => {
        // Si falla la textura, usar color por defecto
        earthMaterial = new THREE.MeshPhongMaterial({
          color: 0x2233ff,
          shininess: 25,
          specular: 0x333333
        });
        earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        scene.add(earth);
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

    // Grupo para órbitas y arreglo para guardar meshes dinámicos
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    const asteroidMeshes = [];

    // Escalado: semi_major_axis (AU) * ORBIT_SCALE -> unidades de la escena
    const ORBIT_SCALE = 100; // Ajusta este número para separar más / menos las órbitas
    
    //Constantes para calcular la Severidad
    const DEFAULT_DENSITY = 2500;
    const J_PER_MT = 4.184e15;    // joules por megatón TNT

    //Aproximar diametro mediante el brillo de un objeto en caso de no tener informacion
    const estimateDiameterFromH = (H, albedo = 0.14) => {
      if (typeof H !== 'number') return null;
      return (1329 / Math.sqrt(albedo)) * Math.pow(10, -H / 5);
    };

    //Escoger mejor diametro para cada caso
    const chooseDiameterKm = (diamMinKm, diamMaxKm, H, albedo = 0.14) => {
      const a = typeof diamMinKm === 'number' && diamMinKm > 0 ? diamMinKm : null;
      const b = typeof diamMaxKm === 'number' && diamMaxKm > 0 ? diamMaxKm : null;
      if (a && b) return Math.sqrt(a * b); // media geométrica
      if (a) return a;
      if (b) return b;
      const dH = estimateDiameterFromH(H, albedo);
      return typeof dH === 'number' && dH > 0 ? dH : 0.05; // fallback pequeño
    };

    // Tomar una velocidad representativa (km/s) del acercamiento mas proximo a la Tierra
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

    // Calcular energía cinecita (Megatones) desde diámetro (km) y velocidad (km/s)
    const computeEnergyMt = ({ diamMinKm, diamMaxKm, H, velocityKms, densityKgM3 = DEFAULT_DENSITY }) => {
      if (!(velocityKms > 0)) return null;
      const diameterKm = chooseDiameterKm(diamMinKm, diamMaxKm, H);
      const radiusM = (diameterKm * 1000) / 2;
      const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      const massKg = densityKgM3 * volumeM3;
      const velocityMs = velocityKms * 1000;
      const energyJ = 0.5 * massKg * velocityMs * velocityMs;
      const energyMt = energyJ / J_PER_MT;
      return { energyMt, diameterKm, velocityKms };
    };

    const tierFromEnergyMt = (E) => {
      if (E == null) return null;
      if (E >= 100) return 'HIGH';
      if (E >= 1) return 'MEDIUM';
      return 'LOW';
    };



    const randomColor = () => Math.floor(Math.random() * 0xffffff);

    const addAsteroidsToScene = (dataList) => {
      dataList.forEach((data) => {
        const scaledA = data.a * ORBIT_SCALE;
        // Calcular puntos de la órbita elíptica (ecuación de cónica)
        const orbitPoints = [];
        const segments = 128;
        for (let j = 0; j <= segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
            // r en unidades escaladas
          const r = (scaledA * (1 - data.e * data.e)) / (1 + data.e * Math.cos(theta));
          const x = r * Math.cos(theta);
          const z = r * Math.sin(theta);
          const y = z * Math.sin(data.i * Math.PI / 180);
          const zAdjusted = z * Math.cos(data.i * Math.PI / 180);
          orbitPoints.push(new THREE.Vector3(x, y, zAdjusted));
        }
        // Línea de la órbita
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({
          color: data.color,
          transparent: true,
          opacity: 0.4
        });
        const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        orbitGroup.add(orbitLine);

        // Asteroide (size en km -> lo dejamos tal cual y lo multiplicamos para visibilidad)
        const visualRadius = Math.max(data.size, 0.01) * 5; // evita que desaparezcan si son muy pequeños
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
        //comprobar
        if (data.energyMt != null) {
          console.log(
            `[SEVERITY] ${data.name} | E≈${data.energyMt.toFixed(2)} Mt | v≈${(data.velocityKms??0).toFixed(2)} km/s | D≈${(data.diameterKm??0).toFixed(3)} km | ${data.severity}`
          );
        }else{
          console.log("No hay nada :c")
        }


        asteroid.position.copy(orbitPoints[0]);
        scene.add(asteroid);
        asteroidMeshes.push(asteroid);
      });
    };

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
        // Obtener links únicos (self)
        const links = Array.from(new Set(neoList.map(n => n.links && n.links.self).filter(Boolean)));

        // Descargas secuenciales (cantidad pequeña). Si fueran muchas, se puede limitar concurrencia.
        const detailed = [];
        for (const url of links) {
          if (controller.signal.aborted) return;
          try {
            const r = await fetch(url, { signal: controller.signal });
            if (!r.ok) continue;
            const neo = await r.json();
            const orbital = neo.orbital_data || {};
            // Evitamos leer close_approach_data (no lo usamos) simplemente ignorándolo
            const diameter = neo.estimated_diameter?.kilometers?.estimated_diameter_min;

            // Diámetro y H
            const diamMinKm = neo?.estimated_diameter?.kilometers?.estimated_diameter_min;
            const diamMaxKm = neo?.estimated_diameter?.kilometers?.estimated_diameter_max;
            const H = neo?.absolute_magnitude_h;

            // Velocidad (km/s) approach más cercano a la Tierra
            const vKms = pickVelocityKmsFromApproaches(neo?.close_approach_data || [], 'Earth');

            // Severidad (si hay velocidad)
            let energyMt = null;
            let severity = null;
            let diameterKmUsed = null;
            

            if (vKms && vKms > 0) {
              const eCalc = computeEnergyMt({ diamMinKm, diamMaxKm, H, velocityKms: vKms, densityKgM3: DEFAULT_DENSITY });
              if (eCalc) {
                energyMt = eCalc.energyMt;
                severity = tierFromEnergyMt(energyMt);
                diameterKmUsed = eCalc.diameterKm;
              }
            } else {
              // si no hay velocidad, intenta al menos fijar el diámetro representativo para el tamaño visual
              diameterKmUsed = chooseDiameterKm(diamMinKm, diamMaxKm, H);
            }

            const sizeKmForViz = typeof diameterKmUsed === 'number' ? diameterKmUsed : (typeof diamMinKm === 'number' ? diamMinKm : 0.05);


            const parsed = {
              name: neo.name || neo.designation || 'NEO',
              a: parseFloat(orbital.semi_major_axis) || 1, // AU
              e: parseFloat(orbital.eccentricity) || 0,
              i: parseFloat(orbital.inclination) || 0, // grados
              size: typeof diameter === 'number' ? diameter : 0.05, // km mínimos
              
              color: randomColor(),
              energyMt,
              severity,
              velocityKms : vKms ?? null,
              diameterKm : diameterKmUsed ?? null
            };
            detailed.push(parsed);
          } catch (err) {
            // Ignora errores individuales
            // console.error('Error NEO individual', err);
          }
        }
        if (detailed.length) {
          console.log(detailed)
          addAsteroidsToScene(detailed);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Fallo obteniendo asteroides NASA:', e);
        }
      }
    };

    fetchAsteroids();

    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 2.0,
      transparent: true,
      opacity: 0.8
    });

    const starsVertices = [];
    // Generar 3000 estrellas en posiciones aleatorias
    for (let i = 0; i < 3000; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const y = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;
      starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraRotation = { theta: Math.PI / 4, phi: Math.PI / 6 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      cameraRotation.theta -= deltaX * 0.005;
      cameraRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraRotation.phi + deltaY * 0.005));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Evento de scroll para zoom
    const onWheel = (e) => {
      e.preventDefault();
      // Ajusta la distancia de la cámara con el scroll
  cameraDistance += e.deltaY * 0.1;
  cameraDistance = Math.max(20, Math.min(500, cameraDistance)); // Alejamiento de cámara
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animación
    let animationId;
    const animate = () => {
      // Rotar la Tierra si existe
      if (earth) {
        earth.rotation.y += 0.003;
      }

      // Animar asteroides en sus órbitas
      asteroidMeshes.forEach(asteroid => {
        const points = asteroid.userData.orbitPoints;
        if (points) {
          asteroid.userData.currentIndex = (asteroid.userData.currentIndex + 0.2) % points.length;
          const pos = points[Math.floor(asteroid.userData.currentIndex)];
          asteroid.position.copy(pos);
          asteroid.rotation.x += 0.01;
          asteroid.rotation.y += 0.02;
        }
      });

      // Actualiza la posición de la cámara según los ángulos
      camera.position.x = cameraDistance * Math.sin(cameraRotation.phi) * Math.sin(cameraRotation.theta);
      camera.position.y = cameraDistance * Math.cos(cameraRotation.phi);
      camera.position.z = cameraDistance * Math.sin(cameraRotation.phi) * Math.cos(cameraRotation.theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    // Limpieza al desmontar el componente
    return () => {  
      controller.abort();
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    />
  );
};

export default Asteroid3DViewer;