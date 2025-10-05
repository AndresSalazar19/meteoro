import React, { useState } from 'react';
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import WhatIfPanel from "../components/WhatIfPanel";
import MainLayout from "../layouts/MainLayout";
import SimulationOverlay from "../components/SimulationOverlay";

export default function Simulaciones() {
  const [showWhatIf, setShowWhatIf] = useState(true);

  // Callback para ocultar el panel después de submit
  const handleSimulate = (simulationData) => {
    // Aquí podrías pasar simulationData a Asteorid3Dviewer si lo necesitas
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
      <Asteorid3Dviewer/>
      <SimulationOverlay />
    </>
  );
}