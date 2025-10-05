import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = "AIzaSyBipiiU3HACmSxboLPA1infuhXXicWjQUE"; // ⚠️ No dejar en cliente en prod
const SYSTEM_TEXT = `
Recibirás datos clave de un meteorito. A partir exclusivamente de esos datos, responde con dos secciones y en este orden: CONSECUENCIAS y MITIGACIONES. En cada sección escribe exactamente dos viñetas, con oraciones breves, claras y concisas, sin repetir los datos de entrada, sin advertencias legales ni comentarios meta, y sin agregar texto fuera de esas secciones.

En CONSECUENCIAS, describe lo más probable según los datos: si impacta en tierra u océano (onda de choque, daños estructurales, incendios, tsunami, interrupciones de servicios), si explota en la atmósfera (rotura de vidrios, onda de presión, posibles molestias o afectaciones respiratorias por partículas finas), o si se desintegra con efectos irrelevantes. Cuando la información sea incierta o la probabilidad de impacto sea baja, usa lenguaje probabilístico (“probable”, “posible”, “poco probable”). Si los datos indican que el evento es irrelevante, deja claro que no se prevén efectos significativos.

En MITIGACIONES, propone acciones realistas y proporcionales al caso: seguimiento y alertas tempranas, cierres o evacuaciones temporales en zonas de riesgo, desvío mediante impacto cinético o tracción gravitacional; considera opciones de explosión controlada solo si tamaño, composición y ventana temporal lo permiten. Si el evento es irrelevante según los datos, indica que no se requieren acciones. No uses texto en negrita ni formatos especiales; todo debe presentarse en texto plano y limitado a las dos viñetas por sección.`;

