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
    let cameraDistance = 5;
    camera.position.z = cameraDistance;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

            // Earth
    const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x2233ff,
      emissive: 0x112244,
      shininess: 25,
      specular: 0x333333
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.castShadow = true;
    earth.receiveShadow = true;
    earth.userData = { name: 'Earth', type: 'planet', radius: 6371 };
    scene.add(earth);
    
        // Cubo 
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

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


        // Evento de scroll para zoom
        const onWheel = (e) => {
            e.preventDefault();
            // Ajusta la distancia de la cámara con el scroll
            cameraDistance += e.deltaY * 0.01;
            cameraDistance = Math.max(2, Math.min(50, cameraDistance)); // Limita el zoom
            camera.position.z = cameraDistance;
        };
        renderer.domElement.addEventListener('wheel', onWheel);

    
        // Animación
        let animationId;
        const animate = () => {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
        };
        animate();

    // Limpieza al desmontar el componente
    return () => {
      cancelAnimationFrame(animationId);
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
