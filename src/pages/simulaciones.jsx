import React, { useState } from 'react';
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import WhatIfPanel from "../components/WhatIfPanel";
import MainLayout from "../layouts/MainLayout";
import SimulationOverlay from "../components/SimulationOverlay";

export default function Simulaciones() {
  const [showWhatIf, setShowWhatIf] = useState(true);
  // Lista de asteroides cargados desde la API
  const [apiAsteroids, setApiAsteroids] = useState([]);
  // Asteroides creados manualmente desde el WhatIf panel
  const [manualAsteroids, setManualAsteroids] = useState([]);
  // Asteroide actualmente seleccionado/simulado
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  // View/filter state para SimulationOverlay
  const [viewMode, setViewMode] = useState('api');
  const [filterTerm, setFilterTerm] = useState('');

  // Callback para ocultar el panel después de submit y agregar asteroide manual
  const handleSimulate = (simulationData) => {
    // Support both the new shape (orbital, kmData, dMin/dMax, avgDiameterKm, radiusKm)
    // and the previous shape (diamMinKm, diamMaxKm, name, a, e, i)
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

    // Orbital data: prefer simulationData.orbital if provided
    const orbital = simulationData.orbital || {
      semi_major_axis: simulationData.a,
      eccentricity: simulationData.e,
      inclination: simulationData.i
    };

    const manual = {
      name: simulationData.name || `Manual-${Date.now().toString().slice(-4)}`,
      a: Number(orbital.semi_major_axis) || Number(simulationData.a) || 1,
      e: Number(orbital.eccentricity) || Number(simulationData.e) || 0,
      i: Number(orbital.inclination) || Number(simulationData.i) || 0,
      size: radiusKm, // viewer expects `size` as radius in km
      velocity: simulationData.velocityKms || simulationData.velocity || null,
      color: Math.floor(Math.random() * 0xffffff),
      source: 'manual',
      severity: radiusKm > 0.5 ? 'HIGH' : 'LOW'
    };

    setManualAsteroids(prev => [...prev, manual]);
    setShowWhatIf(false);
  };
//si
  // Callback para volver a mostrar el panel si lo necesitas
  const handleShowPanel = () => setShowWhatIf(true);

  return (
    <>
      {showWhatIf && (
        <WhatIfPanel onSimulate={handleSimulate} onViewStateChange={() => setShowWhatIf(false)} />
      )}
      <Asteorid3Dviewer
        asteroids={[...apiAsteroids, ...manualAsteroids]}
        onAsteroidsLoaded={(list) => setApiAsteroids(list)}
        onAsteroidSimulated={(ast) => setSelectedAsteroid(ast)}
        viewMode={viewMode}
        filterTerm={filterTerm}
      />

      <SimulationOverlay
        asteroids={[...apiAsteroids, ...manualAsteroids]}
        asteroid={selectedAsteroid}
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
    </>
  );
}