export default function DetalleMeteorito() {
  const { id } = useParams();
  const [neo, setNeo] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Estados Gemini ---
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiOutput, setAiOutput] = useState("");

  // --- Instancia única de Gemini con systemInstruction ---
  const genAIRef = useRef(null);
  const modelRef = useRef(null);

  if (!genAIRef.current) {
    genAIRef.current = new GoogleGenerativeAI(GEMINI_API_KEY);
    modelRef.current = genAIRef.current.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    const API_KEY =
      import.meta.env.VITE_NASA_API_KEY ||
      "2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK";
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

  // ----------------- Utils -----------------
  const toNum = (x) => (x == null ? null : Number(x));
  const fmt = (n, d = 3) =>
    n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(d);
  const fmtInt = (n) =>
    n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toLocaleString();

  // Elegir la PRÓXIMA aproximación a la Tierra (o la más cercana disponible si no hay futura)
  const nextEarthCA = useMemo(() => {
    const cad = neo?.close_approach_data ?? [];
    const earth = cad.filter((c) => c.orbiting_body === "Earth");
    if (!earth.length) return null;

    const nowMs = Date.now();
    const withEpoch = earth
      .map((c) => ({
        ...c,
        _epoch: typeof c.epoch_date_close_approach === "number"
          ? c.epoch_date_close_approach
          : null,
      }))
      .filter((c) => c._epoch != null);

    const future = withEpoch.filter((c) => c._epoch >= nowMs);
    const sorted = (arr) => [...arr].sort((a, b) => a._epoch - b._epoch);

    return future.length ? sorted(future)[0] : sorted(withEpoch)[0];
  }, [neo]);

  if (loading)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 text-left text-white/80">
        Cargando…
      </div>
    );
  if (!neo)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 text-left text-white/80">
        No se encontró el meteorito.
      </div>
    );

  // -------- Variables útiles de NEO --------
  const km = neo.estimated_diameter?.kilometers;
  const m = neo.estimated_diameter?.meters;
  const od = neo.orbital_data || {};
  const orbitClass = od.orbit_class?.orbit_class_type || "—";

  const diamMinKm = toNum(km?.estimated_diameter_min);
  const diamMaxKm = toNum(km?.estimated_diameter_max);
  const diamMinM = toNum(m?.estimated_diameter_min);
  const diamMaxM = toNum(m?.estimated_diameter_max);

  const a_AU = toNum(od.semi_major_axis);
  const e = toNum(od.eccentricity);
  const i_deg = toNum(od.inclination);
  const q_AU = toNum(od.perihelion_distance);
  const Q_AU = toNum(od.aphelion_distance);
  const period_d = toNum(od.orbital_period);
  const epoch = od.epoch_osculation ?? "—";
  const moid_AU = toNum(od.minimum_orbit_intersection);
  const U = od.orbit_uncertainty ?? "—";
  const dataArc = od.data_arc_in_days ?? "—";
  const obsUsed = od.observations_used ?? "—";

  const nextCA = nextEarthCA;
  const v_kms = toNum(nextCA?.relative_velocity?.kilometers_per_second);
  const miss_km = toNum(nextCA?.miss_distance?.kilometers);
  const ca_when =
    nextCA?.close_approach_date_full || nextCA?.close_approach_date || "—";

  // --- Hechos para Gemini (datos concisos y útiles) ---
  const buildFactsPrompt = () => {
    const lines = [
      `H: ${neo.absolute_magnitude_h ?? "—"}`,
      `Diametro_min_m: ${fmt(diamMinM, 0)}`,
      `Diametro_max_m: ${fmt(diamMaxM, 0)}`,
      `PHA: ${neo.is_potentially_hazardous_asteroid ? "Sí" : "No"}`,
      `Sentry: ${neo.is_sentry_object ? "Sí" : "No"}`,
      `MOID_AU: ${moid_AU != null ? fmt(moid_AU, 6) : "—"}`,
    ];
    return lines.join("\n");
  };

  const handleGenerarConsecuencias = async () => {
    setAiLoading(true);
    setAiError("");
    setAiOutput("");

    try {
      const facts = buildFactsPrompt();
      const result = await modelRef.current.generateContent(facts);
      const text = result?.response?.text?.() ?? "";
      setAiOutput(text || "Sin respuesta.");
    } catch (err) {
      console.error(err);
      setAiError("Ocurrió un error generando el análisis.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex w-full h-screen ">
  {/* Lateral */}
  <div className="w-[10%] flex items-start justify-start m-4">
    <Link
      to="/listaMeteoritos"
      className="mb-4 inline-block rounded-xl px-3 py-2 border border-white/20 hover:bg-white/10 transition"
    >
      ←
    </Link>
  </div>

  {/* Contenido */}
  <div className="w-[90%] flex items-start justify-start">
    <div>
<h1 className="text-3xl font-semibold text-white">{neo.name}</h1>
<p className="text-white/70">ID: {neo.id}</p>

{neo.nasa_jpl_url && (
  <div className="mt-3 rounded-2xl border border-white/10 p-3">
    <span className="text-white/70 mr-2">Más info:</span>
    <a
      href={neo.nasa_jpl_url}
      target="_blank"
      rel="noreferrer"
      className="text-white underline hover:text-yellow-300 cursor-pointer"
      title="Ver ficha oficial en JPL SBDB"
    >
      Ver en JPL
    </a>
  </div>
)}

      {/* GRID PRINCIPAL */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1️⃣ Características */}
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">Características</h2>
          <ul className="text-white/80 text-sm space-y-1">
            <li>Magnitud absoluta (H): {neo.absolute_magnitude_h ?? "—"}</li>
            <li>Peligroso (PHA): {neo.is_potentially_hazardous_asteroid ? "Sí" : "No"}</li>
            <li>Monitoreo (Sentry): {neo.is_sentry_object ? "Sí" : "No"}</li>
            <li>Diámetro (km): {fmt(diamMinKm)} – {fmt(diamMaxKm)}</li>
            <li>MOID (AU): {moid_AU != null ? fmt(moid_AU, 6) : "—"}</li>
          </ul>
        </div>

        {/* 2️⃣ Próxima aproximación a la Tierra */}
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">
            Próxima aproximación a la Tierra
          </h2>
          {nextCA ? (
            <ul className="text-white/80 text-sm space-y-1">
              <li>Fecha/hora (UTC): {ca_when}</li>
              <li>Velocidad (km/s): {v_kms != null ? fmt(v_kms, 3) : "—"}</li>
              <li>Distancia mínima (km): {miss_km != null ? fmtInt(miss_km) : "—"}</li>
              <li>Cuerpo: {nextCA.orbiting_body}</li>
            </ul>
          ) : (
            <p className="text-white/70 text-sm">
              No hay registros de aproximaciones a la Tierra.
            </p>
          )}
        </div>

        {/* 3️⃣ Órbita */}
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">Órbita</h2>
          <ul className="text-white/80 text-sm space-y-1">
            <li>Clase: {orbitClass}</li>
            <li>a (AU): {a_AU != null ? fmt(a_AU, 6) : "—"}</li>
            <li>e: {e != null ? fmt(e, 6) : "—"}</li>
            <li>i (°): {i_deg != null ? fmt(i_deg, 3) : "—"}</li>
            <li>q (AU): {q_AU != null ? fmt(q_AU, 6) : "—"}</li>
            <li>Q (AU): {Q_AU != null ? fmt(Q_AU, 6) : "—"}</li>
            <li>Periodo (días): {period_d != null ? fmt(period_d, 2) : "—"}</li>
            <li>Época: {epoch}</li>
          </ul>
        </div>

        {/* 4️⃣ Calidad orbital */}
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="text-white font-medium mb-2">Calidad orbital</h2>
          <ul className="text-white/80 text-sm space-y-1">
            <li>Incertidumbre U: {U}</li>
            <li>Arco de datos (días): {dataArc}</li>
            <li>Observaciones usadas: {obsUsed}</li>
          </ul>
        </div>
      </div>

      {/* Gemini */}
      <button
        onClick={handleGenerarConsecuencias}
        disabled={aiLoading}
        className="mt-4 rounded-xl px-4 py-2 
                   border border-white/20 
                   bg-white text-black 
                   hover:bg-yellow-400 hover:border-yellow-400 
                   active:bg-yellow-500
                   cursor-pointer transition-colors duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title="Calcula consecuencias y posibles mitigaciones"
      >
        {aiLoading ? "Generando…" : "Calcula consecuencias y posibles mitigaciones"}
      </button>

      {/* Resultado IA */}
      {aiOutput && (
        <div className="mt-4 mb-6 rounded-2xl border border-white/10 p-4 bg-black/30">
          <pre className="text-white/90 text-sm whitespace-pre-wrap">{aiOutput}</pre>
        </div>
      )}
    </div>
  </div>
</div>

  );
}