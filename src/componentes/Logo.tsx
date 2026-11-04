// Silueta del municipio de São Paulo, simplificada desde los distritos de GeoSampa (data/lago/geo/distritos.geojson,
// EPSG:31983, simplificación de 900 m). No es el escudo oficial: el sitio no es de la Prefeitura.
export const SILUETA_SP =
  "M4.8 2.8L5.5 2.3L6.1 2.6L6.7 2.0L8.1 2.4L8.8 3.3L9.4 3.0L10.1 3.5L10.8 3.4L11.8 2.1L13.5 1.0L13.8 1.4L12.9 3.0L12.8 4.4L13.2 6.1L14.6 5.1L16.2 5.2L17.7 4.8L18.0 5.3L18.7 4.8L19.2 5.9L18.3 6.8L18.8 8.8L17.4 10.6L12.6 9.2L12.4 10.7L11.1 11.3L10.9 12.2L11.4 12.9L10.3 13.7L11.3 15.4L10.9 17.0L11.5 18.0L11.9 21.2L10.5 22.7L9.3 22.2L6.8 23.0L7.2 21.9L6.3 20.8L5.6 20.7L5.6 18.9L6.5 19.1L6.4 17.4L7.0 17.2L5.7 16.2L6.7 14.6L5.9 13.9L5.7 12.2L6.0 10.8L7.3 9.4L6.9 9.1L5.5 9.6L5.5 8.8L6.8 8.0L7.3 6.6L6.4 4.7L5.5 4.6Z";

/** El punto marca el centro (Sé), como la estación «usted está aquí» del diagrama de líneas. */
export default function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d={SILUETA_SP} />
      <circle cx="12.1" cy="8.4" r="1.6" />
    </svg>
  );
}
