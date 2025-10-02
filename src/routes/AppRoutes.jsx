import { Routes, Route } from "react-router-dom";
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/home";
import Simulaciones from "../pages/simulaciones";
import Informacion from "../pages/informacion";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
            <Home />
        
        }
      />
      <Route
        path="/meteoritos"
        element={
          <MainLayout>
            <Asteorid3Dviewer />
          </MainLayout>
        }
      />
        <Route
        path="/simulaciones"
        element={
          <MainLayout>
            <Simulaciones />
          </MainLayout>
        }
      />
        <Route
        path="/informacion"
        element={
          <MainLayout>
            <Informacion />
          </MainLayout>
        }
      />
      
    </Routes>
  );
}
