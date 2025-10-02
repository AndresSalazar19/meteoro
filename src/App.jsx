import React from 'react';
import Asteroid3DViewer from './components/Asteroid3DViewer';
import AppRoutes from './routes/appRoutes';
import { BrowserRouter } from 'react-router-dom';

function App() {
  
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
