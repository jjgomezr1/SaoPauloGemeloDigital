import { lazy, Suspense, useEffect, useState } from "react";
import BotonTema from "./componentes/BotonTema";
import { FuentesContexto } from "./componentes/contexto";
import Logo from "./componentes/Logo";
import { NotasProveedor, NotasSeccion } from "./componentes/notas";
import { useRevelar } from "./componentes/useRevelar";
import { cargar, type Fuente } from "./datos";
import { LineaContexto, lineaDe } from "./lineas";
import { SECCIONES, useRuta } from "./rutas";
import Fuentes from "./secciones/Fuentes";
import Panorama from "./secciones/Panorama";
import Pendiente from "./secciones/Pendiente";
import { TemaContexto, useTemaRaiz } from "./tema";

// MapLibre y Recharts pesan: solo se bajan al abrir una sección que los usa.
const Ambiente = lazy(() => import("./secciones/Ambiente"));
const Equidad = lazy(() => import("./secciones/Equidad"));
const Invertir = lazy(() => import("./secciones/Invertir"));
const Gente = lazy(() => import("./secciones/Gente"));
const Mapa3D = lazy(() => import("./secciones/Mapa3D"));
const Municipio = lazy(() => import("./secciones/Municipio"));
const Transporte = lazy(() => import("./secciones/Transporte"));

// Las rutas viven en el hash, así que el salto no puede ser un enlace a #contenido: mueve el foco.
function irAlContenido() {
  document.getElementById("contenido")?.focus();
}

export default function App() {
  const ruta = useRuta();
  const [fuentes, setFuentes] = useState<Record<string, Fuente>>({});
  // El menú (móvil) queda abierto solo en la sección donde se abrió: al navegar se cierra.
  const [menuAbiertoEn, setMenuAbiertoEn] = useState<string | null>(null);
  const menuAbierto = menuAbiertoEn === ruta;
  const [tema, alternarTema] = useTemaRaiz();

  useEffect(() => {
    cargar<Fuente[]>("catalogo/fuentes.json").then((lista) =>
      setFuentes(Object.fromEntries(lista.map((f) => [f.fuente_id, f]))),
    );
  }, []);

  const seccion = SECCIONES.find((s) => s.id === ruta) ?? SECCIONES[0];
  const linea = lineaDe(seccion.id);
  useRevelar();

  // La línea de la sección tiñe toda la página (variables en estilos.css, :root[data-linea]).
  useEffect(() => {
    document.documentElement.dataset.linea = seccion.id;
  }, [seccion.id]);

  return (
    <TemaContexto.Provider value={tema}>
      <LineaContexto.Provider value={linea}>
        <FuentesContexto.Provider value={fuentes}>
          <button type="button" className="saltar" onClick={irAlContenido}>
            Saltar al contenido
          </button>
          <header className="cabecera">
            <a href="#panorama" className="marca">
              <Logo />
              <span className="marca-texto">
                <span translate="no">São Paulo</span>
                <span className="marca-sub">gemelo digital</span>
              </span>
            </a>
            <button
              type="button"
              className="boton-menu"
              aria-expanded={menuAbierto}
              aria-controls="navegacion"
              aria-label="Secciones"
              onClick={() => setMenuAbiertoEn(menuAbierto ? null : ruta)}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d={menuAbierto ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
              </svg>
            </button>
            <nav id="navegacion" className={menuAbierto ? "nav abierta" : "nav"}>
              {SECCIONES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={s.id === seccion.id ? "activa" : ""}
                  aria-current={s.id === seccion.id ? "page" : undefined}
                  style={
                    {
                      "--color-linea": lineaDe(s.id).color,
                      "--sobre-color-linea": lineaDe(s.id).sobre,
                    } as React.CSSProperties
                  }
                >
                  {s.titulo}
                  {!s.lista && (
                    <span className="nav-pendiente" title="En construcción">
                      ·
                    </span>
                  )}
                </a>
              ))}
            </nav>
            <BotonTema tema={tema} onAlternar={alternarTema} />
          </header>

          <main id="contenido" className="contenido" tabIndex={-1}>
            <Suspense fallback={<p className="nota cargando-seccion">Cargando…</p>}>
              <NotasProveedor key={seccion.id}>
                <div className="entrada-seccion">
                  {seccion.id === "panorama" && <Panorama />}
                  {seccion.id === "mapa" && <Mapa3D />}
                  {seccion.id === "invertir" && <Invertir />}
                  {seccion.id === "equidad" && <Equidad />}
                  {seccion.id === "transporte" && <Transporte />}
                  {seccion.id === "gente" && <Gente />}
                  {seccion.id === "municipio" && <Municipio />}
                  {seccion.id === "ambiente" && <Ambiente />}
                  {seccion.id === "fuentes" && <Fuentes />}
                  {!seccion.lista && <Pendiente seccion={seccion} />}
                </div>
                <NotasSeccion fuentesSeccion={seccion.fuentes} />
              </NotasProveedor>
            </Suspense>
          </main>

          <footer className="pie">
            <p className="pie-equipo">
              Hecho por Samuel Herrera Hoyos, Samuel Henao Castrillón, Juan José Gómez Ramírez y Juan Carlos Fernández
              Vanoy · Gestión y Gobernanza, EAFIT
            </p>
            <p>
              Datos: Prefeitura de São Paulo (GeoSampa, Infocidade), IBGE, SPTrans, RAIS, ABRASCE. Mapa base:
              OpenFreeMap, © colaboradores de OpenStreetMap. Foto de portada: Raphael Nogueira (Unsplash). La fuente y
              la vigencia de cada cifra están en las notas del final de cada sección.
            </p>
          </footer>
        </FuentesContexto.Provider>
      </LineaContexto.Provider>
    </TemaContexto.Provider>
  );
}
