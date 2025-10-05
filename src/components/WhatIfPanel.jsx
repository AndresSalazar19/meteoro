import React, { useState } from 'react';

const WhatIfForm = ({ onSimulate, onViewStateChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    semiMajorAxis: '1.5',
    eccentricity: '0.1',
    inclination: '10',
    diamMin: '0.1',
    diamMax: '0.2',
    absoluteMagnitude: '20',
    velocity: '15',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const simulationData = {
      name: formData.name || `Manual-${Date.now().toString().slice(-4)}`,
      a: parseFloat(formData.semiMajorAxis) || 1,
      e: parseFloat(formData.eccentricity) || 0,
      i: parseFloat(formData.inclination) || 0,
      // Pasa diamMinKm y diamMaxKm, que se usarán en Asteroid3DViewer
      diamMinKm: parseFloat(formData.diamMin),
      diamMaxKm: parseFloat(formData.diamMax),
      H: parseFloat(formData.absoluteMagnitude),
      velocityKms: parseFloat(formData.velocity)
    };

    // Llama al callback de simulación pasando todos los datos
    onSimulate(simulationData);
    
    // Cambia el estado de vista a 'simulation'
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
        Simula escenarios en segundos
      </p>
      <p style={{ fontSize: '1.2em', marginBottom: '30px', color: '#ccc' }}>
        Cambia las variables y mira el impacto en tiempo real.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px 40px',
        marginBottom: '40px',
        width: '80%',
        maxWidth: '800px'
      }}>
        {/* Variable 1: Nombre */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 1:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Nombre"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 2: Semieje Mayor */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 2:</label>
          <input
            type="number"
            step="0.1"
            value={formData.semiMajorAxis}
            onChange={(e) => handleChange('semiMajorAxis', e.target.value)}
            placeholder="1.5"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 3: Excentricidad */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 3:</label>
          <input
            type="number"
            step="0.01"
            value={formData.eccentricity}
            onChange={(e) => handleChange('eccentricity', e.target.value)}
            placeholder="0.1"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 4: Inclinación */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 4:</label>
          <input
            type="number"
            step="1"
            value={formData.inclination}
            onChange={(e) => handleChange('inclination', e.target.value)}
            placeholder="10"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 5: Diámetro Mínimo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 5:</label>
          <input
            type="number"
            step="0.01"
            value={formData.diamMin}
            onChange={(e) => handleChange('diamMin', e.target.value)}
            placeholder="0.1"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 6: Diámetro Máximo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 6:</label>
          <input
            type="number"
            step="0.01"
            value={formData.diamMax}
            onChange={(e) => handleChange('diamMax', e.target.value)}
            placeholder="0.2"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 7: Magnitud Absoluta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 7:</label>
          <input
            type="number"
            step="0.1"
            value={formData.absoluteMagnitude}
            onChange={(e) => handleChange('absoluteMagnitude', e.target.value)}
            placeholder="20"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
        </div>

        {/* Variable 8: Velocidad */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '1.1em', minWidth: '120px' }}>Variable 8:</label>
          <input
            type="number"
            step="0.1"
            value={formData.velocity}
            onChange={(e) => handleChange('velocity', e.target.value)}
            placeholder="15"
            style={{
              width: 'calc(100% - 130px)',
              padding: '8px',
              border: '1px solid #555',
              borderRadius: '5px',
              background: '#333',
              color: 'white',
              fontSize: '1em'
            }}
          />
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
      >
        SIMULAR
      </button>
    </div>
  );
};

export default WhatIfForm;