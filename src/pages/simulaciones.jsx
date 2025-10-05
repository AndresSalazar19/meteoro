import React, { useState } from 'react';
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import WhatIfPanel from "../components/WhatIfPanel";
import MainLayout from "../layouts/MainLayout";
import SimulationOverlay from "../components/SimulationOverlay";

export default function Simulaciones() {
  const [showWhatIf, setShowWhatIf] = useState(true);
  const [simulatedAsteroidData, setSimulatedAsteroidData] = useState(null); // Nuevo estado para los datos del asteroide

 
  const handleSimulate = (data) => {
    setSimulatedAsteroidData(data); // Guarda los datos del asteroide en el estado
    setShowWhatIf(false); 
  };


  const handleShowPanel = () => setShowWhatIf(true);

  return (
    <>
      {showWhatIf && (
        <WhatIfPanel onSimulate={handleSimulate} onViewStateChange={() => setShowWhatIf(false)} />
      )}

      <Asteorid3Dviewer newAsteroidData={simulatedAsteroidData} />
      <SimulationOverlay />
    </>
  );
}