import React from 'react';

const SimulationOverlay = ({ 
  asteroids = [],
  asteroid, 
  onGoBack, 
  viewMode, 
  setViewMode, 
  filterTerm, 
  setFilterTerm, 
  totalCount, 
  filteredCount 
}) => {
  const getImpactDetails = (severity) => {
    switch (severity) {
      case 'LOW':
        return { prob: '1%',  turin: '0', riesgo: 'Bajo',  accion: 'Seguro' };
      case 'MEDIUM':
        return { prob: '55%', turin: '5', riesgo: 'Medio', accion: 'Peligro. Correr.' };
      case 'HIGH':
        return { prob: '90%', turin: '8', riesgo: 'Alto',  accion: 'Impacto Inminente!' };
      default:
        return { prob: 'N/A', turin: 'N/A', riesgo: 'Desconocido', accion: 'Información no disponible' };
    }
  };

  // Evita leer "severity" de null/undefined
  const impactDetails = getImpactDetails(asteroid?.severity);

  // Contadores derivados si no vienen de props
  const derivedFilteredCount = asteroids
    .filter(a => viewMode === 'all' || a.source === viewMode)
    .filter(a => !filterTerm || a.name?.toLowerCase().includes(filterTerm.toLowerCase())).length;

  // Estilos base
  const box = {
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '5px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    fontFamily: 'Arial, sans-serif',
  };

  return (
  <div
    style={{
      height: '100%',          // 👈 antes 100vh
      width: '100%',
      minHeight: 0,            // 👈 permite encoger en flex y evita overflow
      overflowY: 'auto',       // 👈 antes 'scroll'
      background: '#000',
      padding: '5px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    }}
  >
      {/* Encabezado / navegación */}
      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onGoBack}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #888',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: '6px',
          }}
        >
          ← Volver
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
          Simulación de Asteroides
        </h2>
      </div>

      {/* Opciones de visualización */}
      <div style={{ ...box }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>Opciones de Visualización</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
      </div>

      {/* Filtros y contadores */}
      <div style={{ ...box }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>Filtrar Asteroides</h3>
        <input
          type="text"
          placeholder="Filtrar por nombre..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          style={{
            width: '100%', padding: '10px', boxSizing: 'border-box',
            border: '1px solid #555', borderRadius: '5px', background: '#333', color: 'white',
            fontSize: '0.9em', marginBottom: '5px'
          }}
        />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.9em' }}>
          <span>Total de asteroides: {typeof totalCount === 'number' ? totalCount : asteroids.length}</span>
          <span>Asteroides filtrados: {typeof filteredCount === 'number' ? filteredCount : derivedFilteredCount}</span>
        </div>
      </div>

      {/* Listado */}
      <div style={{ ...box }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Listado (solo lectura)</h3>
        <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #444', borderRadius: '6px' }}>
          {asteroids
            .filter(a => viewMode === 'all' || a.source === viewMode)
            .filter(a => !filterTerm || a.name?.toLowerCase().includes(filterTerm.toLowerCase()))
            .map((a, idx) => (
              <div key={a.name + idx} style={{ padding: '8px 10px', borderBottom: '1px solid #444', color: '#ddd' }}>
                <div style={{ fontSize: '0.95em', fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: '0.8em', color: '#bbb' }}>
                  {a.source || 'api'} · a: {a.a?.toFixed?.(2) ?? a.a} AU · d: {a.size ? (a.size * 2).toFixed(3) + ' km' : 'N/A'}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Variables del asteroide seleccionado */}
      <div style={{ ...box }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Variables del Asteroide</h3>
        {asteroid ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            <p style={{ margin: 0 }}>Nombre: {asteroid.name}</p>
            <p style={{ margin: 0 }}>a: {asteroid.a?.toFixed?.(2) ?? 'N/A'} AU</p>
            <p style={{ margin: 0 }}>e: {asteroid.e?.toFixed?.(2) ?? 'N/A'}</p>
            <p style={{ margin: 0 }}>i: {asteroid.i?.toFixed?.(2) ?? 'N/A'}°</p>
            <p style={{ margin: 0 }}>
              Diámetro: {asteroid.diameterKm ? `${asteroid.diameterKm.toFixed(3)} km` : (asteroid.size ? `${(asteroid.size * 2).toFixed(3)} km` : 'N/A')}
            </p>
            <p style={{ margin: 0 }}>
              Velocidad: {asteroid.velocityKms ? `${asteroid.velocityKms.toFixed(2)} km/s` : (asteroid.velocity ? `${asteroid.velocity.toFixed?.(2) ?? asteroid.velocity} km/s` : 'N/A')}
            </p>
            <p style={{ margin: 0 }}>Severidad: {asteroid.severity ?? 'N/A'}</p>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No hay asteroide seleccionado.</p>
        )}
      </div>

      {/* Indicadores de riesgo y acción (antes estaban “abajo a la izquierda/derecha”) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ ...box, background: '#3A3F47' }}>
          <p style={{ margin: '3px 0' }}>Prob. de impacto: {impactDetails.prob}</p>
          <p style={{ margin: '3px 0' }}>Escala de Turín: {impactDetails.turin}</p>
          <p style={{ margin: '3px 0' }}>Riesgo: {impactDetails.riesgo}</p>
          <div style={{
            width: '100px',
            height: '50px',
            border: '1px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '8px',
            fontSize: '0.9em',
            background: `conic-gradient(#4CAF50 ${parseInt(impactDetails.turin) * 10}%, #FFC107 ${parseInt(impactDetails.turin) * 10}% ${parseInt(impactDetails.turin) * 20}%, #FF0000 ${parseInt(impactDetails.turin) * 20}%)`
          }}>
            {impactDetails.riesgo === 'Bajo' && '🟢'}
            {impactDetails.riesgo === 'Medio' && '🟠'}
            {impactDetails.riesgo === 'Alto'  && '🔴'}
            {impactDetails.riesgo === 'Desconocido' && '❔'}
          </div>
        </div>

        <div style={{ ...box, background: '#2C2F3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1em', fontWeight: 'bold', textAlign: 'center' }}>
          {impactDetails.accion}
        </div>
      </div>

      {/* Separador final para respirar */}
      <div style={{ height: 8 }} />
    </div>
  );
};

export default SimulationOverlay;
