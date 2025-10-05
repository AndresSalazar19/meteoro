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
    const diamMin = parseFloat(simulationData.diamMinKm || 0) || 0;
    const diamMax = parseFloat(simulationData.diamMaxKm || 0) || diamMin || 0;
    const avgDiameter = (diamMin + diamMax) / 2 || diamMin || 0;
    const radiusKm = avgDiameter / 2 || 0.05;

    const manual = {
      name: simulationData.name,
      a: simulationData.a,
      e: simulationData.e,
      i: simulationData.i,
      size: radiusKm, // viewer expects `size` as radius in km
      velocity: simulationData.velocityKms || null,
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