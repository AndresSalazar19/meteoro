import React , { useMemo } from 'react';

const SimulationOverlay = ({
  asteroids = [],
  asteroid, // Este es el asteroide actualmente seleccionado para mostrar en el panel derecho
  onGoBack,
  viewMode,
  setViewMode,
  filterTerm,
  setFilterTerm,
  totalCount,
  filteredCount,
  onSelectAsteroid // <--- Nueva prop
}) => {
  const getImpactDetails = (severity) => {
    switch (severity) {
      case 'LOW':
        return { prob: '1%', turin: '0', riesgo: 'Bajo', accion: 'Seguro' };
      case 'MEDIUM':
        return { prob: '55%', turin: '5', riesgo: 'Medio', accion: 'Peligro. Correr.' };
      case 'HIGH':
        return { prob: '90%', turin: '8', riesgo: 'Alto', accion: 'Impacto Inminente!' };
      default:
        return { prob: 'N/A', turin: 'N/A', riesgo: 'Desconocido', accion: 'Información no disponible' };
    }
  };

  const impactDetails = asteroid ? getImpactDetails(asteroid.severity) : getImpactDetails(null);
  
  console.log(asteroids)
  const DEFAULT_DENSITY = 3000; // kg/m^3 (rocoso). Ajusta si usas composición.
  // ============== UTILIDADES INTERNAS ==============
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

  // Combina tu flag de PHA (HIGH/LOW) con la clase por energía para 4 casos finales
  const combineDangerLevel = (severityFlag, energyClassKey) => {
    const isPHA = severityFlag === 'HIGH';
    if (energyClassKey === "E3_CATASTROPHIC") return { nivel: "Extremo",  desc: "Impacto con efectos globales" };
    if (energyClassKey === "E2_SEVERE")       return { nivel: isPHA ? "Alto" : "Moderado", desc: isPHA ? "Riesgo regional severo" : "Riesgo regional relevante" };
    if (energyClassKey === "E1_SIGNIFICANT")  return { nivel: isPHA ? "Moderado" : "Bajo",  desc: isPHA ? "Daños de ciudad probables" : "Daños de ciudad posibles" };
    return { nivel: "Bajo", desc: "Airburst/daños locales menores" };
  };

  const asteroidsEnriquecidos = useMemo(() => {
    return asteroids.map(a => {
      const radiusKm = Number(a.size) || 0;        // 'size' es radio (km) según tu shape
      const velocityKmS = Number(a.velocity) || 0; // km/s
      const energyMt = computeEnergyMt(radiusKm, velocityKmS);
      const eClass = severityFromEnergyMt(energyMt);
      const danger = combineDangerLevel(a.severity, eClass.key); // a.severity: 'HIGH' | 'LOW'

      return {
        ...a,
        energyMt,                                       
        severity_con_respecto_a_energya: eClass.label,  
        danger4: danger.nivel,                          
        danger_desc: danger.desc
      };
    });
  }, [asteroids]);

  console.log(asteroid)

  return (
    <>
      {/* Panel de controles izquierdo */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        fontFamily: 'Arial, sans-serif',
        zIndex: 10,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        <button onClick={onGoBack} style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '2em',
          cursor: 'pointer',
          padding: '5px 10px',
          marginBottom: '10px',
          display: 'block',
          width: 'fit-content'
        }}>
          &#8592;
        </button>

        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>Opciones de Visualización</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => { setViewMode('api'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'api' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Asteroides API
          </button>
          <button
            onClick={() => { setViewMode('manual'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'manual' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Asteroides Manuales
          </button>
          <button
            onClick={() => { setViewMode('all'); setFilterTerm(''); }}
            style={{
              backgroundColor: viewMode === 'all' ? '#007bff' : '#555',
              color: 'white', padding: '10px 15px', border: 'none',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em',
              fontWeight: 'bold'
            }}
          >
            Ver Todos
          </button>
        </div>

        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>Filtrar Asteroides</h3>
        <input
          type="text"
          placeholder="Filtrar por nombre..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          style={{
            width: 'calc(100% - 20px)', padding: '10px', boxSizing: 'border-box',
            border: '1px solid #555', borderRadius: '5px', background: '#333', color: 'white',
            fontSize: '0.9em', marginBottom: '10px'
          }}
        />
        {/* Compute counts from asteroids if parent didn't provide them */}
        {typeof totalCount === 'number' ? (
          <p style={{ marginTop: '15px', fontSize: '0.9em' }}>Total de asteroides: {totalCount}</p>
        ) : (
          <p style={{ marginTop: '15px', fontSize: '0.9em' }}>Total de asteroides: {asteroids.length}</p>
        )}
        {typeof filteredCount === 'number' ? (
          <p style={{ fontSize: '0.9em' }}>Asteroides filtrados: {filteredCount}</p>
        ) : (
          <p style={{ fontSize: '0.9em' }}>Asteroides filtrados: {asteroids
            .filter(a => viewMode === 'all' || a.source === viewMode)
            .filter(a => !filterTerm || a.name.toLowerCase().includes(filterTerm.toLowerCase())).length}</p>
        )}

        <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
          {asteroids
            .filter(a => viewMode === 'all' || a.source === viewMode)
            .filter(a => !filterTerm || a.name.toLowerCase().includes(filterTerm.toLowerCase()))
            .map((a, idx) => (
              <div
                key={a.name + idx}
                style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid #444',
                  color: '#ddd',
                  cursor: 'pointer', // <--- Hace que el elemento sea clicable visualmente
                  backgroundColor: asteroid && asteroid.name === a.name ? '#007bff40' : 'transparent', // Resalta el seleccionado
                  transition: 'background-color 0.2s ease'
                }}
                onClick={() => {
                  // Buscar el asteroide enriquecido correspondiente
                  const asteroidEnriquecido = asteroidsEnriquecidos.find(ae => ae.name === a.name);
                  // Combinar ambos objetos
                  const asteroidCombinado = { ...a, ...asteroidEnriquecido };
                  onSelectAsteroid(asteroidCombinado);
                }}
                
              >
                <div style={{ fontSize: '0.95em', fontWeight: '600' }}>{a.name}</div>
                <div style={{ fontSize: '0.8em', color: '#bbb' }}>{a.source || 'api'} · a: {a.a?.toFixed?.(2) ?? a.a} AU · d: {a.size ? (a.size*2).toFixed(3)+' km' : 'N/A'}</div>
              </div>
            ))}
        </div>
      </div>



      {/* Panel Derecho de Variables */}
      <div style={{
        position: 'absolute',
        top: '80px',
        right: '20px',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        width: '250px',
        zIndex: 10,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        fontSize: '1em'
      }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
          Variables del Asteroide
        </h3>
        {asteroid ? (
          <>
            <p style={{ margin: '5px 0' }}>Nombre: {asteroid.name}</p>
            <p style={{ margin: '5px 0' }}>Semieje Mayor (a): {asteroid.a?.toFixed(2)} AU</p>
            <p style={{ margin: '5px 0' }}>Excentricidad: {asteroid.e?.toFixed(2)}</p>
            <p style={{ margin: '5px 0' }}>Inclinación: {asteroid.i?.toFixed(2)} deg</p>
            <p style={{ margin: '5px 0' }}>Diámetro: {asteroid.diameterKm ? asteroid.diameterKm.toFixed(3) + ' km' : (asteroid.size ? (asteroid.size * 2).toFixed(3) + ' km' : 'N/A')}</p> {/* Ajuste para `size` o `diameterKm` */}
            <p style={{ margin: '5px 0' }}>Velocidad: {asteroid.velocityKms ? asteroid.velocityKms.toFixed(2) + ' km/s' : 'N/A'}</p>
            <p style={{ margin: '5px 0' }}>Fuente: {asteroid.source || 'API'}</p>
            {/* Puedes añadir más detalles aquí si los tienes en el objeto `asteroid` */}
          </>
        ) : (
          <p>Haz clic en un asteroide del listado para ver sus detalles.</p>
        )}
      </div>

      {/* Paneles Inferiores */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '20px',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        {/* Panel Inferior Izquierdo */}
        <div style={{
          flex: 1,
          maxWidth: '300px',
          background: '#3A3F47',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          fontSize: '0.9em',
          pointerEvents: 'auto'
        }}>
          <p style={{ margin: '3px 0' }}>Severidad: {asteroid?.severity || 'N/A'}</p>
          <p style={{ margin: '3px 0' }}>Danger description: {asteroid?.danger_desc || 'N/A'}</p>
          <p style={{ margin: '3px 0' }}>Danger respect the Energy: {asteroid?.severity_con_respecto_a_energya || 'N/A'}</p>
<div
            style={{
              width: '80px',
              height: '40px',
              border: '1px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '8px',
              fontSize: '1.5em',
              borderRadius: '6px',
              transition: 'all 0.5s ease',
              background:
                asteroid?.severity_con_respecto_a_energya === 'Mínima'
                  ? '#4CAF50' // verde
                  : asteroid?.severity_con_respecto_a_energya === 'Significativa'
                  ? '#FFC107' // amarillo
                  : asteroid?.severity_con_respecto_a_energya === 'Severa'
                  ? '#FF9800' // naranja
                  : asteroid?.severity_con_respecto_a_energya === 'Catastrófica'
                  ? '#F44336' // rojo
                  : 'gray',
              boxShadow:
                asteroid?.severity_con_respecto_a_energya === 'Catastrófica'
                  ? '0 0 15px 5px rgba(244,67,54,0.7)'
                  : asteroid?.severity_con_respecto_a_energya === 'Severa'
                  ? '0 0 10px 3px rgba(255,152,0,0.5)'
                  : 'none'
            }}
          >
            {asteroid?.severity_con_respecto_a_energya === 'Mínima' && '🟢'}
            {asteroid?.severity_con_respecto_a_energya === 'Significativa' && '🟡'}
            {asteroid?.severity_con_respecto_a_energya === 'Severa' && '🟠'}
            {asteroid?.severity_con_respecto_a_energya === 'Catastrófica' && '🔴'}
            </div>
        </div>

        {/* Panel Inferior Derecho */}
        <div style={{
          flex: 1,
          maxWidth: '300px',
          background: '#2C2F3A',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2em',
          fontWeight: 'bold',
          textAlign: 'center',
          pointerEvents: 'auto'
        }}>
          {impactDetails.accion}
        </div>
      </div>
    </>
  );
};

export default SimulationOverlay;