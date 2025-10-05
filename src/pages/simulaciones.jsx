import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Importa useLocation y useNavigate
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import WhatIfPanel from "../components/WhatIfPanel";
import MainLayout from "../layouts/MainLayout";
import SimulationOverlay from "../components/SimulationOverlay";

export default function Simulaciones() {
  const [showWhatIf, setShowWhatIf] = useState(true);
  const [apiAsteroids, setApiAsteroids] = useState([]);
  const [manualAsteroids, setManualAsteroids] = useState([]);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [viewMode, setViewMode] = useState('api');
  const [filterTerm, setFilterTerm] = useState('');

  // Nuevo estado para guardar el ID del asteroide a seleccionar desde la navegación
  const [asteroidIdToSelectFromAPI, setAsteroidIdToSelectFromAPI] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Función auxiliar para procesar los datos de un asteroide y convertirlo al formato 'manual'
  // Esta función sigue siendo útil para los asteroides *creados* manualmente.
  const processAndAddAsteroid = (simulationData) => {
    // Cálculo de diámetros/radio
    const dMin = typeof simulationData.dMin !== 'undefined'
      ? Number(simulationData.dMin)
      : Number(simulationData.diamMinKm || 0);
    const dMax = typeof simulationData.dMax !== 'undefined'
      ? Number(simulationData.dMax)
      : Number(simulationData.diamMaxKm || dMin || 0);

    const avgDiameter = typeof simulationData.avgDiameterKm !== 'undefined'
      ? Number(simulationData.avgDiameterKm)
      : (dMin + dMax) / 2 || dMin || 0;

    const radiusKm = typeof simulationData.radiusKm !== 'undefined'
      ? Number(simulationData.radiusKm)
      : (avgDiameter / 2) || 0.05;

    // Datos orbitales: prefiere simulationData.orbital si se proporciona
    const orbital = simulationData.orbital || {
      semi_major_axis: simulationData.a,
      eccentricity: simulationData.e,
      inclination: simulationData.i
    };

    const manual = {
      id: simulationData.id || `Manual-${Date.now().toString().slice(-4)}`, // Asegura un ID único
      name: simulationData.name || `Manual-${Date.now().toString().slice(-4)}`,
      a: Number(orbital.semi_major_axis) || Number(simulationData.a) || 1,
      e: Number(orbital.eccentricity) || Number(simulationData.e) || 0,
      i: Number(orbital.inclination) || Number(simulationData.i) || 0,
      size: radiusKm, // el viewer espera `size` como radio en km
      diameterKm: radiusKm * 2, // Añadido para el panel derecho
      velocity: simulationData.velocityKms || null,
      velocityKms: simulationData.velocityKms || null, // Añadido para el panel derecho
      color: Math.floor(Math.random() * 0xffffff), // Color aleatorio
      source: 'manual', // Indica que es un asteroide creado manualmente
      severity: radiusKm > 0.5 ? 'HIGH' : 'LOW'
    };
    return manual;
  };

  // Callback para ocultar el panel después de submit y agregar asteroide manual (desde WhatIfPanel)
  const handleSimulate = (simulationData) => {
    const manualAsteroid = processAndAddAsteroid(simulationData);
    setManualAsteroids(prev => [...prev, manualAsteroid]);
    setSelectedAsteroid(manualAsteroid); // Selecciona el asteroide recién creado
    setShowWhatIf(false); // Oculta el panel WhatIf
    setViewMode('manual'); // Asegura que el modo de vista muestre los manuales
  };

  // Callback para volver a mostrar el panel si lo necesitas
  const handleShowPanel = () => setShowWhatIf(true);

  // useEffect para leer el ID del asteroide desde el estado de la navegación
  useEffect(() => {
    if (location.state && location.state.selectedAsteroidId) {
      const idFromNav = location.state.selectedAsteroidId;
      setAsteroidIdToSelectFromAPI(idFromNav);
      setShowWhatIf(false); // Oculta el panel WhatIf si venimos de un detalle
      setViewMode('api'); // Asegura que el modo de vista sea 'api' o 'all'

      // Limpia el estado de la navegación
      navigate(location.pathname, { replace: true, state: { ...location.state, selectedAsteroidId: undefined } });
    }
  }, [location, navigate]);

  // useEffect para seleccionar el asteroide una vez que apiAsteroids se han cargado
  useEffect(() => {
    if (asteroidIdToSelectFromAPI && apiAsteroids.length > 0) {
      const asteroidToSelect = apiAsteroids.find(ast => ast.id === asteroidIdToSelectFromAPI);
      if (asteroidToSelect) {
        setSelectedAsteroid(asteroidToSelect);
        // Opcional: limpiar asteroidIdToSelectFromAPI para evitar re-selección
        setAsteroidIdToSelectFromAPI(null);
      }
    }
  }, [asteroidIdToSelectFromAPI, apiAsteroids]);


  return (


<div className="fixed inset-0 flex overflow-hidden">
  {showWhatIf && (
    <WhatIfPanel onSimulate={handleSimulate} onViewStateChange={() => setShowWhatIf(false)} />
  )}

  <div className="w-[70%] h-full min-w-0 bg-gray-800 text-white overflow-hidden">
    <Asteorid3Dviewer
      asteroids={[...apiAsteroids, ...manualAsteroids]}
      onAsteroidsLoaded={(list) => setApiAsteroids(list)}
      onAsteroidSimulated={(ast) => setSelectedAsteroid(ast)}
      viewMode={viewMode}
      filterTerm={filterTerm}
      selectedAsteroid={selectedAsteroid}
    />
  </div>

  <div className="w-[30%] h-full min-w-0 bg-gray-200 text-black overflow-hidden">
    {/* wrapper con scroll interno SOLO si hace falta */}
    <div className="h-full overflow-auto">
      <SimulationOverlay
        asteroids={[...apiAsteroids, ...manualAsteroids]}
        asteroid={selectedAsteroid}
        onSelectAsteroid={setSelectedAsteroid}
        onGoBack={handleShowPanel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filterTerm={filterTerm}
        setFilterTerm={setFilterTerm}
        totalCount={[...apiAsteroids, ...manualAsteroids].length}
        filteredCount={([].concat(apiAsteroids, manualAsteroids)
          .filter(a => viewMode === 'all' || a.source === viewMode)
          .filter(a => !filterTerm || a.name.toLowerCase().includes(filterTerm.toLowerCase()))
          .length)}
      />
    </div>
  </div>
</div>
    
  );
}