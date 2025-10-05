// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';

import * as THREE from 'three';

function Asteroid3DViewer({ onAsteroidsLoaded, onAsteroidSimulated, asteroids = [], viewMode = 'all', filterTerm = '', selectedAsteroid }) {
  // Efecto: resaltar asteroide cuando selectedAsteroid cambia desde fuera
  useEffect(() => {
    if (!selectedAsteroid || !asteroidMeshesRef.current.length) return;
    const mesh = asteroidMeshesRef.current.find(m => m.userData?.name === selectedAsteroid.name);
    if (selectedAsteroidRef.current && selectedAsteroidRef.current !== mesh) {
      selectedAsteroidRef.current.material.emissive.setHex(0x000000);
    }
    if (mesh) {
      mesh.material.emissive = new THREE.Color(0xffff00);
      selectedAsteroidRef.current = mesh;
    }
  }, [selectedAsteroid]);

  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const earthRef = useRef(null);
  const earthRotationRef = useRef(true);
  const moonRotationRef = useRef(true);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  const fogSphereRef = useRef(null);
  const fogStateRef = useRef({ active: false, progress: 0, duration: 180, maxOpacity: 0.45 });
  const smokeGroupRef = useRef(null);
  const smokeStateRef = useRef({ active: false, progress: 0, duration: 240 });
  
  const earthOriginalMaterialRef = useRef(null);
  const earthImpactedMaterialRef = useRef(null);
  const earthOriginalEmissiveRef = useRef({ color: null, intensity: null });
  
  const cameraTransitionRef = useRef({ 
    active: false,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    toLook: new THREE.Vector3(),
    progress: 0,
    duration: 100 
  });
  
  const asteroidMeshesRef = useRef([]);
  const simulationModeRef = useRef('orbit');
  const selectedAsteroidRef = useRef(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const shockwavesRef = useRef([]);
  const originalEarthColorRef = useRef(null);
  const impactEffectAppliedRef = useRef(false);

  // Lógica de energía y nivel de peligro
  const DEFAULT_DENSITY = 3000;
  
  const computeEnergyMt = (radiusKm, velocityKmS, density = DEFAULT_DENSITY) => {
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isFinite(velocityKmS) || velocityKmS <= 0) return 0;
    const r_m = radiusKm * 1000;
    const v_ms = velocityKmS * 1000;
    const volume_m3 = (4 / 3) * Math.PI * Math.pow(r_m, 3);
    const mass_kg = density * volume_m3;
    const energyJ = 0.5 * mass_kg * Math.pow(v_ms, 2);
    return energyJ / 4.184e15;
  };
  
  const severityFromEnergyMt = (energyMt) => {
    if (energyMt >= 1000) return { key: "E3_CATASTROPHIC", label: "Catastrófica" };
    if (energyMt >= 10)   return { key: "E2_SEVERE",       label: "Severa" };
    if (energyMt >= 0.1)  return { key: "E1_SIGNIFICANT",  label: "Significativa" };
    return { key: "E0_MINI", label: "Mínima" };
  };
  
  const combineDangerLevelLocal = (severityFlag, energyClassKey) => {
    const isPHA = severityFlag === 'HIGH';
    if (energyClassKey === 'E3_CATASTROPHIC') return { nivel: 'Extremo',  desc: 'Impacto con efectos globales' };
    if (energyClassKey === 'E2_SEVERE')       return { nivel: isPHA ? 'Alto' : 'Moderado', desc: isPHA ? 'Riesgo regional severo' : 'Riesgo regional relevante' };
    if (energyClassKey === 'E1_SIGNIFICANT')  return { nivel: isPHA ? 'Moderado' : 'Bajo',  desc: isPHA ? 'Daños de ciudad probables' : 'Daños de ciudad posibles' };
    return { nivel: 'Bajo', desc: 'Airburst/daños locales menores' };
  };
  
  const decideImpactEffect = (asteroid) => {
    if (!asteroid) {
      console.warn('decideImpactEffect: no asteroid provided');
      return;
    }
    
    const orbitData = asteroid.userData?.orbit || {};
    const radiusKm = orbitData.size || asteroid.userData?.size || 0.05;
    const velocityKmS = orbitData.velocity || orbitData.velocityKms || asteroid.userData?.velocity || 20;
    const severity = orbitData.severity || asteroid.userData?.severity || 'LOW';
    
    const energyMt = computeEnergyMt(radiusKm, velocityKmS);
    const eClass = severityFromEnergyMt(energyMt);
    const danger = combineDangerLevelLocal(severity, eClass.key);
    const nivel = danger.nivel;
    
    console.log('Impacto detectado:', {
      name: asteroid.userData?.name,
      radiusKm,
      velocityKmS,
      energyMt,
      severity,
      energyClass: eClass.key,
      nivelPeligro: nivel
    });
    
    if (nivel === 'Bajo') {
      console.log('Aplicando primer impacto (nivel Bajo)');
      primerImpacto();
    } else if (nivel === 'Moderado') {
      console.log('Aplicando segundo impacto (nivel Moderado)');
      segundoImpacto();
    } else {
      console.log('Aplicando tercer impacto (nivel Alto/Extremo)');
      tercer_Impacto();
    }
  };

  const R_EARTH_SCENE = 63.78;
  const EARTH_ORBIT_IN_EARTH_RADII = 50;
  const ORBIT_SCALE = R_EARTH_SCENE * EARTH_ORBIT_IN_EARTH_RADII;
  const MIN_ASTEROID_RADIUS_KM = 0.05;
  const ASTEROID_UNIFORM_SCALE = 100;
  const MAX_SCENE_RADIUS = R_EARTH_SCENE * 0.6;

  const sceneRef = useRef(null);
  const orbitGroupRef = useRef(null);

  const addAsteroidsToScene = (dataList) => {
    if (!sceneRef.current || !orbitGroupRef.current) return;
    const orbitGroup = orbitGroupRef.current;
    
    dataList.forEach((data) => {
      try {
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
        orbitLine.userData = { name: data.name };
        orbitGroup.add(orbitLine);

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
          orbitLine,
          currentIndex: 0
        };
        asteroid.position.copy(orbitPoints[0]);
        sceneRef.current.add(asteroid);
        asteroidMeshesRef.current.push(asteroid);
      } catch (e) {
        console.warn('Error adding asteroid to scene', e);
      }
    });
  };

  const onAsteroidClick = (asteroid) => {
    if (!asteroid) {
      console.log('Asteroide no encontrado');
      return;
    }

    if (isSimulated) return;
    setIsPaused(false);
    setIsSimulated(true);

    if (onAsteroidSimulated) {
      onAsteroidSimulated({
        name: asteroid.userData.name,
        a: asteroid.userData.orbit.a,
        e: asteroid.userData.orbit.e,
        i: asteroid.userData.orbit.i,
        diameterKm: asteroid.userData.orbit.size * 2,
        velocityKms: asteroid.userData.orbit.velocity || null,
        severity: asteroid.userData.orbit.severity || 'LOW'
      });
    }

    const directionToOrigin = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), asteroid.position).normalize();
    const asteroidRadius = asteroid.geometry?.parameters?.radius || (asteroid.userData?.size ? asteroid.userData.size * 100 : 10);
    const distanceBehind = Math.max(asteroidRadius * 20, 400);
    const cameraTargetPos = asteroid.position.clone().add(directionToOrigin.clone().multiplyScalar(-distanceBehind));
    const cameraTargetLook = asteroid.position.clone();

    cameraTransitionRef.current = {
      active: true,
      fromPos: cameraRef.current.position.clone(),
      toPos: cameraTargetPos,
      fromLook: new THREE.Vector3().copy(cameraRef.current.getWorldDirection(new THREE.Vector3())).add(cameraRef.current.position),
      toLook: cameraTargetLook,
      progress: 0,
      duration: 100
    };

    selectedAsteroidRef.current = asteroid;
  };

  const initializeImpact = (asteroid) => {
    if (!asteroid) return;
    console.log('Iniciando simulación con:', asteroid.userData.name);
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
  };

  const reiniciar = () => {
    simulationModeRef.current = 'orbit';
    earthRotationRef.current = true;
    moonRotationRef.current = true;
    impactEffectAppliedRef.current = false;

    asteroidMeshesRef.current.forEach(ast => {
      if (ast.userData.impactPath) {
        ast.userData.isImpacting = false;
        ast.userData.impactPath = null;
        ast.userData.trail?.line?.parent?.remove(ast.userData.trail.line);
        ast.userData.trail = null;
      }
      if (ast.userData.orbitPoints && ast.userData.orbitPoints.length) {
        ast.position.copy(ast.userData.orbitPoints[0]);
        ast.userData.currentIndex = 0;
      }
      ast.material.emissive?.setHex?.(0x000000);
    });

    selectedAsteroidRef.current = null;

    if (earthOriginalMaterialRef.current && earthRef.current) {
      earthRef.current.material = earthOriginalMaterialRef.current;
      earthRef.current.material.needsUpdate = true;
    } else if (earthRef.current?.material?.color && originalEarthColorRef.current) {
      earthRef.current.material.color.copy(originalEarthColorRef.current);
    }
    
    if (earthRef.current?.material && earthOriginalEmissiveRef.current.color) {
      const mat = earthRef.current.material;
      if (mat.emissive) {
        mat.emissive.copy(earthOriginalEmissiveRef.current.color);
        if (earthOriginalEmissiveRef.current.intensity !== null) {
          mat.emissiveIntensity = earthOriginalEmissiveRef.current.intensity;
        }
      }
    }

    if (sceneRef.current) {
      sceneRef.current.fog = null;
    }

    smokeStateRef.current.active = false;
    if (smokeGroupRef.current) {
      smokeGroupRef.current.visible = false;
      smokeGroupRef.current.children.forEach(sp => { sp.material.opacity = 0; });
    }

    fogStateRef.current.active = false;
    if (fogSphereRef.current) {
      fogSphereRef.current.visible = false;
      fogSphereRef.current.material.opacity = 0;
    }

    shockwavesRef.current.forEach(sw => {
      if (sw.mesh) {
        sceneRef.current?.remove(sw.mesh);
        sw.mesh.geometry?.dispose();
        sw.mesh.material?.dispose();
      }
    });
    shockwavesRef.current = [];

    setIsSimulated(false);
    setIsPaused(false);
  };

  const primerImpacto = () => {
    if (!sceneRef.current || !earthRef.current) return;
    crearOndaExpansiva({
      color: 0xffffff,
      duracion: 2500,
      escalaFinal: 3.5,
      opacidadInicial: 0.9,
      thicknessFactor: 1
    });
  };

  const segundoImpacto = () => {
    if (!sceneRef.current || !earthRef.current) return;
    if (fogSphereRef.current) {
      fogSphereRef.current.visible = true;
      fogSphereRef.current.material.color.set(0xff6a00);
      fogSphereRef.current.material.opacity = 0;
      fogStateRef.current.active = true;
      fogStateRef.current.progress = 0;
      fogStateRef.current.duration = 220;
      fogStateRef.current.maxOpacity = 0.5;
    }
  };

  const crearOndaExpansiva = (cfg = {}) => {
    if (!sceneRef.current || !earthRef.current) return;
    const {
      color = 0xffffff,
      duracion = 2000,
      escalaFinal = 3,
      opacidadInicial = 1,
      thicknessFactor = 1
    } = cfg;

    const innerR = R_EARTH_SCENE * 1.01;
    const ringThickness = R_EARTH_SCENE * 0.005 * thicknessFactor;
    const outerR = innerR + ringThickness;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacidadInicial,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(earthRef.current.position);
    sceneRef.current.add(ring);
    shockwavesRef.current.push({
      mesh: ring,
      startTime: performance.now(),
      duration: duracion,
      escalaFinal
    });
  };

  const pauseContinue = () => {
    if (simulationModeRef.current === "orbit") {
      simulationModeRef.current = "paused";
      earthRotationRef.current = false;
      moonRotationRef.current = false;
      setIsPaused(true);
    } else if (simulationModeRef.current === "paused") {
      simulationModeRef.current = "orbit";
      earthRotationRef.current = true;
      moonRotationRef.current = true;
      setIsPaused(false);
    }
  };

  const tercer_Impacto = () => {
    if (earthRef.current) {
      const loader = new THREE.TextureLoader();
      const aplicarMaterialImpacto = (mapa) => {
        const nuevoMat = new THREE.MeshPhongMaterial({
          map: mapa,
          emissive: 0x441100,
          emissiveIntensity: 0.8,
          specular: 0x111111,
          shininess: 6
        });
        earthRef.current.material = nuevoMat;
        earthRef.current.material.needsUpdate = true;
      };
      
      if (earthImpactedMaterialRef.current) {
        earthRef.current.material = earthImpactedMaterialRef.current;
        earthRef.current.material.needsUpdate = true;
      } else {
        loader.load(
          '/2k_makemake_fictional.jpg',
          (tex) => {
            aplicarMaterialImpacto(tex);
            earthImpactedMaterialRef.current = earthRef.current.material;
          },
          undefined,
          () => {}
        );
      }
    }

    if (smokeGroupRef.current) {
      smokeStateRef.current.active = true;
      smokeStateRef.current.progress = 0;
      smokeGroupRef.current.visible = true;
      smokeGroupRef.current.children.forEach(sprite => {
        sprite.material.opacity = 0;
        const { normal } = sprite.userData;
        sprite.position.copy(normal.clone().multiplyScalar(earthRef.current ? earthRef.current.geometry.parameters.radius * (1.05 + Math.random()*0.02) : 65));
      });
    } else if (fogSphereRef.current) {
      fogStateRef.current.active = true;
      fogStateRef.current.progress = 0;
      fogSphereRef.current.visible = true;
      fogSphereRef.current.material.opacity = 0;
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const earthSystem = new THREE.Group();
    scene.add(earthSystem);

    let cameraDistance = 1000;
    cameraRef.current = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 20000);
    cameraRef.current.position.z = cameraDistance;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const earthGeometry = new THREE.SphereGeometry(63.71, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      '/earthmap.jpg',
      (texture) => {
        const earthMaterial = new THREE.MeshPhongMaterial({
          map: texture,
          shininess: 25,
          specular: 0x333333
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        earthSystem.add(earth);
        earthRef.current = earth;
        earthOriginalMaterialRef.current = earthMaterial;
        
        textureLoader.load(
          '/2k_makemake_fictional.jpg',
          (impactTex) => {
            earthImpactedMaterialRef.current = new THREE.MeshPhongMaterial({
              map: impactTex,
              emissive: 0x441100,
              emissiveIntensity: 0.8,
              specular: 0x111111,
              shininess: 6
            });
          },
          undefined,
          () => {}
        );
      },
      undefined,
      () => {
        const earthMaterial = new THREE.MeshPhongMaterial({
          color: 0x2233ff,
          shininess: 25,
          specular: 0x333333
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
        earthSystem.add(earth);
        earthRef.current = earth;
      }
    );

    const atmosphereGeometry = new THREE.SphereGeometry(R_EARTH_SCENE * 1.02, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthSystem.add(atmosphere);

    const fogGeometry = new THREE.SphereGeometry(R_EARTH_SCENE * 1.25, 64, 64);
    const fogMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const fogSphere = new THREE.Mesh(fogGeometry, fogMaterial);
    fogSphere.visible = false;
    earthSystem.add(fogSphere);
    fogSphereRef.current = fogSphere;

    const generateSmokeTexture = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,size,size);
      const puffs = 10;
      for (let i=0;i<puffs;i++) {
        const r = size * (0.25 + Math.random()*0.35);
        const x = size/2 + (Math.random()-0.5)*size*0.3;
        const y = size/2 + (Math.random()-0.5)*size*0.3;
        const g = ctx.createRadialGradient(x,y, r*0.1, x,y,r);
        const alpha = 0.12 + Math.random()*0.18;
        g.addColorStop(0, `rgba(255,255,255,${alpha*1.2})`);
        g.addColorStop(0.4, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    const createSmokeCloud = () => {
      const group = new THREE.Group();
      const texture = generateSmokeTexture();
      const SPRITES = 42;
      for (let i=0;i<SPRITES;i++) {
        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          opacity: 0,
          blending: THREE.NormalBlending,
          color: 0xffffff
        });
        const sprite = new THREE.Sprite(material);
        const theta = Math.acos(2*Math.random()-1);
        const phi = 2*Math.PI*Math.random();
        const normal = new THREE.Vector3(
          Math.sin(theta)*Math.cos(phi),
          Math.cos(theta),
          Math.sin(theta)*Math.sin(phi)
        );
        const baseRadius = R_EARTH_SCENE * (1.05 + Math.random()*0.12);
        sprite.position.copy(normal.clone().multiplyScalar(baseRadius));
        const baseScale = R_EARTH_SCENE * 0.7 * (0.6 + Math.random()*0.8);
        sprite.scale.set(baseScale, baseScale, 1);
        sprite.userData = {
          normal,
          baseScale,
          seed: Math.random(),
          radialOffset: R_EARTH_SCENE * (0.15 + Math.random()*0.25)
        };
        group.add(sprite);
      }
      group.visible = false;
      earthSystem.add(group);
      smokeGroupRef.current = group;
    };

    createSmokeCloud();

    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    orbitGroupRef.current = orbitGroup;

    const moonRadius = R_EARTH_SCENE * 0.27;
    const moonDistance = R_EARTH_SCENE * 10;
    const moonInclination = 5.145;
    const moon_orbital_speed = 0.01;
    const MOON_SYNC_ROTATION = true;

    const moonOrbitPivot = new THREE.Group();
    moonOrbitPivot.rotation.x = THREE.MathUtils.degToRad(moonInclination);
    earthSystem.add(moonOrbitPivot);

    let moon = null;
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 48, 48);
    textureLoader.load('/2k_moon.jpg', (moonTexture) => {
      const moonMaterial = new THREE.MeshPhongMaterial({
        map: moonTexture,
        shininess: 2,
        specular: 0x222222
      });
      moon = new THREE.Mesh(moonGeometry, moonMaterial);
      moon.castShadow = true;
      moon.receiveShadow = true;
      moon.userData = { name: 'Moon', type: 'moon', radius: 1737 };
      moon.position.set(moonDistance, 0, 0);
      moonOrbitPivot.add(moon);
    });

    const SUN_TO_EARTH_RADIUS_RATIO = 110;
    const SUN_SIZE_COMPRESSION = 0.09;
    const SUN_RADIUS_SCENE = R_EARTH_SCENE * SUN_TO_EARTH_RADIUS_RATIO * SUN_SIZE_COMPRESSION;
    const SUN_DISTANCE_SCENE = ORBIT_SCALE * 5;
    const SUN_POSITION = new THREE.Vector3(-SUN_DISTANCE_SCENE, 0, 0);

    textureLoader.load('/8k_sun.jpg', (sunTexture) => {
      const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, color: 0xffffff });
      const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS_SCENE, 64, 64);
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.userData = { name: 'Sun', type: 'star', radiusKm: 695700 };
      sun.position.copy(SUN_POSITION);
      scene.add(sun);
    });

    const sunLight = new THREE.PointLight(0xffffff, 2.2, ORBIT_SCALE * 10, 2);
    sunLight.position.copy(SUN_POSITION);
    scene.add(sunLight);

    directionalLight.position.copy(SUN_POSITION.clone().normalize().multiplyScalar(SUN_DISTANCE_SCENE));
    directionalLight.target.position.set(0, 0, 0);
    scene.add(directionalLight.target);

    const randomColor = () => Math.floor(Math.random() * 0xffffff);

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
        
        const links = Array.from(
          new Set(
            neoList
              .map(n => n.links?.self)
              .filter(Boolean)
              .map(url => url.replace('http://', 'https://'))
          )
        );

        const fetchPromises = links.map(async (url) => {
          try {
            const r = await fetch(url, { signal: controller.signal });
            if (!r.ok) return null;
            const neo = await r.json();
            const orbital = neo.orbital_data || {};
            const kmData = neo.estimated_diameter?.kilometers;
            const dMin = kmData?.estimated_diameter_min;
            const dMax = kmData?.estimated_diameter_max;
            const avgDiameterKm = (dMin + dMax) / 2;
            const radiusKm = avgDiameterKm / 2;
            
            const velocity = parseFloat(orbital.orbital_period) 
              ? (2 * Math.PI * parseFloat(orbital.semi_major_axis) * 149597870.7) / 
                (parseFloat(orbital.orbital_period) * 365.25 * 86400)
              : null;

            return {
              name: neo.name || neo.designation || 'NEO',
              a: parseFloat(orbital.semi_major_axis) || 1,
              e: parseFloat(orbital.eccentricity) || 0,
              i: parseFloat(orbital.inclination) || 0,
              size: typeof radiusKm === 'number' ? radiusKm : 0.05,
              velocity: velocity,
              velocityKms: velocity,
              color: randomColor(),
              source: 'api',
              severity: neo.is_potentially_hazardous_asteroid ? 'HIGH' : 'LOW'
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(fetchPromises);
        const detailed = results.filter(r => r !== null);
        
        if (detailed.length) {
          addAsteroidsToScene(detailed);
          
          if (onAsteroidsLoaded) {
            onAsteroidsLoaded(detailed);
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Error obteniendo asteroides:', e);
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
    for (let i = 0; i < 3000; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const y = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;
      starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

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

    const onWheel = (e) => {
      e.preventDefault();
      cameraDistance += e.deltaY * 0.1;
      cameraDistance = Math.max(100, Math.min(2000, cameraDistance));
    };

    const onClick = (event) => {
      if (isDragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(asteroidMeshesRef.current);
      if (intersects.length > 0) {
        const asteroid = intersects[0].object;
        if(asteroid.userData && asteroid.userData.type === 'asteroid') {
          if (selectedAsteroidRef.current && selectedAsteroidRef.current !== asteroid) {
            selectedAsteroidRef.current.material.emissive.setHex(0x000000);
          }
          asteroid.material.emissive = new THREE.Color(0xffff00);
          selectedAsteroidRef.current = asteroid;
          const orbit = asteroid.userData.orbit || {};
          if (onAsteroidSimulated) {
            onAsteroidSimulated({
              name: asteroid.userData.name,
              a: orbit.a,
              e: orbit.e,
              i: orbit.i,
              diameterKm: (typeof orbit.size === 'number' ? orbit.size * 2 : undefined),
              size: orbit.size,
              velocity: orbit.velocity || asteroid.userData.velocity || null,
              velocityKms: orbit.velocity || asteroid.userData.velocity || null,
              severity: orbit.severity || asteroid.userData.severity || 'LOW',
              source: asteroid.userData.source || 'api',
              color: asteroid.userData.color
            });
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('click', onClick);

    let animationId;
    const animate = () => {
      if (earthRef.current && earthRotationRef.current) {
        earthRef.current.rotation.y += 0.003;
      }

      if (MOON_SYNC_ROTATION && moon && moonRotationRef.current) {
        moonOrbitPivot.rotation.y += moon_orbital_speed;
        moon.rotation.y += moon_orbital_speed;
      }

      asteroidMeshesRef.current.forEach(asteroid => {
        if(!asteroid.userData.isImpacting && simulationModeRef.current==='orbit') {
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

      if(selectedAsteroidRef.current){
        const threat = selectedAsteroidRef.current;
        const path = threat.userData.impactPath;
        if (path && path.progress < 1) {
          path.progress += 0.005;
          
          threat.position.lerpVectors(path.start, path.target, path.progress);
          
          const trail = threat.userData.trail;
          if (trail && trail.currentIndex < trail.maxPoints) {
            trail.positions[trail.currentIndex * 3] = threat.position.x;
            trail.positions[trail.currentIndex * 3 + 1] = threat.position.y;
            trail.positions[trail.currentIndex * 3 + 2] = threat.position.z;
            trail.currentIndex++;
            trail.geometry.setDrawRange(0, trail.currentIndex);
            trail.geometry.attributes.position.needsUpdate = true;
          }
          
          const intensity = path.progress;
          threat.material.color.setRGB(1, 1 - intensity, 1 - intensity);

          const dirToTarget = new THREE.Vector3().subVectors(path.target, threat.position).normalize();
          const astRadius = threat.geometry?.parameters?.radius || (threat.userData?.size ? threat.userData.size * 100 : 10);
          const offsetDist = Math.max(astRadius * 12, 400);
          const cameraOffset = dirToTarget.clone().multiplyScalar(-offsetDist);
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          const lookAtPoint = threat.position.clone().lerp(path.target, 0.15);
          cameraRef.current.lookAt(lookAtPoint);

        } else if (path && path.progress >= 1 && !path.impactDone) {
          console.log('¡IMPACTO DETECTADO!');
          path.impactDone = true;
          
          if (!impactEffectAppliedRef.current) {
            decideImpactEffect(threat);
            impactEffectAppliedRef.current = true;
          }
          
          simulationModeRef.current = 'orbit';
          earthRotationRef.current = true;
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
          simulationModeRef.current = "impact";
          initializeImpact(selectedAsteroidRef.current);
        }
      } else if (simulationModeRef.current === "impact" && selectedAsteroidRef.current) {
        const threat = selectedAsteroidRef.current;
        const path = threat.userData.impactPath;
        if (path) {
          const dirToTarget = new THREE.Vector3().subVectors(path.target, threat.position).normalize();
          const astRadius = threat.geometry?.parameters?.radius || (threat.userData?.size ? threat.userData.size * 100 : 10);
          const offsetDist = Math.max(astRadius * 12, 350);
          const cameraOffset = dirToTarget.clone().multiplyScalar(-offsetDist);
          cameraRef.current.position.copy(threat.position.clone().add(cameraOffset));
          const lookAtPoint = threat.position.clone().lerp(path.target, 0.15);
          cameraRef.current.lookAt(lookAtPoint);
        }
      } else {
        cameraRef.current.position.x = cameraDistance * Math.sin(cameraRotation.phi) * Math.sin(cameraRotation.theta);
        cameraRef.current.position.y = cameraDistance * Math.cos(cameraRotation.phi);
        cameraRef.current.position.z = cameraDistance * Math.sin(cameraRotation.phi) * Math.cos(cameraRotation.theta);
        cameraRef.current.lookAt(0, 0, 0);
      }

      if (shockwavesRef.current.length > 0) {
        const now = performance.now();
        for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
          const sw = shockwavesRef.current[i];
          const t = (now - sw.startTime) / sw.duration;
          if (t >= 1) {
            sceneRef.current.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
            shockwavesRef.current.splice(i, 1);
            continue;
          }
          const escala = 1 + (sw.escalaFinal - 1) * t;
          sw.mesh.scale.set(escala, escala, escala);
          sw.mesh.material.opacity = 1 - t;
        }
      }
        
      if (fogStateRef.current.active && fogSphereRef.current) {
        const f = fogStateRef.current;
        f.progress++;
        const half = f.duration / 2;
        let opacity;
        if (f.progress <= half) {
          opacity = (f.progress / half) * f.maxOpacity;
        } else {
          opacity = Math.max(0, (1 - (f.progress - half) / half) * f.maxOpacity);
        }
        fogSphereRef.current.material.opacity = opacity;
        if (f.progress >= f.duration) {
          f.active = false;
          f.progress = 0;
          fogSphereRef.current.visible = false;
          fogSphereRef.current.material.opacity = 0;
        }
      }

      if (smokeStateRef.current.active && smokeGroupRef.current) {
        const s = smokeStateRef.current;
        s.progress++;
        const t = s.progress / s.duration;
        smokeGroupRef.current.children.forEach(sprite => {
          const ud = sprite.userData;
          let o;
          if (t < 0.35) o = t / 0.35;
          else if (t < 0.55) o = 1;
          else o = Math.max(0, 1 - (t - 0.55)/0.45);
          o *= 0.6 + ud.seed * 0.4;
          sprite.material.opacity = o;
          
          const pulse = 0.8 + Math.sin((t + ud.seed) * Math.PI * 2) * 0.25;
          const growth = 1 + t * 0.9;
          const scale = ud.baseScale * pulse * growth;
          sprite.scale.set(scale, scale, 1);
          
          const radial = R_EARTH_SCENE * 1.05 + t * ud.radialOffset;
          const jitterAmp = 6;
          const jitter = new THREE.Vector3(
            (Math.random()-0.5)*jitterAmp*0.15,
            (Math.random()-0.5)*jitterAmp*0.15,
            (Math.random()-0.5)*jitterAmp*0.15
          );
          sprite.position.copy(ud.normal.clone().multiplyScalar(radial)).add(jitter);
          sprite.material.rotation += 0.001 + ud.seed * 0.004;
        });
        if (s.progress >= s.duration) {
          s.active = false;
          s.progress = 0;
          smokeGroupRef.current.visible = false;
          smokeGroupRef.current.children.forEach(sp => sp.material.opacity = 0);
        }
      }

      renderer.render(scene, cameraRef.current);
      animationId = requestAnimationFrame(animate);
    };
    animate();

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

  React.useEffect(() => {
    try {
      if (!asteroids || !asteroids.length) return;
      if (!sceneRef.current) return;

      const existingNames = new Set(asteroidMeshesRef.current.map(m => m.userData?.name));
      const toAdd = asteroids.filter(a => !existingNames.has(a.name));
      if (toAdd.length === 0) return;

      addAsteroidsToScene(toAdd);
      if (onAsteroidsLoaded) onAsteroidsLoaded(asteroids.filter(a => a.source === 'api'));
    } catch (e) {
      console.warn('Error processing asteroids prop', e);
    }
  }, [asteroids]);

  React.useEffect(() => {
    try {
      const term = (filterTerm || '').toLowerCase();
      asteroidMeshesRef.current.forEach(mesh => {
        const data = mesh.userData?.orbit || {};
        const name = (mesh.userData?.name || '').toLowerCase();
        const source = data.source || 'api';
        const matchesView = viewMode === 'all' || viewMode === source;
        const matchesFilter = !term || name.includes(term);
        const visible = matchesView && matchesFilter;
        mesh.visible = visible;
        if (mesh.userData?.orbitLine) mesh.userData.orbitLine.visible = visible;
      });
    } catch (e) {
      console.warn('Error applying asteroid visibility filter', e);
    }
  }, [viewMode, filterTerm, asteroids]);
 
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '0',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        zIndex: 10
      }}>
        <Button 
          onClick={() => onAsteroidClick(selectedAsteroidRef.current)}
          variant='contained' 
          startIcon={<PlayCircleIcon/>} 
          color='success' 
          disabled={isSimulated}
        >
          Iniciar Simulación
        </Button>
        <Button 
          onClick={reiniciar} 
          variant='contained' 
          startIcon={<ReplayIcon/>} 
          color='error'
        >
          Reiniciar
        </Button>
        {isPaused ? (
          <Button 
            onClick={pauseContinue} 
            variant='contained' 
            startIcon={<PlayArrowIcon/>} 
            color="warning" 
            disabled={isSimulated}
          >
            Continuar
          </Button>
        ) : (
          <Button 
            onClick={pauseContinue} 
            variant='contained' 
            startIcon={<PauseIcon/>} 
            color="warning" 
            disabled={isSimulated}
          >
            Pausar
          </Button>
        )}
      </div>
    </div>
  );
}

export default Asteroid3DViewer;