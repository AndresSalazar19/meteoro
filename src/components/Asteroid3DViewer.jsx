// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Asteroid3DViewer = () => {
  const mountRef = useRef(null);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const cameraRef = useRef(null);
  const earthRef = useRef(null);
  const earthRotationRef = useRef(true);
  const moonRotationRef = useRef(true);
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
    // Dirección desde el asteroide hacia el objetivo (origen)
    const directionToOrigin = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), asteroid.position).normalize();
    // Determinar un offset dinámico en función del tamaño del asteroide
  const asteroidRadius = asteroid.geometry?.parameters?.radius || (asteroid.userData?.size ? asteroid.userData.size * 100 : 10);
  // Alejamos un poco más para asegurar que la Tierra siga siendo visible mientras seguimos la trayectoria
  const distanceBehind = Math.max(asteroidRadius * 20, 400); // distancia mínima aumentada
    // Posicionar la cámara detrás del asteroide (opuesto a la dirección hacia el origen)
    const cameraTargetPos = asteroid.position.clone().add(directionToOrigin.clone().multiplyScalar(-distanceBehind));
    // Mirar al propio asteroide (no al origen) para que sea visible durante la transición
    const cameraTargetLook = asteroid.position.clone();

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

  const pauseContinue = () => {
    // Alternar entre pausar y continuar la simulación
    if (simulationModeRef.current === "orbit") {
      simulationModeRef.current = "paused";
      earthRotationRef.current = false;
      moonRotationRef.current = false;
    } else if (simulationModeRef.current === "paused") {
      simulationModeRef.current = "orbit";
      earthRotationRef.current = true;
      moonRotationRef.current = true;
    }
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // Escena, cámara y renderizador
    const scene = new THREE.Scene();
    const earthSystem = new THREE.Group();
    scene.add(earthSystem);
    const R_EARTH_SCENE = 63.78;      
    const EARTH_ORBIT_IN_EARTH_RADII = 50; 
    const ORBIT_SCALE = R_EARTH_SCENE * EARTH_ORBIT_IN_EARTH_RADII;
    // Escalado visual uniforme: un solo factor para todos los asteroides.
    const MIN_ASTEROID_RADIUS_KM = 0.05;      // radio mínimo físico usado antes de escalar
    const ASTEROID_UNIFORM_SCALE = 100;       // factor multiplicativo único aumentado para mayor visibilidad
    const MAX_SCENE_RADIUS = R_EARTH_SCENE * 0.6; // límite máximo visual ligeramente ampliado

    cameraRef.current = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    // Variable para controlar la distancia de la cámara
    let cameraDistance = 1000;
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
    cameraRef.current = new THREE.PerspectiveCamera(
        75,
        mount.clientWidth/mount.clientHeight,
        0.1,
        20000
      )
    // Earth con textura realista
    const earthGeometry = new THREE.SphereGeometry(63.71, 64, 64);
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
        earthSystem.add(earth);
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
        earthSystem.add(earth);
        console.error('No se pudo cargar la textura de la Tierra:', err);
        earthRef.current = earth;
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
  earthSystem.add(atmosphere);

// Grupo para órbitas y arreglo para guardar meshes dinámicos
  const orbitGroup = new THREE.Group();
    
    const moonRadius = R_EARTH_SCENE * 0.27; 
    const moonDistance = R_EARTH_SCENE * 10;
    const moonInclination = 5.145;
    const moon_orbital_speed = 0.01; 
    const MOON_SYNC_ROTATION = true; 

    const moonOrbitPivot = new THREE.Group();
    moonOrbitPivot.rotation.x = THREE.MathUtils.degToRad(moonInclination);
    earthSystem.add(moonOrbitPivot);

  let moon = null;

  // Añadir la luna

    const moonGeometry = new THREE.SphereGeometry(moonRadius, 48, 48);
    const moonTexture = textureLoader.load('/2k_moon.jpg');
    const moonMaterial = new THREE.MeshPhongMaterial({
      map: moonTexture,
      shininess: 2,
      specular: 0x222222
    });
    moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.castShadow = true;
    moon.receiveShadow = true;
    moon.userData = { name: 'Moon', type: 'moon', radius: 1737 };
    // Posicionar la Luna a la distancia orbital sobre el eje X
    moon.position.set(moonDistance, 0, 0);
    moonOrbitPivot.add(moon);

    scene.add(orbitGroup);
    //const asteroidMeshes = [];


    // Añadir el sol -> Sigue una vista geocéntrica; la Tierra permanece en el origen

    const SUN_TO_EARTH_RADIUS_RATIO = 110;          // ~109-110 (relación real)
    const SUN_SIZE_COMPRESSION = 0.09;              // comprime para que no ocupe toda la escena
    const SUN_RADIUS_SCENE = R_EARTH_SCENE * SUN_TO_EARTH_RADIUS_RATIO * SUN_SIZE_COMPRESSION;

    const SUN_DISTANCE_SCENE = ORBIT_SCALE * 5;     // lo colocamos suficientemente lejos para dar luz
    const SUN_POSITION = new THREE.Vector3(-SUN_DISTANCE_SCENE, 0, 0); // a la izquierda (eje -X)

    const sunTexture = textureLoader.load('/8k_sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, color: 0xffffff });

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS_SCENE, 64, 64);
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.userData = { name: 'Sun', type: 'star', radiusKm: 695700 };
    sun.position.copy(SUN_POSITION);
    scene.add(sun);

    // Luz puntual (opcional) para reforzar iluminación; puedes comentar si no la quieres
    const sunLight = new THREE.PointLight(0xffffff, 2.2, ORBIT_SCALE * 10, 2);
    sunLight.position.copy(SUN_POSITION);
    scene.add(sunLight);

    // Reorientar la luz direccional existente para que venga "desde" el Sol
    directionalLight.position.copy(SUN_POSITION.clone().normalize().multiplyScalar(SUN_DISTANCE_SCENE));
    directionalLight.target.position.set(0, 0, 0); // que apunte al centro (Tierra)
    scene.add(directionalLight.target);

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
        asteroidMeshesRef.current.push(asteroid);
      });
    };

    // Fetch de la API NASA NEO
    const controller = new AbortController();
    const API_KEY = import.meta.env.VITE_NASA_API_KEY || '2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK';
    const FEED_URL = `https://api.nasa.gov/neo/rest/v1/feed?start_date=2025-12-19&end_date=2025-12-26&api_key=${API_KEY}`;

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

          // Descargas paralelas con Promise.all para máxima velocidad
          const fetchPromises = links.map(async (url) => {
            try {
              const r = await fetch(url, { signal: controller.signal });
              if (!r.ok) return null;
              const neo = await r.json();
              const orbital = neo.orbital_data || {};
              const kmData = neo.estimated_diameter?.kilometers;
              const dMin = kmData?.estimated_diameter_min;
              const dMax = kmData?.estimated_diameter_max;
              let avgDiameterKm;
              avgDiameterKm = (dMin + dMax) / 2; // promedio de diámetros
              const radiusKm = avgDiameterKm / 2;
              return {
                name: neo.name || neo.designation || 'NEO',
                a: parseFloat(orbital.semi_major_axis) || 1, // AU
                e: parseFloat(orbital.eccentricity) || 0,
                i: parseFloat(orbital.inclination) || 0, // grados
                // Guardamos en size el RADIO físico en km.
                size: typeof radiusKm === 'number' ? radiusKm : 0.05,
                color: randomColor()
              };
            } catch (err) {
              return null;
            }
          });

          const results = await Promise.all(fetchPromises);
          const detailed = results.filter(r => r !== null);
          
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
  cameraDistance = Math.max(100, Math.min(2000, cameraDistance)); // Alejamiento de cámara
    };

    // Evento de click para asteroides
    const onClick = (event) => {
      if (isDragging) return; // evitar click si se está arrastrando
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(asteroidMeshesRef.current);
      if (intersects.length > 0) {
        const selectedAsteroid = intersects[0].object;
        if(selectedAsteroid.userData && selectedAsteroid.userData.type === 'asteroid') {
          // realizar acción.
        } 
      }
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('click', onClick);

    // Animación
    let animationId;
    const animate = () => {
      // Rotar la Tierra si existe
      if (earthRef.current && earthRotationRef.current) {
        earthRef.current.rotation.y += 0.003;
      }
      

      // Órbita de la luna
      if (MOON_SYNC_ROTATION && moon && moonRotationRef.current) {
        moonOrbitPivot.rotation.y += moon_orbital_speed;
        moon.rotation.y += moon_orbital_speed;
      }

      // Animar asteroides en sus órbitas
      asteroidMeshesRef.current.forEach(asteroid => {
          if(!asteroid.userData.isImpacting && simulationModeRef.current==='orbit') { // no se mueve el que va a impactar
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

          // Cámara detrás del meteorito: calcular dirección desde la posición actual hacia el objetivo
          const dirToTarget = new THREE.Vector3().subVectors(path.target, threat.position).normalize();
          // Estimar radio del asteroide para un offset apropiado
          const astRadius = threat.geometry?.parameters?.radius || (threat.userData?.size ? threat.userData.size * 100 : 10);
          // Alejar un poco más la cámara para incluir la Tierra en la vista.
          const offsetDist = Math.max(astRadius * 12, 400); // distancia mínima ampliada
          const cameraOffset = dirToTarget.clone().multiplyScalar(-offsetDist);
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          // En lugar de mirar exactamente al meteorito, mirar ligeramente hacia la Tierra (punto entre meteoro y centro)
          const lookAtPoint = threat.position.clone().lerp(path.target, 0.15);
          cameraRef.current.lookAt(lookAtPoint);

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
          // En modo impacto, mantener la cámara detrás del meteorito y enfocando al propio meteorito
          const dirToTarget = new THREE.Vector3().subVectors(path.target, threat.position).normalize();
          const astRadius = threat.geometry?.parameters?.radius || (threat.userData?.size ? threat.userData.size * 100 : 10);
          const offsetDist = Math.max(astRadius * 12, 350);
          const cameraOffset = dirToTarget.clone().multiplyScalar(-offsetDist);
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          const lookAtPoint = threat.position.clone().lerp(path.target, 0.15);
          cameraRef.current.lookAt(lookAtPoint);
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
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);
 
  return (
    <>
   <div
      ref={mountRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    />
    {/* Botones de acción inferiores */}
        <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '0',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            zIndex: 10
        }}>
            <button onClick={() => onAsteroidClick(asteroidMeshesRef.current.find(a => a.userData.name === '(1999 GR6)'))}>
                Iniciar Simulación
            </button>
            <button onClick={reiniciar}>Reiniciar</button>
            <button onClick={pauseContinue}>Pausar</button>
        </div>
   </>
  );
};

export default Asteroid3DViewer;