import React, { useState, useEffect, useMemo } from 'react';
// ====== Helper para enriquecer asteroides ======
const DEFAULT_DENSITY = 3000; // kg/m^3
const computeEnergyMt = (radiusKm, velocityKmS, density = DEFAULT_DENSITY) => {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isFinite(velocityKmS) || velocityKmS <= 0) return 0;
  const r_m = radiusKm * 1000;
  const v_ms = velocityKmS * 1000;
  const volume_m3 = (4 / 3) * Math.PI * Math.pow(r_m, 3);
  const mass_kg = density * volume_m3;
  const energyJ = 0.5 * mass_kg * Math.pow(v_ms, 2);
  return energyJ / 4.184e15; // -> Megatones TNT
};

const severityFromEnergyMt = (energyMt) => {
  if (energyMt >= 1000) return { key: "E3_CATASTROPHIC", label: "Catastrófica" };
  if (energyMt >= 10)   return { key: "E2_SEVERE",       label: "Severa" };
  if (energyMt >= 0.1)  return { key: "E1_SIGNIFICANT",  label: "Significativa" };
  return { key: "E0_MINI",        label: "Mínima" };
};

const combineDangerLevel = (severityFlag, energyClassKey) => {
  const isPHA = severityFlag === 'HIGH';
  if (energyClassKey === "E3_CATASTROPHIC") return { nivel: "Extremo",  desc: "Impacto con efectos globales" };
  if (energyClassKey === "E2_SEVERE")       return { nivel: isPHA ? "Alto" : "Moderado", desc: isPHA ? "Riesgo regional severo" : "Riesgo regional relevante" };
  if (energyClassKey === "E1_SIGNIFICANT")  return { nivel: isPHA ? "Moderado" : "Bajo",  desc: isPHA ? "Daños de ciudad probables" : "Daños de ciudad posibles" };
  return { nivel: "Bajo", desc: "Airburst/daños locales menores" };
};

function enrichAsteroid(a) {
  const radiusKm = Number(a.size) || 0;
  const velocityKmS = Number(a.velocityKms || a.velocity) || 0;
  const energyMt = computeEnergyMt(radiusKm, velocityKmS);
  const eClass = severityFromEnergyMt(energyMt);
  const danger = combineDangerLevel(a.severity, eClass.key);
  return {
    ...a,
    energyMt,
    severity_con_respecto_a_energya: eClass.label,
    danger4: danger.nivel,
    danger_desc: danger.desc
  };
}
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


  // Enriquecer la lista de asteroides
  const enrichedAsteroids = useMemo(() => ([...apiAsteroids, ...manualAsteroids].map(enrichAsteroid)), [apiAsteroids, manualAsteroids]);

  // Enriquecer el seleccionado (si existe)
  const enrichedSelectedAsteroid = useMemo(() => {
    if (!selectedAsteroid) return null;
    // Buscar por nombre (idealmente deberías usar un id único)
    const found = enrichedAsteroids.find(a => a.name === selectedAsteroid.name);
    return found || enrichAsteroid(selectedAsteroid);
  }, [selectedAsteroid, enrichedAsteroids]);

  return (


    <div className="w-screen h-[90%] flex overflow-hidden">
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
        asteroids={enrichedAsteroids}
        asteroid={enrichedSelectedAsteroid}
        onSelectAsteroid={setSelectedAsteroid}
        onGoBack={handleShowPanel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filterTerm={filterTerm}
        setFilterTerm={setFilterTerm}
        totalCount={enrichedAsteroids.length}
        filteredCount={enrichedAsteroids
          .filter(a => viewMode === 'all' || a.source === viewMode)
          .filter(a => !filterTerm || a.name.toLowerCase().includes(filterTerm.toLowerCase()))
          .length}
      />
    </div>
  </div>
</div>
    
  );
}