import { LINEAS, type Linea } from "../lineas";
import { SECCIONES } from "../rutas";

// Las tres preguntas como placas de andén: arriba la franja del color de su línea del Metrô (P1 azul, P2 amarilla,
// P3 coral) con el código de la pregunta, en medio la pregunta y abajo la flecha de dirección hacia la sección que la
// responde. En pantallas angostas las placas se deslizan de lado.

const PREGUNTAS: {
  codigo: "P1" | "P2" | "P3";
  linea: Linea;
  seccion: string;
  titulo: string;
  falta: string;
}[] = [
  {
    codigo: "P1",
    linea: LINEAS.azul,
    seccion: "transporte",
    titulo: "¿Qué tan cubierta está la ciudad por transporte público, y dónde se concentran los equipamientos?",
    falta: "atractivos turísticos, hoteles y equipamientos culturales.",
  },
  {
    codigo: "P2",
    linea: LINEAS.amarilla,
    seccion: "invertir",
    titulo: "¿Dónde conviene montar un negocio en São Paulo?",
    falta: "arriendos, precios del suelo, ingreso y sector económico.",
  },
  {
    codigo: "P3",
    linea: LINEAS.coral,
    seccion: "equidad",
    titulo: "¿Los distritos con más favelas reciben menos?",
    falta: "salud por distrito.",
  },
];

const titulo = (id: string) => SECCIONES.find((s) => s.id === id)?.titulo ?? id;

export default function PreguntasPortada() {
  return (
    <section className="andenes" aria-labelledby="preguntas-titulo">
      <h2 id="preguntas-titulo" className="subtitulo">
        Tres preguntas
      </h2>
      <ol className="andenes-lista">
        {PREGUNTAS.map((p) => (
          <li key={p.codigo}>
            <a
              href={`#${p.seccion}`}
              className="anden"
              style={{ "--color-linea": p.linea.color, "--sobre-color-linea": p.linea.sobre } as React.CSSProperties}
            >
              <span className="anden-franja">
                <span className="anden-codigo">{p.codigo}</span>
              </span>
              <strong className="anden-pregunta">{p.titulo}</strong>
              <span className="anden-falta">Aún sin responder: {p.falta}</span>
              <span className="anden-direccion">
                <span className="anden-destino">
                  <span className="anden-ir">Ir a</span>
                  {titulo(p.seccion)}
                </span>
                <span className="anden-flecha" aria-hidden>
                  →
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
