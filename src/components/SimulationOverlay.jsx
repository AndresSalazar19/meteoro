import React, { useMemo } from 'react';

const SimulationOverlay = ({
  asteroids = [],
  asteroid,
  onGoBack,
  viewMode,
  setViewMode,
  filterTerm,
  setFilterTerm,
  totalCount,
  filteredCount,
  onSelectAsteroid
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

  const impactDetails = getImpactDetails(asteroid?.severity);

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
    if (energyMt >= 1000) return { key: 'E3_CATASTROPHIC', label: 'Catastrófica' };
    if (energyMt >= 10)   return { key: 'E2_SEVERE',       label: 'Severa' };
    if (energyMt >= 0.1)  return { key: 'E1_SIGNIFICANT',  label: 'Significativa' };
    return { key: 'E0_MINI',        label: 'Mínima' };
  };

  const combineDangerLevel = (severityFlag, energyClassKey) => {
    const isPHA = severityFlag === 'HIGH';
    if (energyClassKey === 'E3_CATASTROPHIC') return { nivel: 'Extremo',  desc: 'Impacto con efectos globales' };
    if (energyClassKey === 'E2_SEVERE')       return { nivel: isPHA ? 'Alto' : 'Moderado', desc: isPHA ? 'Riesgo regional severo' : 'Riesgo regional relevante' };
    if (energyClassKey === 'E1_SIGNIFICANT')  return { nivel: isPHA ? 'Moderado' : 'Bajo',  desc: isPHA ? 'Daños de ciudad probables' : 'Daños de ciudad posibles' };
    return { nivel: 'Bajo', desc: 'Airburst/daños locales menores' };
  };

  const asteroidsEnriquecidos = useMemo(() => {
    return asteroids.map(a => {
      const radiusKm = Number(a.size) || 0;        // 'size' es radio (km)
      const velocityKmS = Number(a.velocity) || 0; // km/s
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
    });
  }, [asteroids]);

  // Estilo base de tarjetas
  const box = {
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '5px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    fontFamily: 'Arial, sans-serif'
  };

  return (
    // Wrapper con posicionamiento relativo SOLO para los overlays.
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: '#000' }}>
      {/* ======== PANEL IZQUIERDO EN FLUJO NORMAL (uno debajo de otro) ======== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Encabezado / navegación */}
        <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onGoBack}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #888',
              color: 'white',
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px'
            }}
          >
            ← 
          </button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Simulación de Meteoritos</h2>
        </div>

        {/* Opciones de visualización */}
        <div style={{ ...box }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Opciones de Visualización</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setViewMode('api'); setFilterTerm(''); }}
              style={{
                backgroundColor: viewMode === 'api' ? '#007bff' : '#555',
                color: 'white', padding: '10px 15px', border: 'none',
                borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em', fontWeight: 'bold'
              }}
            >
              Ver Asteroides API
            </button>
            <button
              onClick={() => { setViewMode('manual'); setFilterTerm(''); }}
              style={{
                backgroundColor: viewMode === 'manual' ? '#007bff' : '#555',
                color: 'white', padding: '10px 15px', border: 'none',
                borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em', fontWeight: 'bold'
              }}
            >
              Ver Asteroides Manuales
            </button>
            <button
              onClick={() => { setViewMode('all'); setFilterTerm(''); }}
              style={{
                backgroundColor: viewMode === 'all' ? '#007bff' : '#555',
                color: 'white', padding: '10px 15px', border: 'none',
                borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em', fontWeight: 'bold'
              }}
            >
              Ver Todos
            </button>
          </div>
        </div>

        {/* Filtros y contadores */}
        <div style={{ ...box }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Filtrar Asteroides</h3>
          <input
            type="text"
            placeholder="Filtrar por nombre..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            style={{
              width: '100%', padding: '10px', boxSizing: 'border-box',
              border: '1px solid #555', borderRadius: '5px', background: '#333', color: 'white',
              fontSize: '0.9em', marginBottom: '8px'
            }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.9em' }}>
            <span>Total de asteroides: {typeof totalCount === 'number' ? totalCount : asteroids.length}</span>
            <span>Asteroides filtrados: {typeof filteredCount === 'number' ? filteredCount : (
              asteroids
                .filter(a => viewMode === 'all' || a.source === viewMode)
                .filter(a => !filterTerm || a.name?.toLowerCase().includes(filterTerm.toLowerCase())).length
            )}</span>
          </div>
        </div>

        {/* Listado (en flujo) */}
        <div style={{ ...box }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Listado (clic para seleccionar)</h3>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #444', borderRadius: '6px' }}>
            {asteroids
              .filter(a => viewMode === 'all' || a.source === viewMode)
              .filter(a => !filterTerm || a.name?.toLowerCase().includes(filterTerm.toLowerCase()))
              .map((a, idx) => (
                <div
                  key={a.name + idx}
                  style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid #444',
                    color: '#ddd',
                    cursor: 'pointer',
                    backgroundColor: asteroid && asteroid.name === a.name ? '#007bff40' : 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                  onClick={() => {
                    const ae = asteroidsEnriquecidos.find(x => x.name === a.name);
                    onSelectAsteroid({ ...a, ...ae });
                  }}
                >
                  <div style={{ fontSize: '0.95em', fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: '0.8em', color: '#bbb' }}>
                    {a.source || 'api'} · a: {a.a?.toFixed?.(2) ?? a.a} AU · d: {a.size ? (a.size * 2).toFixed(3) + ' km' : 'N/A'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ======== OVERLAYS (lo que “estaba a la derecha”, ahora pegado a la IZQUIERDA) ======== */}
      {/* Variables del Asteroide (antes top/right, ahora top/left) */}
      <div
        style={{
          position: 'fixed',
          top: 80,
          left: 20,                  // 👈 espejo de right:20
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          width: 250,
          zIndex: 10,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          fontSize: '1em'
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #555', paddingBottom: '8px' }}>
          Variables del Asteroide
        </h3>
        {asteroid ? (
          <>
            <p style={{ margin: '5px 0' }}>Nombre: {asteroid.name}</p>
            <p style={{ margin: '5px 0' }}>Semieje Mayor (a): {asteroid.a?.toFixed?.(2) ?? 'N/A'} AU</p>
            <p style={{ margin: '5px 0' }}>Excentricidad: {asteroid.e?.toFixed?.(2) ?? 'N/A'}</p>
            <p style={{ margin: '5px 0' }}>Inclinación: {asteroid.i?.toFixed?.(2) ?? 'N/A'} deg</p>
            <p style={{ margin: '5px 0' }}>
              Diámetro: {asteroid.diameterKm
                ? `${asteroid.diameterKm.toFixed(3)} km`
                : (asteroid.size ? `${(asteroid.size * 2).toFixed(3)} km` : 'N/A')}
            </p>
            <p style={{ margin: '5px 0' }}>Velocidad: {asteroid.velocityKms ? `${asteroid.velocityKms.toFixed(2)} km/s` : 'N/A'}</p>
            <p style={{ margin: '5px 0' }}>Fuente: {asteroid.source || 'API'}</p>
          </>
        ) : (
          <p>Haz clic en un asteroide del listado para ver sus detalles.</p>
        )}
      </div>

      {/* Paneles inferiores (se mantienen iguales) */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 20,
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        {/* Inferior Izquierdo */}
        <div
          style={{
            flex: 1,
            maxWidth: 300,
            background: '#3A3F47',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            fontSize: '0.9em',
            pointerEvents: 'auto'
          }}
        >
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
                asteroid?.severity_con_respecto_a_energya === 'Mínima' ? '#4CAF50' :
                asteroid?.severity_con_respecto_a_energya === 'Significativa' ? '#FFC107' :
                asteroid?.severity_con_respecto_a_energya === 'Severa' ? '#FF9800' :
                asteroid?.severity_con_respecto_a_energya === 'Catastrófica' ? '#F44336' : 'gray',
              boxShadow:
                asteroid?.severity_con_respecto_a_energya === 'Catastrófica'
                  ? '0 0 15px 5px rgba(244,67,54,0.7)'
                  : (asteroid?.severity_con_respecto_a_energya === 'Severa'
                      ? '0 0 10px 3px rgba(255,152,0,0.5)'
                      : 'none')
            }}
          >
            {asteroid?.severity_con_respecto_a_energya === 'Mínima' && '🟢'}
            {asteroid?.severity_con_respecto_a_energya === 'Significativa' && '🟡'}
            {asteroid?.severity_con_respecto_a_energya === 'Severa' && '🟠'}
            {asteroid?.severity_con_respecto_a_energya === 'Catastrófica' && '🔴'}
          </div>
        </div>


      </div>
    </div>
  );
};

export default SimulationOverlay;
