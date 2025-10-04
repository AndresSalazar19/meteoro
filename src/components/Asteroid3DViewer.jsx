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
  const R_EARTH_SCENE = 63.78;      
  const EARTH_ORBIT_IN_EARTH_RADII = 50; 
  const ORBIT_SCALE = R_EARTH_SCENE * EARTH_ORBIT_IN_EARTH_RADII;
  // Escalado visual uniforme: un solo factor para todos los asteroides.
  const MIN_ASTEROID_RADIUS_KM = 0.05;      // radio mínimo físico usado antes de escalar
  const ASTEROID_UNIFORM_SCALE = 200;       // factor multiplicativo único aumentado para mayor visibilidad
  const MAX_SCENE_RADIUS = R_EARTH_SCENE * 0.6; // límite máximo visual ligeramente ampliado

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      20000 // Aumentamos el plano lejano para abarcar órbitas escaladas
    );
    // Distancia inicial de la cámara: algo mayor que la órbita de la Tierra para verla completa
    let cameraDistance = ORBIT_SCALE * 1.8; // ~ 1.8 UA
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
  const earthGeometry = new THREE.SphereGeometry(R_EARTH_SCENE, 64, 64);
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
  // Ajustamos la atmósfera a un 2% mayor que el radio visual de la Tierra
  const atmosphereGeometry = new THREE.SphereGeometry(R_EARTH_SCENE * 1.02, 64, 64);
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

  // Escalado lineal ya definido arriba: semi_major_axis (AU) * ORBIT_SCALE

    const randomColor = () => Math.floor(Math.random() * 0xffffff);

    const addAsteroidsToScene = (dataList) => {
      dataList.forEach((data) => {
  // a (semi-major axis en UA) -> escena
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

  // Asteroide: escala uniforme
  let physicalRadiusKm = Math.max(data.size, MIN_ASTEROID_RADIUS_KM);
  let radiusScene = physicalRadiusKm * ASTEROID_UNIFORM_SCALE;
  if (radiusScene > MAX_SCENE_RADIUS) radiusScene = MAX_SCENE_RADIUS;
  const asteroidGeometry = new THREE.SphereGeometry(radiusScene, 16, 16);
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
          currentIndex: 0
        };
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
            const kmData = neo.estimated_diameter?.kilometers;
            const dMin = kmData?.estimated_diameter_min;
            const dMax = kmData?.estimated_diameter_max;
            let avgDiameterKm;
            avgDiameterKm = (dMin + dMax) / 2; // promedio de diámetros
            const radiusKm = avgDiameterKm / 2;
            const parsed = {
              name: neo.name || neo.designation || 'NEO',
              a: parseFloat(orbital.semi_major_axis) || 1, // AU
              e: parseFloat(orbital.eccentricity) || 0,
              i: parseFloat(orbital.inclination) || 0, // grados
              // Guardamos en size el RADIO físico en km.
              size: typeof radiusKm === 'number' ? radiusKm : 0.05,
              color: randomColor()
            };
            detailed.push(parsed);
          } catch (err) {
            // Ignora errores individuales
            // console.error('Error NEO individual', err);
          }
        }
        if (detailed.length) {
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
    // Generar estrellas en una región suficientemente grande respecto a la nueva escala
    // (tomamos ~ 40 * ORBIT_SCALE como caja aleatoria)
    const STAR_FIELD_SIZE = ORBIT_SCALE * 40; // ≈ 127k unidades
    const STAR_COUNT = 3000;
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = (Math.random() - 0.5) * STAR_FIELD_SIZE;
      const y = (Math.random() - 0.5) * STAR_FIELD_SIZE;
      const z = (Math.random() - 0.5) * STAR_FIELD_SIZE;
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
      // Ajusta la distancia de la cámara con el scroll (zoom in/out)
      cameraDistance += e.deltaY * 0.5; // sensibilidad
      // Limitar para no acercar demasiado ni alejar infinito
      const MIN_DISTANCE = R_EARTH_SCENE * 4;           // ~ 4 radios (muy cerca)
      const MAX_DISTANCE = ORBIT_SCALE * 25;            // suficiente para órbitas externas
      cameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraDistance));
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