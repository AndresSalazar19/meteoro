import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function ListaMeteoritos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [hazardFilter, setHazardFilter] = useState("all");  {/*PARA LOS FILTROS */}
  
  useEffect(() => {
    const controller = new AbortController();
    const API_KEY = import.meta.env.VITE_NASA_API_KEY || '2KzpzDksQWT2D2csD9Ja9wrdX8ruTcS290hH2mBK';
    const FEED_URL = `https://api.nasa.gov/neo/rest/v1/feed?start_date=2032-12-19&end_date=2032-12-26&api_key=${API_KEY}`;

    (async () => {
      try {
        const res = await fetch(FEED_URL, { signal: controller.signal });
        if (!res.ok) throw new Error("Error al obtener feed NEO");
        const feed = await res.json();

        const byDate = feed.near_earth_objects || {};
        const neoList = [];
        Object.values(byDate).forEach(arr => { if (Array.isArray(arr)) neoList.push(...arr); });

        // De-dup por id y mapeo de campos para la lista
        const map = new Map();
        for (const n of neoList) {
          if (!map.has(n.id)) {
            const cad0 = n.close_approach_data?.[0];
            map.set(n.id, {
              id: n.id,
              name: n.name || n.designation || "NEO",
              hazardous: !!n.is_potentially_hazardous_asteroid,
              diameterKmMin: n.estimated_diameter?.kilometers?.estimated_diameter_min ?? null,
              diameterKmMax: n.estimated_diameter?.kilometers?.estimated_diameter_max ?? null,
              approachDate: cad0?.close_approach_date_full || cad0?.close_approach_date || "—",
              missDistanceKm: cad0?.miss_distance?.kilometers ? Number(cad0.miss_distance.kilometers) : null,
              velocityKmS: cad0?.relative_velocity?.kilometers_per_second ? Number(cad0.relative_velocity.kilometers_per_second) : null,
            });
          }
        }
        setItems(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    let arr = items;

    // filtro de búsqueda
    if (q.trim()) {
      const qq = q.toLowerCase();
      arr = arr.filter(it => it.name.toLowerCase().includes(qq));
    }

    // filtro por peligrosidad
    if (hazardFilter === "yes") arr = arr.filter(it => it.hazardous);
    if (hazardFilter === "no") arr = arr.filter(it => !it.hazardous);

    return arr;
  }, [items, q, hazardFilter]);

  return (
    <div className="flex w-full h-screen">
      <div className="w-[10%] flex items-start justify-start m-4">
        <Link to="/" className="mb-4 inline-block rounded-xl px-3 py-2 border border-white/20 hover:bg-white/10 transition" >
          ←
        </Link>  
      </div>
      <div className="w-[90%] flex items-start justify-start">
        <div>
          <h1 className="text-3xl font-semibold text-white">Lista de Meteoritos</h1>
          <p className="text-white/80">Todos los meteoritos en un solo lugar. Busca, filtra y elige el que quieras.</p>

          {/* Buscador simple */}
          <div className="mt-4 flex gap-4">
            {/* Buscador */}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre..."
              className="flex-1 rounded-xl px-3 py-2 bg-white/10 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30"
            />

            {/* Filtro por peligrosidad */}
            <select
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              className="rounded-xl px-3 py-2 bg-gray-800 text-white outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="all" className="bg-gray-800 text-white">Todos</option>
              <option value="yes" className="bg-gray-800 text-white">Peligrosos</option>
              <option value="no" className="bg-gray-800 text-white">No peligrosos</option>
            </select>
          </div>

          {loading ? (
            <p className="mt-6 text-white/70">Cargando…</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {filtered.map(it => (
                <li key={it.id} className="rounded-2xl border border-white/10 p-4 hover:bg-white/5 transition">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl text-white font-medium">{it.name}</h3>
                      <p className="text-white/70 text-sm">
                        {it.approachDate !== "—" ? `Aproximación: ${it.approachDate} · ` : ""}
                        Diámetro: {it.diameterKmMin?.toFixed?.(3) ?? "?"}–{it.diameterKmMax?.toFixed?.(3) ?? "?"} km
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${it.hazardous ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-200"}`}>
                        {it.hazardous ? "Peligroso" : "No peligroso"}
                      </span>
                      {/* Link al detalle por id */}
                      <Link
                        to={`/meteoritos/${it.id}`}
                        className="text-sm underline hover:opacity-80"
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && <li className="text-white/70">Sin resultados.</li>}
            </ul>
          )}
        </div>

    </div>
    </div>
  );
}
