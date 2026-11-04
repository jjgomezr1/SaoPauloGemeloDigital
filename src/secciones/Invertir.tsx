import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CabeceraSeccion from "../componentes/CabeceraSeccion";
import ConcentracionDistritos from "../componentes/ConcentracionDistritos";
import Estaciones, { type Capitulo, SeccionCapitulo } from "../componentes/Estaciones";
import { ANIMACION, EJE, ESTILO_TOOLTIP, SERIE_1 } from "../componentes/graficos";
import MapaDistritos from "../componentes/MapaDistritos";
import { NotaMetodo } from "../componentes/notas";
import RankingDistritos from "../componentes/RankingDistritos";
import SelectorAnio from "../componentes/SelectorAnio";
import TarjetaIndicador from "../componentes/TarjetaIndicador";
import {
  type ArchivoIndicadores,
  cargar,
  claveIndicador,
  formatear,
  formatearCorto,
  type Indicador,
  type IndiceSeccion,
  metricaPorTerritorio,
} from "../datos";
import { useParametro } from "../rutas";

// «anios» limita los años: el empleo por sexo existe desde 2022 y por raza o color desde 2023.
// «municipal» indica si el municipio tiene la cifra (la participación y la densidad no).
const METRICAS: { clave: string; etiqueta: string; anios?: string[]; municipal: boolean }[] = [
  { clave: "empleos_formales", etiqueta: "Empleos formales", municipal: true },
  { clave: "empleos_formales_participacion", etiqueta: "Participación en el municipio", municipal: false },
  { clave: "empleos_formales_por_km2", etiqueta: "Empleos por km²", municipal: false },
  { clave: "establecimientos_formales", etiqueta: "Establecimientos formales", municipal: true },
  {
    clave: "empleos_femenino_pct",
    etiqueta: "Empleos ocupados por mujeres",
    anios: ["2022", "2023", "2024"],
    municipal: true,
  },
];

const CAPITULOS: Capitulo[] = [
  { id: "invertir-perfil", titulo: "Tu negocio" },
  { id: "invertir-empleo", titulo: "El trabajo" },
  { id: "invertir-evolucion", titulo: "Evolución" },
];

// Los dos perfiles de build_web.py (PERFILES_NEGOCIO). «componentes» son las cifras que entran en el índice, con
// el archivo del que salen; las de más abajo en la lista se leen al revés (menos competencia, más puntos).
type Perfil = "barrio" | "trabajadores";
const PERFILES: Record<
  Perfil,
  { titulo: string; ejemplo: string; indice: string; componentes: { clave: string; titulo: string }[] }
> = {
  barrio: {
    titulo: "Negocio de barrio",
    ejemplo: "Panadería, farmacia, gimnasio, peluquería: vive de la gente que vive cerca.",
    indice: "indice_barrio",
    componentes: [
      { clave: "poblacion", titulo: "Población" },
      { clave: "densidad", titulo: "Densidad" },
      { clave: "establecimientos_por_mil_hab", titulo: "Competencia: establecimientos por mil habitantes" },
      { clave: "cobertura_poblacion", titulo: "Población cerca de bus o metro" },
    ],
  },
  trabajadores: {
    titulo: "Negocio para trabajadores",
    ejemplo: "Restaurante de almuerzo, café, papelería, servicios a empresas: vive de la gente que llega a trabajar.",
    indice: "indice_trabajadores",
    componentes: [
      { clave: "empleos_formales", titulo: "Empleos formales" },
      { clave: "empleos_por_hab", titulo: "Empleos por habitante" },
      { clave: "cobertura_poblacion_metro", titulo: "Población cerca del metro" },
    ],
  },
};
const ES_PERFIL = (v: string | null): v is Perfil => v === "barrio" || v === "trabajadores";

