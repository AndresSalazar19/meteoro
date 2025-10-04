// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Asteroid3DViewer = () => {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const earthRef = useRef(null);
  const earthRotationRef = useRef(true);
  const cameraTransitionRef = useRef({ active: false,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromLook: new THREE.Vector3(),
  toLook: new THREE.Vector3(),
  progress: 0,
  duration: 100 });
  const asteroidMeshesRef = useRef([]);
  const simulationModeRef = useRef('orbit');
  const threatAsteroidRef = useRef(null);

  const onAsteroidClick = (asteroid) => {
    if (!asteroid) {
      console.log('Asteroide no encontrado');
      return;
    }
    
    const direction = new THREE.Vector3().subVectors(
      new THREE.Vector3(0,0,0), // punto de impacto
      asteroid.position
    ).normalize();

    const cameraTargetPos = asteroid.position.clone().add(direction.clone().multiplyScalar(-10)); // 50 unidades detrás
    const cameraTargetLook = new THREE.Vector3(0, 0, 0); // mira al punto de impacto

    // Inicializa transición de cámara
    cameraTransitionRef.current = {
      active: true,
      fromPos: cameraRef.current.position.clone(),
      toPos: cameraTargetPos,
      fromLook: new THREE.Vector3().copy(cameraRef.current.getWorldDirection(new THREE.Vector3())).add(cameraRef.current.position),
      toLook: cameraTargetLook,
      progress: 0,
      duration: 100
    };

    // Guardar el meteorito para simular después
    threatAsteroidRef.current = asteroid;
  };

  const initializeImpact = (asteroid) => {
    if (!asteroid) return;
    console.log('Iniciando simulación con:', asteroid.userData.name);
    // calcular trayectoria de impacto
    asteroid.userData.impactPath = {
      start: asteroid.position.clone(),
      target: new THREE.Vector3(0, 0, 0),
      progress: 0,
      impactDone: false
    };
    asteroid.userData.isImpacting = true;

    const maxPoints = 1000;
    const positions = new Float32Array(maxPoints * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    earthRef.current.parent.add(trailLine);
    asteroid.userData.trail = { positions, currentIndex: 0, maxPoints, geometry: trailGeometry, line: trailLine };
  }

  const reiniciar = () => {
    // Detener simulación
    simulationModeRef.current = "orbit";
    // Reiniciar la Tierra a rotación normal
    earthRotationRef.current = true;

    // Reiniciar asteroides
    asteroidMeshesRef.current.forEach(ast => {
      if (ast.userData.impactPath) {
        ast.userData.isImpacting = false;
        ast.userData.impactPath = null;
        ast.userData.trail?.line?.parent?.remove(ast.userData.trail.line);
        ast.userData.trail = null;
        ast.position.copy(ast.userData.orbitPoints[0]);
      }
    });
    threatAsteroidRef.current = null;
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // Escena, cámara y renderizador
    const scene = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    // Variable para controlar la distancia de la cámara
    let cameraDistance = 100;
    cameraRef.current.position.z = cameraDistance;
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
        earthRef.current = earth; // referencia global del mesh
      },
      undefined,
      (err) => {
        // Si falla la textura, usar color por defecto
        earthMaterial = new THREE.MeshPhongMaterial({
          color: 0x2233ff,
          shininess: 25,
          specular: 0x333333
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        scene.add(earth);
        console.error('No se pudo cargar la textura de la Tierra:', err);
        earthRef.current = earth;
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

    // Escalado: semi_major_axis (AU) * ORBIT_SCALE -> unidades de la escena
    const ORBIT_SCALE = 100; // Ajusta este número para separar más / menos las órbitas

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
          currentIndex: 0
        };
        asteroid.position.copy(orbitPoints[0]);
        scene.add(asteroid);
        asteroidMeshesRef.current.push(asteroid);
      });
    };

    // Fetch de la API NASA NEO
    const controller = new AbortController();
    const API_KEY = import.meta.env.VITE_NASA_API_KEY || '2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK';
    const FEED_URL = `https://api.nasa.gov/neo/rest/v1/feed?start_date=2032-12-19&end_date=2032-12-26&api_key=${API_KEY}`;
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
            const parsed = {
              name: neo.name || neo.designation || 'NEO',
              a: parseFloat(orbital.semi_major_axis) || 1, // AU
              e: parseFloat(orbital.eccentricity) || 0,
              i: parseFloat(orbital.inclination) || 0, // grados
              size: typeof diameter === 'number' ? diameter : 0.05, // km mínimos
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
      if (earthRef.current && earthRotationRef.current) {
        earthRef.current.rotation.y += 0.003;
      }

      // Animar asteroides en sus órbitas
      asteroidMeshesRef.current.forEach(asteroid => {
          if(!asteroid.userData.isImpacting) { // no se mueve el que va a impactar
            const points = asteroid.userData.orbitPoints;
            if (points) {
              asteroid.userData.currentIndex = (asteroid.userData.currentIndex + 0.2) % points.length;
              const pos = points[Math.floor(asteroid.userData.currentIndex)];
              asteroid.position.copy(pos);
              asteroid.rotation.x += 0.01;
              asteroid.rotation.y += 0.02;
            }
          }
      });
      if(threatAsteroidRef.current){
        // Modo impacto
        const threat = threatAsteroidRef.current;
        const path = threat.userData.impactPath;
        if (path && path.progress < 1) {
          path.progress += 0.005;
          
          threat.position.lerpVectors(
            path.start,
            path.target,
            path.progress
          );
          
          const trail = threat.userData.trail;
          if (trail && trail.currentIndex < trail.maxPoints) {
            trail.positions[trail.currentIndex * 3]     = threat.position.x;
            trail.positions[trail.currentIndex * 3 + 1] = threat.position.y;
            trail.positions[trail.currentIndex * 3 + 2] = threat.position.z;
            trail.currentIndex++;
            trail.geometry.setDrawRange(0, trail.currentIndex);
            trail.geometry.attributes.position.needsUpdate = true;
          }
          
          // Cambiar color a rojo
          const intensity = path.progress;
          threat.material.color.setRGB(1, 1 - intensity, 1 - intensity);

          // Cámara detrás del meteorito
          const direction = new THREE.Vector3().subVectors(path.target, path.start).normalize();
          const cameraOffset = direction.clone().multiplyScalar(-10); // distancia detrás
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          cameraRef.current.lookAt(path.target);

        } else if (path && path.progress >= 1 && !path.impactDone) {
          console.log('¡IMPACTO!');
          path.impactDone = true;

          // Volver al modo órbita después del impacto
          simulationModeRef.current = "orbit";
          earthRotationRef.current = false; // detiene la rotación de la Tierra
        }
       }

      if (cameraTransitionRef.current.active) {
        const t = cameraTransitionRef.current;
        t.progress++;

        const alpha = t.progress / t.duration;
        cameraRef.current.position.lerpVectors(t.fromPos, t.toPos, alpha);

        const look = new THREE.Vector3().lerpVectors(t.fromLook, t.toLook, alpha);
        cameraRef.current.lookAt(look);

        if (t.progress >= t.duration) {
          t.active = false;
          simulationModeRef.current = "impact";  // iniciar simulación
          initializeImpact(threatAsteroidRef.current); 
        }
      } else if (simulationModeRef.current === "impact" && threatAsteroidRef.current) {
        const threat = threatAsteroidRef.current;
        const path = threat.userData.impactPath;
        if (path) {
          // Cámara detrás del meteorito
          const direction = new THREE.Vector3().subVectors(path.target, path.start).normalize();
          const cameraOffset = direction.clone().multiplyScalar(-10);
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          cameraRef.current.lookAt(path.target);
        }
      } else {
        // Modo libre (órbita)
        cameraRef.current.position.x = cameraDistance * Math.sin(cameraRotation.phi) * Math.sin(cameraRotation.theta);
        cameraRef.current.position.y = cameraDistance * Math.cos(cameraRotation.phi);
        cameraRef.current.position.z = cameraDistance * Math.sin(cameraRotation.phi) * Math.cos(cameraRotation.theta);
        cameraRef.current.lookAt(0, 0, 0);
      }
        
      renderer.render(scene, cameraRef.current);
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
    <>
    <div>
      <button onClick={() => onAsteroidClick(asteroidMeshesRef.current.find(a => a.userData.name === '(2024 YR4)'))}>Iniciar Simulación</button>
      <br/>
      <button onClick={reiniciar}>Reiniciar</button>
    </div>
   <div
      ref={mountRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    />
   </>
  );
};

export default Asteroid3DViewer;