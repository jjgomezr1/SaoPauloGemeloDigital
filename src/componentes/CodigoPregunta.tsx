interface Props {
  codigo: "P1" | "P2" | "P3";
}

/**
 * El código de una pregunta como el círculo de una línea: P1 en azul (línea 1), P2 en amarillo (línea 4) y P3 en
 * coral (línea 11 de la CPTM).
 */
export default function CodigoPregunta({ codigo }: Props) {
  return <span className={`codigo-pregunta codigo-${codigo.toLowerCase()}`}>{codigo}</span>;
}