export default function Invertir() {
  const [indice, setIndice] = useState<IndiceSeccion>();
  const [anioUrl, setAnio] = useParametro("anio");
  const [datosAnio, setDatosAnio] = useState<Indicador[]>([]);
  const [metricaUrl, setMetrica] = useParametro("metrica");
  const [distrito, setDistrito] = useParametro("distrito");
  const [serie, setSerie] = useState<Indicador[]>([]);
  const [perfilUrl, setPerfil] = useParametro("perfil");
  const perfil: Perfil = ES_PERFIL(perfilUrl) ? perfilUrl : "barrio";
  const [negocio, setNegocio] = useState<Indicador[]>([]);

  // El índice y sus componentes: invertir (índices, empleo y competencia por habitante), transporte (población,
  // densidad, cobertura) y el último año de empleo.
  useEffect(() => {
    const invertir = cargar<ArchivoIndicadores>("indicadores/invertir/distritos.json");
    const transporte = cargar<ArchivoIndicadores>("indicadores/transporte/distritos.json");
    const empleo = cargar<IndiceSeccion>("indicadores/empleo/indice.json").then((i) =>
      cargar<ArchivoIndicadores>(`indicadores/empleo/anio_${i.anios[i.anios.length - 1]}.json`),
    );
    Promise.all([invertir, transporte, empleo]).then((archivos) => setNegocio(archivos.flatMap((a) => a.indicadores)));
  }, []);

  useEffect(() => {
    cargar<IndiceSeccion>("indicadores/empleo/indice.json").then(setIndice);
  }, []);

  // Lo que viene en la URL se valida; si no sirve, se usa el valor por defecto.
  const def = METRICAS.find((m) => m.clave === metricaUrl) ?? METRICAS[0];
  const metrica = def.clave;
  const anios = def.anios ?? indice?.anios ?? [];
  const anio = anioUrl && anios.includes(anioUrl) ? anioUrl : anios.at(-1);

  useEffect(() => {
    if (!anio) return;
    cargar<ArchivoIndicadores>(`indicadores/empleo/anio_${anio}.json`).then((a) => setDatosAnio(a.indicadores));
  }, [anio]);

  useEffect(() => {
    const ruta = distrito ? `serie_distrito_${distrito}` : "serie_municipio_MSP";
    cargar<ArchivoIndicadores>(`indicadores/empleo/${ruta}.json`).then((a) => setSerie(a.indicadores));
  }, [distrito]);

  const { valores, ranking, unidad } = useMemo(() => metricaPorTerritorio(datosAnio, metrica), [datosAnio, metrica]);
  // La concentración se mide siempre en empleos, sea cual sea el indicador del mapa.
  const rankingEmpleos = useMemo(() => metricaPorTerritorio(datosAnio, "empleos_formales").ranking, [datosAnio]);

  const territorio = distrito ?? "MSP";
  const busca = (clave: string) =>
    datosAnio.find((i) => i.codigo_territorio === territorio && claveIndicador(i) === clave);
  const nombreTerritorio = busca("empleos_formales")?.nombre_territorio ?? "Município de São Paulo";

  const defSerie = distrito || def.municipal ? def : METRICAS[0];
  const serieMetrica = serie
    .filter((i) => claveIndicador(i) === defSerie.clave)
    .map((i) => ({ anio: i.vigencia, valor: i.valor }));
  const unidadSerie = serie.find((i) => claveIndicador(i) === defSerie.clave)?.unidad;
  const periodoSerie = serieMetrica.length ? `${serieMetrica[0].anio}-${serieMetrica.at(-1)?.anio}` : "";

  const defPerfil = PERFILES[perfil];
  const indicePerfil = useMemo(() => metricaPorTerritorio(negocio, defPerfil.indice), [negocio, defPerfil.indice]);
  const buscaNegocio = (clave: string) =>
    negocio.find((i) => i.codigo_territorio === territorio && claveIndicador(i) === clave);

  return (
    <section className="seccion">
      <CabeceraSeccion
        seccion="invertir"
        pregunta="P2"
        titulo="¿Dónde conviene montar un negocio en São Paulo?"
        visual={
          <ConcentracionDistritos
            ranking={rankingEmpleos}
            anio={anio}
            seleccionado={distrito}
            onSeleccionar={setDistrito}
          />
        }
      >
        <p className="entrada">
          Dónde hay clientes, cuánta competencia hay y si se llega en transporte público, en los 96 distritos. A la
          derecha, qué tan concentrado está el empleo formal. Haz clic en un distrito para ver sus cifras.
        </p>
      </CabeceraSeccion>

      <Estaciones capitulos={CAPITULOS} />

      <SeccionCapitulo id="invertir-perfil">
        <p className="porque">
          <strong>Por qué importa:</strong> abrir un negocio es una decisión cara. Antes de mirar locales, conviene
          saber dónde están los clientes, cuánta competencia hay y si se llega sin carro.
        </p>

        <fieldset className="selector-perfil">
          <legend>¿Qué negocio quieres montar?</legend>
          {(Object.keys(PERFILES) as Perfil[]).map((p) => (
            <button key={p} type="button" aria-pressed={perfil === p} onClick={() => setPerfil(p)}>
              <strong>{PERFILES[p].titulo}</strong>
              <span>{PERFILES[p].ejemplo}</span>
            </button>
          ))}
        </fieldset>

        {distrito && (
          <div className="filtros">
            <button type="button" className="boton-secundario" onClick={() => setDistrito(null)}>
              Volver al municipio
            </button>
          </div>
        )}

        <div className="rejilla-tarjetas">
          {distrito && (
            <TarjetaIndicador
              titulo={`Puntaje de ${nombreTerritorio}`}
              indicador={buscaNegocio(defPerfil.indice)}
              destacado
            />
          )}
          {defPerfil.componentes.map((c) => (
            <TarjetaIndicador key={c.clave} titulo={c.titulo} indicador={buscaNegocio(c.clave)} />
          ))}
        </div>

        <div className="rejilla-dos">
          <div className="panel">
            <h2>{defPerfil.titulo}: puntaje por distrito</h2>
            <MapaDistritos
              valores={indicePerfil.valores}
              unidad={indicePerfil.unidad}
              seleccionado={distrito}
              onSeleccionar={setDistrito}
            />
          </div>
          <RankingDistritos
            titulo={`Los 10 distritos con más puntaje para un ${defPerfil.titulo.toLowerCase()}`}
            ranking={indicePerfil.ranking}
            unidad={indicePerfil.unidad}
            seleccionado={distrito}
            onSeleccionar={setDistrito}
          >
            <p className="nota">
              Puntaje relativo de 0 a 100 entre los 96 distritos: dice dónde hay demanda y acceso, no dónde un negocio
              será rentable.
            </p>
          </RankingDistritos>
        </div>
      </SeccionCapitulo>

      <SeccionCapitulo id="invertir-empleo">
        <h2 className="titulo-capitulo">¿Dónde está el trabajo?</h2>
        <p className="porque">
          <strong>Por qué importa:</strong> el empleo marca hacia dónde viaja la ciudad cada mañana y dónde hay gente
          con sueldo a la hora del almuerzo. Cruzado con dónde vive la gente, explica la presión sobre el transporte.
        </p>
        {/* Los años cambian con el indicador: por sexo desde 2022, por raza o color desde 2023. */}
        <SelectorAnio etiqueta="Año" anios={anios} valor={anio} onCambiar={setAnio} />

        <div className="filtros">
          <label>
            Indicador
            <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
              {METRICAS.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </label>
          {distrito && (
            <button type="button" className="boton-secundario" onClick={() => setDistrito(null)}>
              Volver al municipio
            </button>
          )}
        </div>

        <div className="rejilla-tarjetas">
          <TarjetaIndicador
            titulo={`Empleos formales en ${nombreTerritorio}`}
            indicador={busca("empleos_formales")}
            destacado
          />
          <TarjetaIndicador
            titulo={`Establecimientos en ${nombreTerritorio}`}
            indicador={busca("establecimientos_formales")}
          />
          {distrito && (
            <TarjetaIndicador
              titulo="Participación en el municipio"
              indicador={busca("empleos_formales_participacion")}
            />
          )}
        </div>

        <div className="rejilla-dos">
          <div className="panel">
            <h2>
              {def.etiqueta} por distrito, {anio}
            </h2>
            <MapaDistritos valores={valores} unidad={unidad} seleccionado={distrito} onSeleccionar={setDistrito} />
          </div>

          <RankingDistritos
            titulo={`Los 10 distritos con más ${def.etiqueta.toLowerCase()}`}
            ranking={ranking}
            unidad={unidad}
            seleccionado={distrito}
            onSeleccionar={setDistrito}
          >
            <p className="nota">Excluye las filas «inválidos» y «no localizados», que se conservan en el lago.</p>
          </RankingDistritos>
        </div>
      </SeccionCapitulo>

      <SeccionCapitulo id="invertir-evolucion">
        <h2 className="titulo-capitulo">¿Cómo ha cambiado?</h2>
        <p className="porque">
          <strong>Por qué importa:</strong> separa una tendencia de la foto de un año: deja ver la crisis de 2015-2016,
          la pandemia y la recuperación. Por distrito hay que leerla con cuidado (ver la nota del gráfico).
        </p>

        <div className="panel">
          <h2>
            {defSerie.etiqueta} en {nombreTerritorio}, {periodoSerie}
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={serieMetrica} margin={{ left: 8, right: 16, top: 8 }}>
              <defs>
                <linearGradient id="invertir-relleno" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIE_1} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SERIE_1} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--grilla)" />
              <XAxis dataKey="anio" {...EJE} />
              <YAxis tickFormatter={formatearCorto} width={60} {...EJE} />
              {/* El quiebre solo se marca si la serie empieza antes: en sexo y raza es su primer año. */}
              {serieMetrica[0]?.anio < "2022" && (
                <ReferenceLine
                  x="2022"
                  stroke="var(--texto-tenue)"
                  strokeDasharray="4 4"
                  label={{ value: "Quiebre RAIS", fontSize: 11, fill: "var(--texto-tenue)", position: "insideTopLeft" }}
                />
              )}
              <Tooltip formatter={(v) => [formatear(Number(v), unidadSerie), defSerie.etiqueta]} {...ESTILO_TOOLTIP} />
              <Area
                dataKey="valor"
                stroke={SERIE_1}
                strokeWidth={2.5}
                fill="url(#invertir-relleno)"
                dot={{ r: 4, fill: SERIE_1, strokeWidth: 2, stroke: "var(--superficie)" }}
                activeDot={{ r: 6, strokeWidth: 3, stroke: "var(--superficie)" }}
                {...ANIMACION}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="nota">
            Desde 2022 la RAIS cambió la forma de captar los datos (nota técnica del MTE). Además, cuenta cada empleo
            donde la empresa registra su sede: cuando una empresa grande la muda, un distrito gana o pierde cientos de
            miles de empleos de un año a otro (Brás pasó de 73 mil a 420 mil en 2022 y volvió a 76 mil en 2023).
          </p>
        </div>
      </SeccionCapitulo>

      <NotaMetodo titulo="Cómo se calcula el puntaje">
        Cada componente se ordena entre los 96 distritos y se convierte en percentil (0 a 100); el puntaje es el
        promedio. En el negocio de barrio la competencia cuenta al revés: menos establecimientos por habitante, más
        puntos. Es un indicador proxy: no hay arriendos, precios del suelo, ingresos ni sectores en el lago, así que no
        mide rentabilidad.
      </NotaMetodo>
      <NotaMetodo titulo="Por qué el puntaje no usa el crecimiento del empleo">
        La RAIS cuenta los empleos donde la empresa registra su sede, y las mudanzas de sede mueven cientos de miles de
        empleos entre distritos de un año a otro. Un «distrito que crece» podría ser solo una empresa que cambió de
        dirección.
      </NotaMetodo>
      <NotaMetodo titulo="Años disponibles">
        El empleo total cubre 2011-2024 (F11-F12) y por sexo 2022-2024 (F13-F15).
      </NotaMetodo>
    </section>
  );
}
