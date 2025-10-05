import React, { useState } from 'react';

const WhatIfForm = ({ onSimulate, onViewStateChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    semiMajorAxis: '1.5',
    eccentricity: '0.1',
    inclination: '10',
    diamMin: '0.1',
    diamMax: '0.2',
    velocity: '15'
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Calcular el diámetro promedio y radio igual que la API de NASA
    const dMin = parseFloat(formData.diamMin) || 0;
    const dMax = parseFloat(formData.diamMax) || dMin || 0;
    const avgDiameterKm = (dMin + dMax) / 2;
    const radiusKm = avgDiameterKm / 2;

    const simulationData = {
      name: formData.name || `Manual-${Date.now().toString().slice(-4)}`,
      a: parseFloat(formData.semiMajorAxis) || 1,
      e: parseFloat(formData.eccentricity) || 0,
      i: parseFloat(formData.inclination) || 0,
      diamMinKm: dMin,
      diamMaxKm: dMax,
      velocityKms: parseFloat(formData.velocity)
    };

    onSimulate(simulationData);
    onViewStateChange('simulation');
  };

  return (
    <div style={{
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 20,
      overflowY: 'auto',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3em', marginBottom: '10px', color: 'white', letterSpacing: '2px' }}>
        WHAT IF ?
      </h1>
      <p style={{ fontSize: '1.2em', marginBottom: '5px', color: '#ccc' }}>
        Simula escenarios de impacto de asteroides
      </p>
      <p style={{ fontSize: '1.2em', marginBottom: '30px', color: '#ccc' }}>
        Configura los parámetros orbitales y físicos del asteroide
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px 40px',
        marginBottom: '40px',
        width: '80%',
        maxWidth: '900px'
      }}>
        {/* Nombre del Asteroide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#4CAF50', fontWeight: 'bold' }}>
            Nombre del Asteroide
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Ej: Apophis"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Nombre identificador del asteroide
          </span>
        </div>

        {/* Semieje Mayor (a) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#4CAF50', fontWeight: 'bold' }}>
            Semieje Mayor (AU)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.semiMajorAxis}
            onChange={(e) => handleChange('semiMajorAxis', e.target.value)}
            placeholder="1.5"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Distancia promedio al Sol (1 AU = Tierra)
          </span>
        </div>

        {/* Excentricidad (e) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#4CAF50', fontWeight: 'bold' }}>
            Excentricidad
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="0.99"
            value={formData.eccentricity}
            onChange={(e) => handleChange('eccentricity', e.target.value)}
            placeholder="0.1"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Forma de la órbita (0 = circular, 0.99 = muy elíptica)
          </span>
        </div>

        {/* Inclinación (i) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#4CAF50', fontWeight: 'bold' }}>
            Inclinación (grados)
          </label>
          <input
            type="number"
            step="1"
            value={formData.inclination}
            onChange={(e) => handleChange('inclination', e.target.value)}
            placeholder="10"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Ángulo de inclinación orbital respecto al plano de la Tierra
          </span>
        </div>

        {/* Diámetro Mínimo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#FF9800', fontWeight: 'bold' }}>
            Diámetro Mínimo (km)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.diamMin}
            onChange={(e) => handleChange('diamMin', e.target.value)}
            placeholder="0.1"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Estimación inferior del tamaño
          </span>
        </div>

        {/* Diámetro Máximo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#FF9800', fontWeight: 'bold' }}>
            Diámetro Máximo (km)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.diamMax}
            onChange={(e) => handleChange('diamMax', e.target.value)}
            placeholder="0.2"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Estimación superior del tamaño
          </span>
        </div>

        {/* Velocidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '1.1em', color: '#2196F3', fontWeight: 'bold' }}>
            Velocidad (km/s)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.velocity}
            onChange={(e) => handleChange('velocity', e.target.value)}
            placeholder="15"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Velocidad orbital promedio
          </span>
        </div>

        {/* Info calculada */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(76, 175, 80, 0.1)',
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid rgba(76, 175, 80, 0.3)'
        }}>
          <label style={{ fontSize: '1.1em', color: '#4CAF50', fontWeight: 'bold' }}>
            Cálculos Automáticos
          </label>
          <div style={{ fontSize: '0.9em', color: '#ccc' }}>
            <p style={{ margin: '5px 0' }}>
              Diámetro Promedio: {((parseFloat(formData.diamMin) + parseFloat(formData.diamMax)) / 2 || 0).toFixed(3)} km
            </p>
            <p style={{ margin: '5px 0' }}>
              Radio: {(((parseFloat(formData.diamMin) + parseFloat(formData.diamMax)) / 2) / 2 || 0).toFixed(3)} km
            </p>
          </div>
          <span style={{ fontSize: '0.85em', color: '#888' }}>
            Calculado automáticamente igual que NASA API
          </span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        style={{
          backgroundColor: '#FF0000',
          color: 'white',
          padding: '15px 40px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1.5em',
          fontWeight: 'bold',
          boxShadow: '0 0 15px rgba(255,0,0,0.6)',
          transition: 'background-color 0.3s, box-shadow 0.3s',
          marginBottom: '40px'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#CC0000';
          e.target.style.boxShadow = '0 0 25px rgba(255,0,0,0.8)';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = '#FF0000';
          e.target.style.boxShadow = '0 0 15px rgba(255,0,0,0.6)';
        }}
      >
        SIMULAR IMPACTO
      </button>
    </div>
  );
};

export default WhatIfForm;