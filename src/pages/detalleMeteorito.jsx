import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom"; // Importa useNavigate

export default function DetalleMeteorito() {
  const { id } = useParams();
  const navigate = useNavigate(); // Inicializa el hook de navegación
  const [neo, setNeo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const controller = new AbortController();
    const API_KEY = import.meta.env.VITE_NASA_API_KEY || '2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK';
    const LOOKUP_URL = `https://api.nasa.gov/neo/rest/v1/neo/${id}?api_key=${API_KEY}`;

    (async () => {
      try {
        const r = await fetch(LOOKUP_URL, { signal: controller.signal });
        if (!r.ok) throw new Error("Error al obtener detalle NEO");
        const data = await r.json();
        setNeo(data);
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [id]);

  // Función para manejar el clic en el botón "Simular"
  const handleSimulateClick = () => {
    if (!neo) return;

    const od = neo.orbital_data || {};
    const km = neo.estimated_diameter?.kilometers;

    // Prepara los datos del asteroide en un formato que Asteroid3DViewer pueda procesar
    const asteroidDataForSimulation = {
      name: neo.name || neo.designation || 'NEO from API',
      a: parseFloat(od.semi_major_axis) || 1, // AU
      e: parseFloat(od.eccentricity) || 0,
      i: parseFloat(od.inclination) || 0, // degrees
      diamMinKm: km?.estimated_diameter_min,
      diamMaxKm: km?.estimated_diameter_max,
      H: neo.absolute_magnitude_h,
      closeApproachData: neo.close_approach_data || [], // Pasa el array completo para el cálculo de velocidad
    };

    // Navega a la ruta de simulación, pasando los datos a través del estado
    navigate('/meteoritos', { state: { simulatedAsteroidData: asteroidDataForSimulation } });
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-6 text-left text-white/80">Cargando…</div>;
  if (!neo) return <div className="max-w-3xl mx-auto px-4 py-6 text-left text-white/80">No se encontró el meteorito.</div>;

  const km = neo.estimated_diameter?.kilometers;
  const od = neo.orbital_data || {};
  const cad0 = neo.close_approach_data?.[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-left">
      <div className="flex items-center justify-between mb-6">
        <Link
        to="/listaMeteoritos"
        className="mb-4 inline-block rounded-xl px-3 py-2 border border-white/20 hover:bg-white/10 transition"
      >
        ← Volver a la lista
      </Link>
      <button
          onClick={handleSimulateClick}
          className="bg-green-600 text-white px-5 py-2 rounded-xl hover:bg-green-700 transition"
        >
          Simular
        </button>
      </div>
      

      <h1 className="text-3xl font-semibold text-white">{neo.name}</h1>
      <p className="text-white/70">ID: {neo.id}</p>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">Características</h2>
          <ul className="text-white/80 text-sm space-y-1">
            <li>Magnitud absoluta (H): {neo.absolute_magnitude_h ?? "—"}</li>
            <li>Peligroso: {neo.is_potentially_hazardous_asteroid ? "Sí" : "No"}</li>
            <li>Diámetro (km): {km?.estimated_diameter_min?.toFixed?.(3) ?? "?"} – {km?.estimated_diameter_max?.toFixed?.(3) ?? "?"}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">Órbita (orbital_data)</h2>
          <ul className="text-white/80 text-sm space-y-1">
            <li>a (UA): {od.semi_major_axis ?? "—"}</li>
            <li>e: {od.eccentricity ?? "—"}</li>
            <li>i (°): {od.inclination ?? "—"}</li>
            <li>Periodo (días): {od.orbital_period ?? "—"}</li>
            <li>Perihelio (UA): {od.perihelion_distance ?? "—"}</li>
            <li>Afelio (UA): {od.aphelion_distance ?? "—"}</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 p-4 ">
        <h2 className="text-white font-medium mb-2">Próxima aproximación (si disponible)</h2>
        {cad0 ? (
          <ul className="text-white/80 text-sm space-y-1">
            <li>Fecha: {cad0.close_approach_date_full || cad0.close_approach_date}</li>
            <li>Velocidad (km/s): {Number(cad0.relative_velocity?.kilometers_per_second || 0).toFixed(3)}</li>
            <li>Distancia mínima (km): {Number(cad0.miss_distance?.kilometers || 0).toLocaleString()}</li>
            <li>Cuerpo: {cad0.orbiting_body}</li>
          </ul>
        ) : (
          <p className="text-white/70 text-sm">No hay registros inmediatos en el feed consultado.</p>
        )}
      </div>

        </div>
  );
}