import { Routes, Route } from "react-router-dom";
import Asteorid3Dviewer from "../components/Asteroid3DViewer";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/home";
import Simulaciones from "../pages/simulaciones";
import ListaMeteoritos from "../pages/listaMeteoritos";
import DetalleMeteorito from "../pages/detalleMeteorito";

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
      {/* Lista de meteoritos */}
      <Route
        path="/listaMeteoritos"
        element={
          <MainLayout>
            <ListaMeteoritos />
          </MainLayout>
        }
      />

      {/* Detalle por id */}
      <Route
        path="/meteoritos/:id"
        element={
          <MainLayout>
            <DetalleMeteorito />
          </MainLayout>
        }
      />
      
    </Routes>
  );
}
