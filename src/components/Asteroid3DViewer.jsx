// src/components/Asteroid3DViewer.jsx

import React, { useEffect, useRef } from 'react';
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

    // Asteroides y órbitas
    const asteroids = [
      { name: 'Apophis', a: 138, e: 0.191, i: 3.3, size: 0.37, color: 0xaa6644 },
      { name: 'Bennu', a: 168, e: 0.204, i: 6.0, size: 0.49, color: 0x887755 },
      { name: 'Ryugu', a: 180, e: 0.190, i: 5.9, size: 0.90, color: 0x776655 },
      { name: '2024 PT5', a: 95, e: 0.28, i: 8.2, size: 0.011, color: 0xccaa88 },
      { name: 'Didymos', a: 215, e: 0.384, i: 3.4, size: 0.78, color: 0x998877 }
    ];

    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    const asteroidMeshes = [];

    asteroids.forEach((data) => {
      // Calcular puntos de la órbita elíptica
      const orbitPoints = [];
      const segments = 128;
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const r = (data.a * (1 - data.e * data.e)) / (1 + data.e * Math.cos(theta));
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
      // Asteroide
      const asteroidGeometry = new THREE.SphereGeometry(data.size * 5, 16, 16);
      const asteroidMaterial = new THREE.MeshPhongMaterial({ 
        color: data.color,
        shininess: 5
      });
      const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
      // Posición inicial
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
  cameraDistance = Math.max(20, Math.min(150, cameraDistance)); // Alejamiento de cámara
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