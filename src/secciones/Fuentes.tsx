import { useEffect, useMemo, useState } from "react";
import CabeceraSeccion from "../componentes/CabeceraSeccion";
import { useFuentes } from "../componentes/contexto";
import { type CampoDiccionario, cargar, type EstadoSitio, type Fuente } from "../datos";
import { useParametro } from "../rutas";

const ESTADOS: EstadoSitio[] = ["En el sitio", "Solo en el lago", "No integrada", "Descartada"];
const RESUMEN: Record<EstadoSitio, string> = {
  "En el sitio": "en el sitio",
  "Solo en el lago": "solo en el lago",
  "No integrada": "no integradas",
  Descartada: "descartadas",
};
const CLASE_ESTADO: Record<EstadoSitio, string> = {
  "En el sitio": "integrada",
  "Solo en el lago": "lago",
  "No integrada": "candidata",
  Descartada: "descartada",
};

export default function Fuentes() {
  const fuentes = useFuentes();
  const [diccionario, setDiccionario] = useState<CampoDiccionario[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  // El estado elegido vive en la URL (#fuentes?estado=No integrada), como los filtros de las demás secciones.
  const [estadoUrl, setEstado] = useParametro("estado");
  const estado = ESTADOS.find((e) => e === estadoUrl) ?? null;

  useEffect(() => {
    cargar<CampoDiccionario[]>("catalogo/diccionario.json").then(setDiccionario);
  }, []);

  const lista = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    return Object.values(fuentes).filter(
      (f) =>
        (!estado || f.estado_sitio === estado) &&
        (!t || `${f.fuente_id} ${f.nombre} ${f.entidad} ${f.estado_sitio}`.toLowerCase().includes(t)),
    );
  }, [fuentes, filtro, estado]);

  const conteo = (estado: EstadoSitio) => Object.values(fuentes).filter((f) => f.estado_sitio === estado).length;

  return (
    <section className="seccion">
      <CabeceraSeccion seccion="fuentes" titulo="De dónde sale cada cifra">
        <p className="entrada">
          Generado desde el Excel del lago (hojas Fuentes y Diccionario). El estado de cada fuente sale de lo que el
          sitio publica de verdad. Los campos clasificados como «Sensible» no se publican, o se publican solo como
          porcentaje.
        </p>
      </CabeceraSeccion>

      <fieldset className="resumen-estados">
        <legend className="solo-lector">Filtrar por estado</legend>
        <button type="button" aria-pressed={!estado} onClick={() => setEstado(null)}>
          {Object.keys(fuentes).length} fuentes
        </button>
        {ESTADOS.map((e) => (
          <button key={e} type="button" aria-pressed={estado === e} onClick={() => setEstado(estado === e ? null : e)}>
            {conteo(e)} {RESUMEN[e]}
          </button>
        ))}
      </fieldset>

      <div className="filtros">
        <label>
          Buscar
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="ID, nombre o entidad"
          />
        </label>
      </div>

      <div className="tabla-scroll">
        <table className="tabla-fuentes">
          <thead>
            <tr>
              <th>ID</th>
              <th>Conjunto de datos</th>
              <th>Entidad</th>
              <th>Periodo</th>
              <th>Licencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <FilaFuente
                key={f.fuente_id}
                fuente={f}
                campos={diccionario.filter((c) => c.fuente_id === f.fuente_id)}
                abierta={abierta === f.fuente_id}
                alternar={() => setAbierta((a) => (a === f.fuente_id ? null : f.fuente_id))}
              />
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="subtitulo">Método</h2>
      <ul className="metodo">
        <li>Todo se procesa antes, en Python; el sitio solo sirve archivos estáticos.</li>
        <li>Se mide en EPSG:31983 (SIRGAS2000 UTM 23S, metros) y se publica en EPSG:4326.</li>
        <li>
          Los nombres de distrito y subprefeitura se unen por una tabla de equivalencias construida desde las capas de
          GeoSampa; si una unidad no encuentra pareja, la verificación falla.
        </li>
        <li>Las filas «inválidos» y «no localizados» se conservan en el lago y se excluyen de mapas y rankings.</li>
      </ul>
    </section>
  );
}

function FilaFuente({
  fuente,
  campos,
  abierta,
  alternar,
}: {
  fuente: Fuente;
  campos: CampoDiccionario[];
  abierta: boolean;
  alternar: () => void;
}) {
  return (
    <>
      <tr>
        <td>
          <button type="button" className="enlace" onClick={alternar} aria-expanded={abierta} disabled={!campos.length}>
            {fuente.fuente_id}
          </button>
        </td>
        <td>
          {fuente.url ? (
            <a href={fuente.url} target="_blank" rel="noreferrer">
              {fuente.nombre}
            </a>
          ) : (
            fuente.nombre
          )}
        </td>
        <td>{fuente.entidad}</td>
        <td>{fuente.periodo}</td>
        <td className="licencia">{fuente.licencia}</td>
        <td>
          <span className={`etiqueta estado-${CLASE_ESTADO[fuente.estado_sitio] ?? "candidata"}`}>
            {fuente.estado_sitio}
          </span>
          {fuente.motivo && <p className="motivo">{fuente.motivo}</p>}
        </td>
      </tr>
      {abierta && (
        <tr className="fila-detalle">
          <td colSpan={6}>
            <table>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Qué significa</th>
                  <th>Unidad</th>
                  <th>Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {campos.map((c) => (
                  <tr key={c.campo}>
                    <td>
                      <code>{c.campo}</code>
                    </td>
                    <td>{c.significado}</td>
                    <td>{c.unidad}</td>
                    <td>
                      {c.clasificacion === "Sensible" ? (
                        <span className="etiqueta sensible">Sensible</span>
                      ) : (
                        c.clasificacion
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
