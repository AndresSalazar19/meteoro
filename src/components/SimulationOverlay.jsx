import React from 'react';

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

        {/* Listado rápido de asteroides filtrados */}
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
                onClick={() => onSelectAsteroid(a)} // <--- Manejador de clic
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
          <p style={{ margin: '3px 0' }}>Prob. de impacto: {impactDetails.prob}</p>
          <p style={{ margin: '3px 0' }}>Escala de Turín: {impactDetails.turin}</p>
          <p style={{ margin: '3px 0' }}>Riesgo: {impactDetails.riesgo}</p>
          <div style={{
            width: '80px',
            height: '40px',
            border: '1px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '8px',
            fontSize: '0.7em',
            background: `conic-gradient(#4CAF50 ${parseInt(impactDetails.turin) * 10}%, #FFC107 ${parseInt(impactDetails.turin) * 10}% ${parseInt(impactDetails.turin) * 20}%, #FF0000 ${parseInt(impactDetails.turin) * 20}%)`
          }}>
            {impactDetails.riesgo === 'Bajo' && '🟢'}
            {impactDetails.riesgo === 'Medio' && '🟠'}
            {impactDetails.riesgo === 'Alto' && '🔴'}
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