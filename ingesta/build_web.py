"""Lee el lago y escribe public/data/ para la web (secciones 6 y 7 del plan).

Todo lo que llega a public/ pasa por publicar(), que aplica el filtro de privacidad.
No se escribe en public/ de ninguna otra forma.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import shutil

import geopandas as gpd
import pandas as pd
import shapely

import calculos_equipamientos
import calculos_p1
from calculos_p1 import DERIVADOS
from comun import cargar_equivalencias, unir_distritos, unir_subprefeituras
from config import (
    CAMPOS_SENSIBLES,
    CRS_TRABAJO,
    CRS_WEB,
    DICCIONARIO_CSV,
    FUENTES_CSV,
    LAGO,
    LAGO_GEO,
    PUBLIC_DATA,
    PUBLICACION_AUTORIZADA,
    PUBLICACION_TRANSFORMADA,
    RADIO_COBERTURA_M,
    RAW,
    UMBRAL_SUPRESION,
)

TIPOS = {"observado", "estimado", "proxy", "declarado"}

# Advertencias que el Diccionario sugiere; son obligatorias en la tarjeta.
ADVERTENCIAS = {
    "F06": "Medida en una sola estación (IAG Água Funda); no representa toda la ciudad.",
    "F08": "Es una estimación del IBGE para 2021, no un conteo.",
    "F03": "Cuenta establecimientos (no camas ni atenciones) de 2025, de todas las redes. "
    "Un mismo establecimiento puede ofrecer varios servicios.",
    "F04": "Valores en R$ corrientes, sin ajustar por inflación: no se comparan directamente entre años. "
    "Los ingresos son realizados y los gastos, empenhados.",
    "F11": "Son establecimientos con registro formal (RAIS), no empresas ni empleos. "
    "La serie RAIS tiene un quiebre desde 2022 por cambios en la captación.",
    "F12": "Mide dónde está el empleo, no dónde vive quien lo ocupa. "
    "La serie RAIS tiene un quiebre desde 2022 por cambios en la captación.",
    "F05": "Solo buses municipales de SPTrans (no metro ni tren). Se suman los reportes diarios; "
    "un mes al que le falta algún día se completa con el consolidado mensual de SPTrans.",
    "F13": "La serie RAIS tiene un quiebre desde 2022 por cambios en la captación.",
    "F14": "La serie RAIS tiene un quiebre desde 2022 por cambios en la captación.",
    "F15": "La serie RAIS tiene un quiebre desde 2022 por cambios en la captación.",
    "F16": "Porcentaje sobre todos los empleos, incluidos los que no tienen raza o color registrada.",
    "F17": "Porcentaje sobre todos los empleos, incluidos los que no tienen raza o color registrada.",
    "F25": "El método de medición cambia entre años; no comparar 2010, 2015 y 2020.",
    "F26": "El método de medición cambia entre años; no comparar 2010, 2015 y 2020.",
    "F27": "El método de medición cambia entre años; no comparar 2010, 2015 y 2020.",
    "F01": "De 1872 a 1950 son personas presentes, de 1960 a 1980 personas recenseadas y desde 1991 residentes: "
    "la serie no mide siempre lo mismo.",
    "F07": "Es el IDHM de 2000 y 2010 (Atlas del Desarrollo Humano, 2013): no refleja la situación de hoy.",
    "F18": "La tabla no dice si el distrito es el de residencia de la madre o el del lugar del parto.",
    "F19": "La tabla no dice si el distrito es el de residencia de la madre o el del lugar del parto. "
    "Cifra preliminar de la fuente (datos del 16/04/2025).",
    "F20": "La tabla no dice si el distrito es el de residencia de la madre o el del lugar del parto.",
}


# Advertencias de los indicadores calculados (no salen del Diccionario sino del método).
ADVERTENCIA_COBERTURA = (
    f"Estimación: radio de {RADIO_COBERTURA_M} m en línea recta (decisión del equipo), no distancia "
    "caminando. No cuenta estaciones de tren CPTM, que no están en el lago."
)
ADVERTENCIA_POBLACION = "Población del censo 2022 (F41); las paradas y estaciones son de la descarga actual."


# --- Filtro único de privacidad --------------------------------------------


def es_sensible(fuente_id: str, campo: str) -> bool:
    """Sensible según el Diccionario y sin una excepción del equipo en PUBLICACION_AUTORIZADA."""
    return campo in CAMPOS_SENSIBLES.get(fuente_id, set()) and (fuente_id, campo) not in PUBLICACION_AUTORIZADA


def filtrar_registros(registros: list[dict]) -> list[dict]:
    """Quita indicadores sobre campos sensibles, salvo los que salen transformados."""
    salida = []
    for r in registros:
        clave = (r["fuente_id"], r["campo_lago"])
        if es_sensible(*clave):
            forma = PUBLICACION_TRANSFORMADA.get(clave)
            if forma is None or r.get("transformacion") != forma:
                continue
        salida.append(r)
    return salida


def filtrar_propiedades(gdf: gpd.GeoDataFrame, fuente_id: str) -> gpd.GeoDataFrame:
    sensibles = [c for c in gdf.columns if es_sensible(fuente_id, c)]
    return gdf.drop(columns=sensibles)


def publicar(ruta_relativa: str, contenido, silencioso: bool = False) -> None:
    """Única puerta de salida a public/data/."""
    destino = PUBLIC_DATA / ruta_relativa
    destino.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(contenido, dict) and "indicadores" in contenido:
        contenido = {**contenido, "indicadores": filtrar_registros(contenido["indicadores"])}
    # allow_nan=False: un NaN rompería el JSON en el navegador; mejor fallar aquí.
    texto = json.dumps(contenido, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    destino.write_text(texto, encoding="utf-8")
    if not silencioso:
        print(f"  public/data/{ruta_relativa}: {len(texto) / 1024:,.0f} KB")


def publicar_geo(
    ruta_relativa: str,
    gdf: gpd.GeoDataFrame,
    fuente_id: str | None,
    tolerancia_m: float = 0,
    decimales: int = 5,
    silencioso: bool = False,
) -> None:
    gdf = filtrar_propiedades(gdf, fuente_id) if fuente_id else gdf
    if tolerancia_m:
        gdf = gdf.to_crs(CRS_TRABAJO)
        # En líneas no hace falta preservar topología (es mucho más rápido); en polígonos sí.
        lineas = gdf.geom_type.isin(["LineString", "MultiLineString"]).all()
        gdf["geometry"] = gdf.geometry.simplify(tolerancia_m, preserve_topology=not lineas)
    gdf = gdf.to_crs(CRS_WEB)
    geojson = json.loads(gdf.to_json(drop_id=True))
    for f in geojson["features"]:
        f["geometry"] = redondear(f["geometry"], decimales)
    if fuente_id:
        geojson["fuente_id"] = fuente_id  # verificar.py revisa las propiedades contra esta fuente
    publicar(ruta_relativa, geojson, silencioso)


def redondear(geom: dict, decimales: int = 5) -> dict:
    """5 decimales ≈ 1 m: suficiente para el mapa y reduce el peso a la mitad."""

    def r(c):
        return [round(x, decimales) for x in c] if isinstance(c[0], float) else [r(x) for x in c]

    return {**geom, "coordinates": r(geom["coordinates"])}


# --- Contrato de indicadores (sección 6) -----------------------------------


def indicador(
    *,
    campo_lago,
    valor,
    unidad,
    nivel,
    codigo,
    nombre,
    fuente_id,
    vigencia,
    tipo="observado",
    id_extra="",
    calculo=None,
    clave=None,
    fuentes_adicionales=None,
    advertencia=None,
    transformacion=None,
) -> dict:
    """clave es el nombre del indicador en el id; por omisión, campo_lago + id_extra."""
    assert tipo in TIPOS
    clave = clave or f"{campo_lago}{id_extra}"
    registro = {
        "id": f"{clave}_{nivel}_{codigo}_{vigencia}",
        "campo_lago": campo_lago,
        "valor": None if pd.isna(valor) else round(float(valor), 4),
        "unidad": unidad,
        "nivel": nivel,
        "codigo_territorio": codigo,
        "nombre_territorio": nombre,
        "fuente_id": fuente_id,
        "vigencia": str(vigencia),
        "tipo": tipo,
        "advertencia": " ".join(a for a in (ADVERTENCIAS.get(fuente_id), advertencia) if a) or None,
    }
    if calculo:
        registro["calculo"] = calculo
    if fuentes_adicionales:
        registro["fuentes_adicionales"] = fuentes_adicionales
    if transformacion:
        # Campos Sensibles que salen transformados (config.PUBLICACION_TRANSFORMADA).
        registro["transformacion"] = transformacion
    return registro


# --- Secciones --------------------------------------------------------------


def nombres_visibles() -> tuple[dict, dict]:
    """Nombres con tildes de Infocidade («Água Rasa», «Sé») por código.

    GeoSampa los trae en mayúsculas y sin tildes; esos se quedan para unir, estos para mostrar.
    """
    lago = pd.read_csv(LAGO / "establecimientos_empleos.csv")
    lago = unir_subprefeituras(unir_distritos(lago.drop_duplicates(["unidad_territorial", "nivel"])))
    dist = lago[lago.nivel == "distrito"]
    sub = lago[lago.nivel == "subprefeitura"]
    return (
        dict(zip(dist.codigo_distrito, dist.unidad_territorial, strict=True)),
        dict(zip(sub.codigo_subprefeitura, sub.unidad_territorial, strict=True)),
    )


def construir_territorio():
    eq = cargar_equivalencias()
    vis_dist, vis_sub = nombres_visibles()
    dist = gpd.read_file(LAGO_GEO / "distritos.gpkg")
    dist = dist.merge(eq[["codigo_distrito", "subprefeitura"]], on="codigo_distrito")
    dist["nombre_visible"] = dist["codigo_distrito"].map(vis_dist).fillna(dist["nombre"].str.title())
    dist["subprefeitura"] = dist["codigo_subprefeitura"].map(vis_sub).fillna(dist["subprefeitura"].str.title())
    dist["area_km2"] = dist["area_km2"].round(2)
    publicar_geo("territorio/distritos.geojson", dist, None, tolerancia_m=15)
    sub = gpd.read_file(LAGO_GEO / "subprefeituras.gpkg")
    sub["nombre_visible"] = sub["codigo_subprefeitura"].map(vis_sub).fillna(sub["nombre"].str.title())
    sub["area_km2"] = sub["area_km2"].round(2)
    publicar_geo("territorio/subprefeituras.geojson", sub, None, tolerancia_m=15)
    publicar_geo("territorio/municipio.geojson", contorno_y_mascara(sub), None)


def contorno_y_mascara(subprefeituras: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """El borde del municipio y su negativo (el mundo menos São Paulo).

    Los mapas tapan con la máscara todo lo que queda fuera, para mostrar solo la ciudad.
    """
    union = subprefeituras.to_crs(CRS_TRABAJO).union_all().buffer(1).simplify(15)
    # Sin huecos ni astillas: solo el contorno exterior de las partes de más de 1 km².
    partes = [shapely.Polygon(p.exterior) for p in getattr(union, "geoms", [union]) if p.area > 1e6]
    municipio = gpd.GeoSeries([shapely.MultiPolygon(partes)], crs=CRS_TRABAJO).to_crs(CRS_WEB).iloc[0]
    mundo = shapely.box(-180, -85, 180, 85)
    return gpd.GeoDataFrame(
        {"parte": ["municipio", "fuera"]},
        geometry=[municipio, mundo.difference(municipio)],
        crs=CRS_WEB,
    )


def construir_empleo():
    lago = pd.read_csv(LAGO / "establecimientos_empleos.csv")
    lago = unir_subprefeituras(unir_distritos(lago))
    eq = cargar_equivalencias()
    nombres_dist, nombres_sub = nombres_visibles()
    area_dist = dict(zip(eq.codigo_distrito, eq.area_km2.astype(float), strict=True))

    # Invalidos y no localizados se quedan en el lago, pero no van a mapas ni rankings.
    lago = lago[lago["nivel"].isin(["municipio", "subprefeitura", "distrito"])]
    total_mun = lago[lago.nivel == "municipio"].set_index("anio")["empleos_formales"]

    registros = []
    campos = [("establecimientos_formales", "Establecimientos", "F11"), ("empleos_formales", "Empleos", "F12")]
    for fila in lago.itertuples():
        codigo, nombre = territorio(fila, nombres_dist, nombres_sub)
        for campo, unidad, fuente in campos:
            registros.append(
                indicador(
                    campo_lago=campo,
                    valor=getattr(fila, campo),
                    unidad=unidad,
                    nivel=fila.nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id=fuente,
                    vigencia=fila.anio,
                )
            )
        if fila.nivel == "distrito":
            registros.append(
                indicador(
                    campo_lago="empleos_formales",
                    id_extra="_participacion",
                    valor=100 * fila.empleos_formales / total_mun[fila.anio],
                    unidad="% del municipio",
                    nivel="distrito",
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id="F12",
                    vigencia=fila.anio,
                    calculo="empleos_formales del distrito / empleos_formales del municipio × 100",
                )
            )
            registros.append(
                indicador(
                    campo_lago="empleos_formales",
                    id_extra="_por_km2",
                    valor=fila.empleos_formales / area_dist[codigo],
                    unidad="Empleos por km²",
                    nivel="distrito",
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id="F12",
                    vigencia=fila.anio,
                    calculo="empleos_formales / área del distrito (GeoSampa, EPSG:31983)",
                )
            )

    registros += empleo_por_sexo(nombres_dist, nombres_sub)
    registros += empleo_por_raza(nombres_dist, nombres_sub)
    publicar_por_partes("empleo", "P2", registros)


def territorio(fila, nombres_dist: dict, nombres_sub: dict) -> tuple[str, str]:
    """Código y nombre visible de una fila de Infocidade ya unida a la tabla de equivalencias."""
    if fila.nivel == "distrito":
        return fila.codigo_distrito, nombres_dist[fila.codigo_distrito]
    if fila.nivel == "subprefeitura":
        return fila.codigo_subprefeitura, nombres_sub[fila.codigo_subprefeitura]
    return "MSP", "Município de São Paulo"


def leer_por_unidad(archivo: str) -> pd.DataFrame:
    """Tabla del lago por unidad territorial, sin inválidos ni no localizados y con sus códigos."""
    df = pd.read_csv(LAGO / archivo)
    df = df[df["nivel"].isin(["municipio", "subprefeitura", "distrito"])]
    return unir_subprefeituras(unir_distritos(df))


FUENTE_SEXO = {2024: "F13", 2023: "F14", 2022: "F15"}
FUENTE_RAZA = {2024: "F16", 2023: "F17"}
ETIQUETAS_RAZA = {
    "amarela": "amarilla",
    "branca": "blanca",
    "indigena": "indígena",
    "parda": "parda",
    "preta": "preta",
    "nao_identificada": "no identificada",
}


def empleo_por_sexo(nombres_dist: dict, nombres_sub: dict) -> list[dict]:
    registros = []
    for fila in leer_por_unidad("empleo_sexo.csv").itertuples():
        codigo, nombre = territorio(fila, nombres_dist, nombres_sub)
        total = fila.empleos_masculino + fila.empleos_femenino
        registros.append(
            indicador(
                clave="empleos_femenino_pct",
                campo_lago="empleos_femenino",
                valor=100 * fila.empleos_femenino / total if total else None,
                unidad="% de los empleos",
                nivel=fila.nivel,
                codigo=codigo,
                nombre=nombre,
                fuente_id=FUENTE_SEXO[fila.anio],
                vigencia=fila.anio,
                calculo="empleos_femenino / (empleos_masculino + empleos_femenino) × 100",
            )
        )
    return registros


def empleo_por_raza(nombres_dist: dict, nombres_sub: dict) -> list[dict]:
    """Raza o color es Sensible: sale solo como porcentaje, y se suprime bajo el umbral."""
    df = leer_por_unidad("empleo_raza.csv")
    claves = ["anio", "nivel", "unidad_territorial"]
    ancho = df.pivot_table(index=claves, columns="raza_color", values="empleos", aggfunc="sum").reset_index()
    ancho = ancho.merge(df.drop_duplicates(claves)[[*claves, "codigo_distrito", "codigo_subprefeitura"]], on=claves)
    ancho["preta_parda"] = ancho["preta"] + ancho["parda"]
    categorias = [*ETIQUETAS_RAZA, "preta_parda"]
    registros = []
    for fila in ancho.itertuples():
        codigo, nombre = territorio(fila, nombres_dist, nombres_sub)
        total = sum(getattr(fila, c) for c in ETIQUETAS_RAZA)
        for categoria in categorias:
            casos = getattr(fila, categoria)
            suprimido = casos < UMBRAL_SUPRESION
            etiqueta = ETIQUETAS_RAZA.get(categoria, "preta o parda")
            registros.append(
                indicador(
                    clave=f"empleos_raza_{categoria}_pct",
                    campo_lago="empleos",
                    valor=None if suprimido or not total else 100 * casos / total,
                    unidad="% de los empleos",
                    nivel=fila.nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id=FUENTE_RAZA[fila.anio],
                    vigencia=fila.anio,
                    calculo=f"empleos de raza o color {etiqueta} / total de empleos × 100",
                    advertencia=f"Menos de {UMBRAL_SUPRESION} empleos: la cifra se suprime." if suprimido else None,
                    transformacion="porcentaje",
                )
            )
    return registros


def publicar_por_partes(seccion: str, pregunta: str, registros: list[dict]) -> None:
    """Un archivo por año (para el mapa) y uno por territorio (para la serie).

    Así el navegador nunca baja la tabla completa.
    """
    df = pd.DataFrame(registros)
    cabecera = {"seccion": seccion, "pregunta": pregunta, "generado": dt.date.today().isoformat()}
    for anio, grupo in df.groupby("vigencia"):
        publicar(f"indicadores/{seccion}/anio_{anio}.json", {**cabecera, "indicadores": limpiar_nulos(grupo)})
    for (nivel, codigo), grupo in df.groupby(["nivel", "codigo_territorio"]):
        publicar(
            f"indicadores/{seccion}/serie_{nivel}_{codigo}.json", {**cabecera, "indicadores": limpiar_nulos(grupo)}
        )
    publicar(
        f"indicadores/{seccion}/indice.json",
        {
            **cabecera,
            "anios": sorted(df["vigencia"].unique().tolist()),
            "territorios": (
                df[["nivel", "codigo_territorio", "nombre_territorio"]].drop_duplicates().to_dict(orient="records")
            ),
        },
    )


OPCIONALES = ("calculo", "fuentes_adicionales", "transformacion")


def limpiar_nulos(df: pd.DataFrame) -> list[dict]:
    """Quita las claves opcionales vacías (calculo, fuentes_adicionales, transformacion) de cada registro."""

    def vacio(v):
        return v is None or (isinstance(v, float) and math.isnan(v))

    # Al pasar por pandas, un valor suprimido (None) vuelve como NaN, que no es JSON válido.
    return [
        {k: None if vacio(v) else v for k, v in r.items() if not (k in OPCIONALES and vacio(v))}
        for r in df.to_dict(orient="records")
    ]


def vigencia_descarga(nombre_raw: str) -> str:
    """Las capas de GeoSampa son «dato operativo actual»: su vigencia es el mes de la descarga."""
    return sorted(RAW.glob(f"*_{nombre_raw}.geojson"))[-1].name[:7]


# (clave, columna en calculos_p1, campo_lago, fuente, unidad, tipo, adicionales, cálculo)
METRICAS_P1 = [
    (
        "paradas_bus",
        "paradas_bus",
        "codigo_parada",
        "F30",
        "Paradas",
        "observado",
        None,
        "conteo de codigo_parada dentro del distrito",
    ),
    (
        "paradas_por_km2",
        "paradas_por_km2",
        "codigo_parada",
        "F30",
        "Paradas por km²",
        "observado",
        None,
        "paradas / área del distrito",
    ),
    (
        "estaciones_metro",
        "estaciones_metro",
        "id_estacion",
        "F36",
        "Estaciones",
        "observado",
        None,
        "conteo de id_estacion dentro del distrito",
    ),
    (
        "lineas_bus",
        "lineas_bus",
        "codigo_linea",
        "F29",
        "Líneas",
        "observado",
        None,
        "líneas distintas (codigo_linea) cuyo recorrido pasa por el distrito",
    ),
    (
        "km_red_bus",
        "km_red_bus",
        "codigo_linea",
        "F29",
        "km",
        "observado",
        None,
        "longitud de la unión de todos los recorridos dentro del distrito; una calle con varias líneas cuenta una vez",
    ),
    (
        "km_red_bus_por_km2",
        "km_red_bus_por_km2",
        "codigo_linea",
        "F29",
        "km de red por km²",
        "observado",
        None,
        "km de red de bus / área del distrito",
    ),
    (
        "cobertura_area",
        "cobertura_area_pct",
        "codigo_parada",
        "F30",
        "% del área",
        "estimado",
        ["F36"],
        f"área del distrito a {RADIO_COBERTURA_M} m o menos de una parada de bus o estación de metro"
        " / área del distrito",
    ),
    (
        "cobertura_poblacion",
        "cobertura_poblacion_pct",
        "poblacion",
        "F41",
        "% de la población",
        "estimado",
        ["F30", "F36"],
        f"población de los sectores censales cuyo punto interior está a {RADIO_COBERTURA_M} m o menos de una "
        "parada o estación / población del distrito",
    ),
    (
        "cobertura_poblacion_metro",
        "cobertura_poblacion_metro_pct",
        "poblacion",
        "F41",
        "% de la población",
        "estimado",
        ["F36"],
        "igual que la cobertura de población, pero solo con estaciones de metro",
    ),
    (
        "poblacion",
        "poblacion",
        "poblacion",
        "F41",
        "Personas",
        "observado",
        None,
        "suma de poblacion de los sectores censales del distrito (codigo_distrito)",
    ),
    (
        "densidad",
        "densidad_hab_km2",
        "poblacion",
        "F41",
        "Habitantes por km²",
        "observado",
        None,
        "población / área del distrito",
    ),
]


def construir_transporte():
    cobertura = calculos_p1.cobertura_por_distrito()
    nombres_dist, _ = nombres_visibles()
    vig_red = vigencia_descarga("geosampa_ponto_onibus")
    registros = []
    for codigo, fila in cobertura.iterrows():
        nivel = "municipio" if codigo == "MSP" else "distrito"
        nombre = "Município de São Paulo" if codigo == "MSP" else nombres_dist[codigo]
        for clave, columna, campo, fuente, unidad, tipo, adicionales, calculo in METRICAS_P1:
            # Solo la población sale entera del censo; lo que cruza con la red es de la descarga actual.
            vigencia = "2022" if fuente == "F41" and adicionales is None else vig_red
            advertencia = ADVERTENCIA_COBERTURA if clave.startswith("cobertura") else None
            if clave.startswith("cobertura_poblacion"):
                advertencia = f"{ADVERTENCIA_COBERTURA} {ADVERTENCIA_POBLACION}"
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago=campo,
                    valor=fila[columna],
                    unidad=unidad,
                    nivel=nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id=fuente,
                    vigencia=vigencia,
                    tipo=tipo,
                    calculo=calculo,
                    fuentes_adicionales=adicionales,
                    advertencia=advertencia,
                )
            )
    cabecera = {
        "seccion": "transporte",
        "pregunta": "P1",
        "generado": dt.date.today().isoformat(),
        "radio_cobertura_m": RADIO_COBERTURA_M,
    }
    publicar("indicadores/transporte/distritos.json", {**cabecera, "indicadores": registros})

    construir_pasajeros(cabecera)

    # Capas del mapa 3D (capa B). La red de bus va sin atributos (cada calle una vez) y,
    # como las paradas, partida en celdas: el mapa baja solo las que ve al acercarse.
    publicar_por_celdas("transporte/red_bus", calculos_p1.red_bus(), "F29", tolerancia_m=10)
    paradas = calculos_p1.capa("paradas")[["codigo_parada", "calle_numero", "geometry"]]
    publicar_por_celdas("transporte/paradas", paradas, "F30")
    publicar_geo("transporte/metro.geojson", calculos_p1.capa("metro"), "F35", tolerancia_m=5)
    publicar_geo("transporte/tren.geojson", calculos_p1.capa("tren"), "F31", tolerancia_m=5)
    publicar_geo("transporte/estaciones.geojson", calculos_p1.capa("estaciones"), "F36")


def construir_pasajeros(cabecera: dict):
    ruta = LAGO / "sptrans_pasajeros.csv"
    if not ruta.exists():
        print("  (sin lago/sptrans_pasajeros.csv: corre pull_movilidad.py sin --sin-pasajeros)")
        return
    df = pd.read_csv(ruta, dtype={"codigo_linea": str})
    df["periodo"] = df["anio"].astype(str) + "-" + df["mes"].astype(str).str.zfill(2)
    registros = []
    # Serie mensual del sistema (no se reparte por distrito: F05 no tiene geografía).
    for periodo, total in df.groupby("periodo")["pasajeros_total"].sum().items():
        registros.append(
            indicador(
                clave="pasajeros_total_mes",
                campo_lago="pasajeros_total",
                valor=total,
                unidad="Pasajeros",
                nivel="municipio",
                codigo="MSP",
                nombre="Sistema municipal de buses",
                fuente_id="F05",
                vigencia=periodo,
                calculo="suma de pasajeros_total de todas las líneas en el mes",
            )
        )
    # Ranking de líneas en los últimos 12 meses completos.
    meses = sorted(df["periodo"].unique())[-12:]
    ventana = f"{meses[0]} a {meses[-1]}"
    ultimos = df[df["periodo"].isin(meses)]
    por_linea = (
        ultimos.sort_values("periodo")
        .groupby("codigo_linea")
        .agg(nombre=("nombre_linea", "last"), total=("pasajeros_total", "sum"))
        .sort_values("total", ascending=False)
    )
    for codigo, fila in por_linea.iterrows():
        registros.append(
            indicador(
                clave="pasajeros_total_12m",
                campo_lago="pasajeros_total",
                valor=fila.total,
                unidad="Pasajeros",
                nivel="linea",
                codigo=codigo,
                nombre=fila.nombre or codigo,
                fuente_id="F05",
                vigencia=ventana,
                calculo=f"suma de pasajeros_total de la línea, {len(meses)} meses",
            )
        )
    publicar("indicadores/transporte/pasajeros.json", {**cabecera, "meses": meses, "indicadores": registros})


# Celdas de 0,05° (unos 5 km): a zoom 14 la pantalla cubre unas cuatro.
TAMANO_CELDA = 0.05


def publicar_por_celdas(carpeta: str, gdf: gpd.GeoDataFrame, fuente_id: str, tolerancia_m: float = 0) -> None:
    """Parte una capa en celdas de una cuadrícula y publica un archivo por celda más un índice.

    Las líneas se cortan en el borde de cada celda; los puntos van a la celda que los contiene.
    """
    if tolerancia_m:
        gdf = gdf.to_crs(CRS_TRABAJO)
        gdf["geometry"] = gdf.geometry.simplify(tolerancia_m, preserve_topology=False)
    gdf = gdf.to_crs(CRS_WEB)
    oeste, sur, este, norte = gdf.total_bounds
    celdas = []
    for x in range(math.floor(oeste / TAMANO_CELDA), math.floor(este / TAMANO_CELDA) + 1):
        for y in range(math.floor(sur / TAMANO_CELDA), math.floor(norte / TAMANO_CELDA) + 1):
            caja = shapely.box(x * TAMANO_CELDA, y * TAMANO_CELDA, (x + 1) * TAMANO_CELDA, (y + 1) * TAMANO_CELDA)
            if (gdf.geom_type == "Point").all():
                parte = gdf[gdf.geometry.x.floordiv(TAMANO_CELDA).eq(x) & gdf.geometry.y.floordiv(TAMANO_CELDA).eq(y)]
            else:
                parte = gdf.clip(caja, keep_geom_type=True)
            parte = parte[parte.geometry.notna() & ~parte.geometry.is_empty]
            if parte.empty:
                continue
            publicar_geo(f"{carpeta}/{x}_{y}.geojson", parte, fuente_id, silencioso=True)
            celdas.append(f"{x}_{y}")
    publicar(f"{carpeta}/indice.json", {"fuente_id": fuente_id, "tamano_celda": TAMANO_CELDA, "celdas": celdas})


def construir_equipamientos():
    """P1, segunda parte: escuelas, deporte, ferias y shoppings por distrito."""
    res, vigencias = calculos_equipamientos.equipamientos_por_distrito()
    nombres_dist, _ = nombres_visibles()
    vig = {
        "F33": vigencia_descarga("geosampa_centros_esportivos"),
        "F34": vigencia_descarga("geosampa_estadios"),
        "F39": vigencia_descarga("geosampa_educacao_infantil"),
        "F40": vigencia_descarga("geosampa_educacao_rede_publica"),
        **vigencias,
    }
    por_10mil = "por 10 mil habitantes (población del censo 2022, F41)"
    # (clave, columna, campo_lago, fuente, unidad, tipo, adicionales, cálculo)
    metricas = [
        (
            "escuelas_infantil",
            "escuelas_infantil",
            "codigo_equipamento",
            "F39",
            "Escuelas",
            "observado",
            None,
            "escuelas públicas de educación infantil dentro del distrito",
        ),
        (
            "escuelas_infantil_por_10mil",
            "escuelas_infantil_por_10mil",
            "codigo_equipamento",
            "F39",
            "Escuelas por 10 mil hab.",
            "observado",
            ["F41"],
            f"escuelas de educación infantil {por_10mil}",
        ),
        (
            "escuelas_basica",
            "escuelas_basica",
            "codigo_equipamento",
            "F40",
            "Escuelas",
            "observado",
            None,
            "escuelas públicas de enseñanza fundamental y media dentro del distrito",
        ),
        (
            "escuelas_basica_por_10mil",
            "escuelas_basica_por_10mil",
            "codigo_equipamento",
            "F40",
            "Escuelas por 10 mil hab.",
            "observado",
            ["F41"],
            f"escuelas de enseñanza fundamental y media {por_10mil}",
        ),
        (
            "centros_deportivos",
            "centros_deportivos",
            "id_equipamiento",
            "F33",
            "Centros",
            "observado",
            None,
            "centros deportivos y balnearios dentro del distrito",
        ),
        (
            "estadios",
            "estadios",
            "id_equipamiento",
            "F34",
            "Estadios",
            "observado",
            None,
            "clubes con estadio dentro del distrito",
        ),
        (
            "ferias",
            "ferias",
            "cantidad",
            "F21",
            "Ferias",
            "observado",
            None,
            "ferias libres del distrito según la tabla de Infocidade",
        ),
        (
            "ferias_por_10mil",
            "ferias_por_10mil",
            "cantidad",
            "F21",
            "Ferias por 10 mil hab.",
            "observado",
            ["F41"],
            f"ferias libres {por_10mil}",
        ),
        (
            "mercados",
            "mercados",
            "cantidad",
            "F21",
            "Mercados",
            "observado",
            None,
            "mercados y sacolões municipales del distrito",
        ),
        (
            "shoppings",
            "shoppings",
            "id_shopping",
            "F22",
            "Shoppings",
            "observado",
            None,
            "shoppings del censo de ABRASCE ubicados en el distrito",
        ),
        (
            "abl_shoppings",
            "abl_shoppings_m2",
            "abl_m2",
            "F22",
            "m² de ABL",
            "observado",
            None,
            "suma del área bruta locable de los shoppings del distrito",
        ),
    ]
    registros = []
    for codigo, fila in res.iterrows():
        nivel = "municipio" if codigo == "MSP" else "distrito"
        nombre = "Município de São Paulo" if codigo == "MSP" else nombres_dist[codigo]
        for clave, columna, campo, fuente, unidad, tipo, adicionales, calculo in metricas:
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago=campo,
                    valor=fila[columna],
                    unidad=unidad,
                    nivel=nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id=fuente,
                    vigencia=vig[fuente],
                    tipo=tipo,
                    calculo=calculo,
                    fuentes_adicionales=adicionales,
                )
            )
    cabecera = {"seccion": "equipamientos", "pregunta": "P1", "generado": dt.date.today().isoformat()}
    publicar("indicadores/equipamientos/distritos.json", {**cabecera, "indicadores": registros})

    capas = {
        "escuelas_infantil": ("F39", ["codigo_equipamento", "nombre", "direccion"]),
        "escuelas_basica": ("F40", ["codigo_equipamento", "nombre", "direccion"]),
        "centros_deportivos": ("F33", ["nombre", "tipo", "direccion"]),
        "estadios": ("F34", ["nombre", "tipo", "direccion"]),
    }
    for nombre, (fuente, columnas) in capas.items():
        gdf = calculos_p1.capa(nombre)
        publicar_geo(f"equipamientos/{nombre}.geojson", gdf[[*columnas, "geometry"]], fuente)


ADVERTENCIA_DOMICILIOS_FAVELA = "No se sabe si los domicilios de la capa son un conteo o una estimación de HABITASAMPA."


def construir_gente():
    """Favelas por distrito (F32), población histórica (F01), IDHM (F07) y nacimientos (F18-F20)."""
    res = calculos_equipamientos.favelas_por_distrito()
    nombres_dist, _ = nombres_visibles()
    vig = vigencia_descarga("geosampa_favelas")
    metricas = [
        (
            "favelas",
            "favelas",
            "id_favela",
            "Favelas",
            "observado",
            None,
            "favelas cuya mayor parte está en el distrito",
        ),
        (
            "domicilios_favela",
            "domicilios_favela",
            "domicilios",
            "Domicilios",
            "estimado",
            None,
            "domicilios de las favelas del distrito; una favela que cruza el límite se reparte por área",
        ),
        (
            "domicilios_favela_pct",
            "domicilios_favela_pct",
            "domicilios",
            "% de los domicilios",
            "estimado",
            ["F41"],
            "domicilios en favelas / domicilios del censo 2022 (F41) × 100",
        ),
        (
            "area_favela_pct",
            "area_favela_pct",
            "area_m2",
            "% del área",
            "observado",
            None,
            "área de favelas en el distrito / área del distrito × 100",
        ),
    ]
    registros = []
    for codigo, fila in res.iterrows():
        nivel = "municipio" if codigo == "MSP" else "distrito"
        nombre = "Município de São Paulo" if codigo == "MSP" else nombres_dist[codigo]
        for clave, columna, campo, unidad, tipo, adicionales, calculo in metricas:
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago=campo,
                    valor=fila[columna],
                    unidad=unidad,
                    nivel=nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id="F32",
                    vigencia=vig,
                    tipo=tipo,
                    calculo=calculo,
                    fuentes_adicionales=adicionales,
                    advertencia=ADVERTENCIA_DOMICILIOS_FAVELA if campo == "domicilios" else None,
                )
            )
    cabecera = {"seccion": "gente", "pregunta": "", "generado": dt.date.today().isoformat()}
    publicar("indicadores/gente/distritos.json", {**cabecera, "indicadores": registros})

    # F28 (área construida residencial) sigue en el lago, pero el sitio ya no la muestra: es una sola cifra
    # para la ciudad, sin relación con P1 ni P2.
    construir_poblacion_historica(cabecera)
    construir_idhm(cabecera)
    construir_nacimientos(cabecera)

    # Con el nombre (excepción del equipo en config.PUBLICACION_AUTORIZADA), pero sin la calle ni la
    # propiedad del terreno, que son Sensibles: publicar_geo los quita.
    publicar_geo("gente/favelas.geojson", calculos_p1.capa("favelas"), "F32", tolerancia_m=3)


# (campo del lago, nivel, código, nombre). Las cuatro columnas de F01 son cuatro territorios distintos.
TERRITORIOS_F01 = [
    ("poblacion_brasil", "pais", "BR", "Brasil"),
    ("poblacion_estado_sp", "estado", "SP", "Estado de São Paulo"),
    ("poblacion_rm_sp", "region_metropolitana", "RMSP", "Região Metropolitana de São Paulo"),
    ("poblacion_municipio_sp", "municipio", "MSP", "Município de São Paulo"),
]
ADVERTENCIA_RM = "La Región Metropolitana se creó en 1973: la fuente trae su cifra desde 1980."


def construir_poblacion_historica(cabecera: dict):
    """F01: población de cada censo desde 1872. Las cifras que la fuente no tiene (RM antes de 1980) no se publican."""
    df = pd.read_csv(LAGO / "poblacion_historica.csv")
    registros = []
    for fila in df.itertuples():
        for campo, nivel, codigo, nombre in TERRITORIOS_F01:
            valor = getattr(fila, campo)
            if pd.isna(valor):
                continue
            registros.append(
                indicador(
                    clave="poblacion_historica",
                    campo_lago=campo,
                    valor=valor,
                    unidad="Personas",
                    nivel=nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id="F01",
                    vigencia=fila.anio,
                    advertencia=ADVERTENCIA_RM if nivel == "region_metropolitana" else None,
                )
            )
    publicar("indicadores/gente/poblacion_historica.json", {**cabecera, "indicadores": registros})


# La Subprefeitura de Sapopemba se creó en 2013, después del Atlas: en F07 «Vila Prudente» la incluye.
CODIGO_VILA_PRUDENTE = "29"
ADVERTENCIA_VILA_PRUDENTE = (
    "En esta fuente la Prefeitura Regional de Vila Prudente incluye el distrito de Sapopemba, "
    "que desde 2013 es una subprefeitura aparte y no tiene cifra propia."
)


def construir_idhm(cabecera: dict):
    """F07: IDHM y IDHM Renda de 2000 y 2010 por Prefeitura Regional, que equivale a la subprefeitura."""
    df = pd.read_csv(LAGO / "idhm.csv")
    df["nivel"] = df["prefeitura_regional"].map(lambda n: "municipio" if n == "MSP" else "subprefeitura")
    df = unir_subprefeituras(df, "prefeitura_regional")
    _, nombres_sub = nombres_visibles()
    registros = []
    for fila in df.itertuples():
        if fila.nivel == "municipio":
            codigo, nombre = "MSP", "Município de São Paulo"
        else:
            codigo = fila.codigo_subprefeitura
            nombre = nombres_sub[codigo]
        advertencia = ADVERTENCIA_VILA_PRUDENTE if codigo == CODIGO_VILA_PRUDENTE else None
        for campo in ("idhm", "idhm_renda"):
            registros.append(
                indicador(
                    campo_lago=campo,
                    valor=getattr(fila, campo),
                    unidad="Índice 0–1",
                    nivel=fila.nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id="F07",
                    vigencia=fila.anio,
                    advertencia=advertencia,
                )
            )
    publicar("indicadores/gente/idhm.json", {**cabecera, "indicadores": registros})


FUENTE_NACIMIENTOS = {2025: "F18", 2024: "F19", 2023: "F20"}
# Desde este porcentaje de nacimientos sin distrito, las cifras por distrito llevan la advertencia.
UMBRAL_SIN_UBICACION_PCT = 1
ADVERTENCIA_POBLACION_TASA = "La población es la del censo 2022, no la del año de los nacimientos."


def poblacion_censo_por_distrito() -> pd.Series:
    """Población del censo 2022 (F41) por código de distrito."""
    sectores = gpd.read_file(
        LAGO_GEO / "densidad_sectores.geojson", columns=["codigo_distrito", "poblacion"], ignore_geometry=True
    )
    return sectores.groupby("codigo_distrito")["poblacion"].sum()


def construir_nacimientos(cabecera: dict):
    """F18-F20: nacidos vivos por distrito y año, y por mil habitantes.

    tipo_parto es Sensible: el total es la suma de los tres tipos y el tipo no sale del lago.
    """
    df = pd.read_csv(LAGO / "nacimientos_tipo_parto.csv")
    total = df.groupby(["anio", "nivel", "unidad_territorial"], as_index=False)["nacidos_vivos"].sum()
    total = unir_distritos(total)
    nombres_dist, _ = nombres_visibles()
    poblacion = poblacion_censo_por_distrito()
    registros = []
    for anio, grupo in total.groupby("anio"):
        fuente = FUENTE_NACIMIENTOS[anio]
        en_municipio = int(grupo.loc[grupo["nivel"] == "municipio", "nacidos_vivos"].iloc[0])
        sin_distrito = int(grupo.loc[grupo["nivel"] == "sin_ubicacion", "nacidos_vivos"].iloc[0])
        pct_sin = 100 * sin_distrito / en_municipio
        aviso = None
        if pct_sin >= UMBRAL_SIN_UBICACION_PCT:
            porcentaje = f"{pct_sin:.1f}".replace(".", ",")
            aviso = (
                f"El {porcentaje} % de los nacimientos del año no tiene distrito conocido y no entra en las cifras "
                "por distrito, que por eso quedan por debajo de lo real."
            )
        territorios = [("municipio", "MSP", "Município de São Paulo", en_municipio, int(poblacion.sum()), None)]
        for fila in grupo[grupo["nivel"] == "distrito"].itertuples():
            codigo = fila.codigo_distrito
            territorios.append(
                ("distrito", codigo, nombres_dist[codigo], int(fila.nacidos_vivos), int(poblacion[codigo]), aviso)
            )
        comunes = {"fuente_id": fuente, "vigencia": anio}
        for nivel, codigo, nombre, nacidos, habitantes, advertencia in territorios:
            territorio = {"nivel": nivel, "codigo": codigo, "nombre": nombre}
            registros.append(
                indicador(
                    campo_lago="nacidos_vivos",
                    valor=nacidos,
                    unidad="Nacimientos",
                    calculo="suma de los nacidos vivos de los tres tipos de parto (vaginal, cesárea e ignorado)",
                    advertencia=advertencia,
                    **territorio,
                    **comunes,
                )
            )
            registros.append(
                indicador(
                    clave="nacidos_vivos_por_mil_hab",
                    campo_lago="nacidos_vivos",
                    valor=1000 * nacidos / habitantes,
                    unidad="Nacimientos por mil hab.",
                    tipo="estimado",
                    calculo="nacidos vivos del año / población del censo 2022 (F41) × 1.000",
                    fuentes_adicionales=["F41"],
                    advertencia=" ".join(a for a in (ADVERTENCIA_POBLACION_TASA, advertencia) if a),
                    **territorio,
                    **comunes,
                )
            )
        registros.append(
            indicador(
                clave="nacidos_vivos_sin_ubicacion_pct",
                campo_lago="nacidos_vivos",
                valor=pct_sin,
                unidad="% de los nacimientos",
                nivel="municipio",
                codigo="MSP",
                nombre="Município de São Paulo",
                calculo="nacidos vivos de la fila sin distrito / nacidos vivos del municipio × 100",
                **comunes,
            )
        )
    publicar("indicadores/gente/nacimientos.json", {**cabecera, "indicadores": registros})


FUENTE_VEGETACION = {2020: "F25", 2015: "F26", 2010: "F27"}


def construir_ambiente():
    """Cobertura vegetal por habitante por subprefeitura (F25-F27). Cada año es un método distinto."""
    df = pd.read_csv(LAGO / "cobertura_vegetal.csv")
    df = unir_subprefeituras(df)
    _, nombres_sub = nombres_visibles()
    registros = []
    for fila in df.itertuples():
        codigo = "MSP" if fila.nivel == "municipio" else fila.codigo_subprefeitura
        nombre = "Município de São Paulo" if codigo == "MSP" else nombres_sub[codigo]
        fuente = FUENTE_VEGETACION[fila.anio]
        comunes = {"nivel": fila.nivel, "codigo": codigo, "nombre": nombre, "fuente_id": fuente, "vigencia": fila.anio}
        registros.append(
            indicador(
                clave="cobertura_vegetal_por_hab",
                campo_lago="cobertura_vegetal_m2",
                valor=fila.cobertura_vegetal_m2 / fila.poblacion,
                unidad="m² por habitante",
                calculo="cobertura_vegetal_m2 / poblacion (de la misma tabla)",
                **comunes,
            )
        )
        registros.append(
            indicador(
                clave="cobertura_vegetal_km2",
                campo_lago="cobertura_vegetal_m2",
                valor=fila.cobertura_vegetal_m2 / 1e6,
                unidad="km²",
                calculo=f"cobertura_vegetal_m2 / 1.000.000; método: {fila.metodo_cobertura}",
                **comunes,
            )
        )
    cabecera = {"seccion": "ambiente", "pregunta": "", "generado": dt.date.today().isoformat()}
    publicar("indicadores/ambiente/subprefeituras.json", {**cabecera, "indicadores": registros})


# Normal climatológica de la OMM: promedio de 30 años seguidos. La fuente publica la de 1991-2020.
NORMAL_DESDE, NORMAL_HASTA = 1991, 2020
ESTACION_F06 = "Estación del IAG en Água Funda"


def construir_temperatura():
    """Temperatura mínima media del aire (F06): por mes, por año, normal 1991-2020 y diferencia con la normal.

    Es una sola estación meteorológica (IAG, USP), no la ciudad: la advertencia de F06 sale en cada cifra.
    Las normales y los promedios anuales se recalculan de los doce meses de cada año.
    """
    df = pd.read_csv(LAGO / "temperatura_minima.csv")
    comunes = {
        "campo_lago": "temp_min_media_c",
        "unidad": "°C",
        "nivel": "municipio",
        "codigo": "MSP",
        "nombre": ESTACION_F06,
        "fuente_id": "F06",
    }
    registros = []
    for fila in df.itertuples():
        registros.append(
            indicador(
                clave="temp_min_mes", valor=fila.temp_min_media_c, vigencia=f"{fila.anio}-{fila.mes:02d}", **comunes
            )
        )

    anual = df.groupby("anio")["temp_min_media_c"].agg(["mean", "count"])
    anual = anual[anual["count"] == 12]["mean"]  # solo años con los doce meses
    for anio, valor in anual.items():
        registros.append(
            indicador(
                clave="temp_min_anual",
                valor=valor,
                vigencia=anio,
                calculo="promedio de los 12 promedios mensuales del año",
                **comunes,
            )
        )

    ventana = f"{NORMAL_DESDE}-{NORMAL_HASTA}"
    de_la_normal = df[df["anio"].between(NORMAL_DESDE, NORMAL_HASTA)]
    if not (de_la_normal.groupby("mes").size() == NORMAL_HASTA - NORMAL_DESDE + 1).all():
        raise ValueError(f"F06: faltan meses en los años de la normal {ventana}")
    normal_mes = de_la_normal.groupby("mes")["temp_min_media_c"].mean()
    for mes, valor in normal_mes.items():
        registros.append(
            indicador(
                clave=f"temp_min_normal_m{mes:02d}",
                valor=valor,
                vigencia=ventana,
                calculo=f"promedio de ese mes en los {NORMAL_HASTA - NORMAL_DESDE + 1} años {ventana}",
                **comunes,
            )
        )
    normal_anual = normal_mes.mean()
    registros.append(
        indicador(
            clave="temp_min_normal_anual",
            valor=normal_anual,
            vigencia=ventana,
            calculo=f"promedio de las 12 normales mensuales {ventana}",
            **comunes,
        )
    )
    for anio, valor in anual.items():
        registros.append(
            indicador(
                clave="temp_min_anual_vs_normal",
                valor=valor - normal_anual,
                vigencia=anio,
                calculo=f"promedio anual del año menos la normal {ventana}",
                **comunes,
            )
        )
    cabecera = {"seccion": "ambiente", "pregunta": "", "generado": dt.date.today().isoformat()}
    publicar("indicadores/ambiente/temperatura.json", {**cabecera, "indicadores": registros})


# --- P2: dónde conviene montar un negocio ---------------------------------------------------------------
# Dos perfiles, cada uno el promedio de percentiles (0-100) de sus componentes entre los 96 distritos. Es un
# indicador PROXY: dice dónde hay demanda y acceso, no dónde un negocio es rentable (no hay arriendos, ingresos
# ni sectores en el lago). El cambio del empleo por distrito no entra: la RAIS registra los empleos donde está la
# sede de la empresa, y una mudanza de sede mueve cientos de miles de empleos de un año a otro (Sé, Brás).
PERFILES_NEGOCIO = {
    "indice_barrio": {
        "componentes": {
            "poblacion": 1,
            "densidad_hab_km2": 1,
            "establecimientos_por_mil_hab": -1,
            "cobertura_poblacion_pct": 1,
        },
        "calculo": "promedio de percentiles entre los 96 distritos: población, densidad, cobertura de transporte "
        "y, al revés, establecimientos formales por mil habitantes (menos competencia, más puntos)",
        "fuente": "F41",
        "campo": "poblacion",
        "adicionales": ["F11", "F30", "F36"],
    },
    "indice_trabajadores": {
        "componentes": {"empleos_formales": 1, "empleos_por_hab": 1, "cobertura_poblacion_metro_pct": 1},
        "calculo": "promedio de percentiles entre los 96 distritos: empleos formales, empleos por habitante y "
        "población a 500 m del metro",
        "fuente": "F12",
        "campo": "empleos_formales",
        "adicionales": ["F41", "F36"],
    },
}
ADVERTENCIA_PERFIL = (
    "Índice relativo entre distritos (0-100), no rentabilidad: no incluye arriendos, ingresos ni sector económico. "
    "La RAIS cuenta los empleos donde la empresa registra su sede."
)


def tabla_distritos() -> pd.DataFrame:
    """Población, transporte, equipamientos, favelas y empleo 2024 por distrito, desde lo ya calculado."""
    cob = pd.read_csv(DERIVADOS / "cobertura_transporte_distrito.csv", dtype={"codigo_distrito": str})
    equ = pd.read_csv(DERIVADOS / "equipamientos_distrito.csv", dtype={"codigo_distrito": str})
    fav = pd.read_csv(DERIVADOS / "favelas_distrito.csv", dtype={"codigo_distrito": str})
    emp = leer_por_unidad("establecimientos_empleos.csv")
    anio_empleo = int(emp["anio"].max())
    emp = emp[(emp.nivel == "distrito") & (emp.anio == anio_empleo)][
        ["codigo_distrito", "empleos_formales", "establecimientos_formales"]
    ]
    t = (
        cob.merge(equ.drop(columns=["area_km2", "poblacion"]), on="codigo_distrito")
        .merge(fav.drop(columns=["area_km2"]), on="codigo_distrito")
        .merge(emp, on="codigo_distrito")
        .set_index("codigo_distrito")
    )
    if len(t) != 96:
        raise ValueError(f"tabla_distritos: {len(t)} distritos en lugar de 96")
    t["empleos_por_hab"] = t.empleos_formales / t.poblacion
    t["establecimientos_por_mil_hab"] = t.establecimientos_formales / t.poblacion * 1000
    t.attrs["anio_empleo"] = anio_empleo
    return t


def construir_invertir():
    t = tabla_distritos()
    anio = t.attrs["anio_empleo"]
    nombres_dist, _ = nombres_visibles()
    vig_censo = "2022"
    registros = []

    def agregar(clave, valor, unidad, codigo, nombre, nivel, **extra):
        registros.append(
            indicador(clave=clave, valor=valor, unidad=unidad, nivel=nivel, codigo=codigo, nombre=nombre, **extra)
        )

    # Componentes nuevos: empleo y competencia por habitante (empleo de un año, población del censo 2022).
    msp = t[["empleos_formales", "establecimientos_formales", "poblacion"]].sum()
    filas = [(c, nombres_dist[c], "distrito", f) for c, f in t.iterrows()]
    filas.append(("MSP", "Município de São Paulo", "municipio", None))
    for codigo, nombre, nivel, fila in filas:
        emp_hab = fila.empleos_por_hab if fila is not None else msp.empleos_formales / msp.poblacion
        est_mil = (
            fila.establecimientos_por_mil_hab
            if fila is not None
            else msp.establecimientos_formales / msp.poblacion * 1000
        )
        agregar(
            "empleos_por_hab",
            emp_hab,
            "empleos por habitante",
            codigo,
            nombre,
            nivel,
            campo_lago="empleos_formales",
            fuente_id="F12",
            vigencia=anio,
            tipo="estimado",
            fuentes_adicionales=["F41"],
            calculo=f"empleos formales {anio} / población del censo {vig_censo}",
            advertencia="Más de 1 indica un distrito «oficina»: llega más gente a trabajar de la que vive.",
        )
        agregar(
            "establecimientos_por_mil_hab",
            est_mil,
            "establecimientos por mil habitantes",
            codigo,
            nombre,
            nivel,
            campo_lago="establecimientos_formales",
            fuente_id="F11",
            vigencia=anio,
            tipo="estimado",
            fuentes_adicionales=["F41"],
            calculo=f"establecimientos formales {anio} / población del censo {vig_censo} × 1.000",
        )

    for clave, perfil in PERFILES_NEGOCIO.items():
        partes = [
            t[c].rank(pct=True) * 100 if s > 0 else (1 - t[c].rank(pct=True)) * 100 + 100 / len(t)
            for c, s in perfil["componentes"].items()
        ]
        puntaje = pd.concat(partes, axis=1).mean(axis=1)
        for codigo, valor in puntaje.items():
            agregar(
                clave,
                valor,
                "puntos (0-100)",
                codigo,
                nombres_dist[codigo],
                "distrito",
                campo_lago=perfil["campo"],
                fuente_id=perfil["fuente"],
                vigencia=anio,
                tipo="proxy",
                fuentes_adicionales=perfil["adicionales"],
                calculo=perfil["calculo"],
                advertencia=ADVERTENCIA_PERFIL,
            )
    cabecera = {"seccion": "invertir", "pregunta": "P2", "generado": dt.date.today().isoformat()}
    publicar("indicadores/invertir/distritos.json", {**cabecera, "indicadores": registros})


# --- P3: ¿los distritos con más favelas reciben menos? ---------------------------------------------------
# Se comparan el 25 % de los distritos con más domicilios en favelas y el 25 % con menos. Cada tasa se calcula
# sobre la suma del grupo (ponderada por población), no como promedio de tasas.
TASAS_EQUIDAD = {
    "cobertura_poblacion": (
        "poblacion_cubierta",
        "poblacion",
        100,
        "% de la población",
        "F41",
        "poblacion",
        ["F30", "F36"],
        "población a 500 m de una parada o estación / población",
    ),
    "cobertura_poblacion_metro": (
        "poblacion_cubierta_metro",
        "poblacion",
        100,
        "% de la población",
        "F41",
        "poblacion",
        ["F36"],
        "población a 500 m del metro / población",
    ),
    "escuelas_infantil_por_10mil": (
        "escuelas_infantil",
        "poblacion",
        10_000,
        "escuelas por 10 mil habitantes",
        "F39",
        "codigo_equipamento",
        ["F41"],
        "escuelas infantiles públicas / población × 10.000",
    ),
    "escuelas_basica_por_10mil": (
        "escuelas_basica",
        "poblacion",
        10_000,
        "escuelas por 10 mil habitantes",
        "F40",
        "codigo_equipamento",
        ["F41"],
        "escuelas públicas fundamental y media / población × 10.000",
    ),
    "centros_deportivos_por_100mil": (
        "centros_deportivos",
        "poblacion",
        100_000,
        "centros por 100 mil habitantes",
        "F33",
        "id_equipamiento",
        ["F41"],
        "centros deportivos / población × 100.000",
    ),
    "empleos_por_hab": (
        "empleos_formales",
        "poblacion",
        1,
        "empleos por habitante",
        "F12",
        "empleos_formales",
        ["F41"],
        "empleos formales / población del censo 2022",
    ),
}
GRUPOS_FAVELAS = {
    "mas_favelas": "El 25 % de los distritos con más domicilios en favelas",
    "menos_favelas": "El 25 % de los distritos con menos domicilios en favelas",
    "MSP": "Município de São Paulo",
}


def construir_equidad():
    t = tabla_distritos()
    corte_alto = t.domicilios_favela_pct.quantile(0.75)
    corte_bajo = t.domicilios_favela_pct.quantile(0.25)
    grupos = {
        "mas_favelas": t[t.domicilios_favela_pct >= corte_alto],
        "menos_favelas": t[t.domicilios_favela_pct <= corte_bajo],
        "MSP": t,
    }
    vig = {"F41": "2022", "F30": vigencia_descarga("geosampa_ponto_onibus"), "F12": str(t.attrs["anio_empleo"])}
    registros = []
    for codigo, g in grupos.items():
        nombre = f"{GRUPOS_FAVELAS[codigo]} ({len(g)} distritos)" if codigo != "MSP" else GRUPOS_FAVELAS[codigo]
        nivel = "municipio" if codigo == "MSP" else "grupo"
        registros.append(
            indicador(
                clave="domicilios_favela_pct",
                campo_lago="domicilios",
                valor=g.domicilios_favela.sum() / g.domicilios.sum() * 100,
                unidad="% de los domicilios",
                nivel=nivel,
                codigo=codigo,
                nombre=nombre,
                fuente_id="F32",
                vigencia="2022",
                tipo="estimado",
                fuentes_adicionales=["F41"],
                calculo="domicilios en favelas del grupo / domicilios del censo del grupo × 100",
            )
        )
        for clave, (num, den, escala, unidad, fuente, campo, adic, calc) in TASAS_EQUIDAD.items():
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago=campo,
                    valor=g[num].sum() / g[den].sum() * escala,
                    unidad=unidad,
                    nivel=nivel,
                    codigo=codigo,
                    nombre=nombre,
                    fuente_id=fuente,
                    vigencia=vig.get(fuente, "2026"),
                    tipo="estimado",
                    fuentes_adicionales=adic,
                    calculo=f"{calc}, sumando los distritos del grupo",
                )
            )
    # Por distrito, para el gráfico de dispersión: % de domicilios en favelas contra cada tasa.
    nombres_dist, _ = nombres_visibles()
    for codigo, fila in t.iterrows():
        for clave, (num, den, escala, unidad, fuente, campo, adic, calc) in TASAS_EQUIDAD.items():
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago=campo,
                    valor=fila[num] / fila[den] * escala,
                    unidad=unidad,
                    nivel="distrito",
                    codigo=codigo,
                    nombre=nombres_dist[codigo],
                    fuente_id=fuente,
                    vigencia=vig.get(fuente, "2026"),
                    tipo="estimado",
                    fuentes_adicionales=adic,
                    calculo=calc,
                )
            )
        registros.append(
            indicador(
                clave="domicilios_favela_pct",
                campo_lago="domicilios",
                valor=fila.domicilios_favela_pct,
                unidad="% de los domicilios",
                nivel="distrito",
                codigo=codigo,
                nombre=nombres_dist[codigo],
                fuente_id="F32",
                vigencia="2022",
                tipo="estimado",
                fuentes_adicionales=["F41"],
                calculo="domicilios en favelas / domicilios del censo × 100",
            )
        )
    cabecera = {
        "seccion": "equidad",
        "pregunta": "P3",
        "generado": dt.date.today().isoformat(),
        "corte_mas_favelas_pct": round(float(corte_alto), 2),
        "corte_menos_favelas_pct": round(float(corte_bajo), 2),
    }
    publicar("indicadores/equidad/grupos.json", {**cabecera, "indicadores": registros})


def construir_municipio():
    """F03 salud por red y F04 finanzas del municipio. Dos tablas de ciudad (sin desglose por distrito).

    Salud: un indicador por red y tipo de servicio, más el total por red y el total de la ciudad.
    Finanzas: la serie anual de ingresos y gastos totales, y el detalle por concepto del último año.
    """
    salud = pd.read_csv(LAGO / "salud_establecimientos.csv")
    finanzas = pd.read_csv(LAGO / "finanzas_municipio.csv")
    registros = []
    muni = {"nivel": "municipio", "codigo": "MSP", "nombre": "Município de São Paulo", "fuente_id": "F03"}

    # Salud: total de la ciudad, total por red y detalle por red y tipo de servicio (año 2025).
    registros.append(
        indicador(
            clave="salud_establecimientos_total",
            campo_lago="establecimientos",
            valor=int(salud["establecimientos"].sum()),
            unidad="Establecimientos",
            vigencia=2025,
            calculo="suma de los establecimientos de todas las redes y tipos de servicio",
            **muni,
        )
    )
    for red, grupo in salud.groupby("red"):
        registros.append(
            indicador(
                clave=f"salud_establecimientos_red_{red.lower()}",
                campo_lago="establecimientos",
                valor=int(grupo["establecimientos"].sum()),
                unidad="Establecimientos",
                vigencia=2025,
                calculo=f"establecimientos de la red {red} (suma de sus tipos de servicio)",
                **muni,
            )
        )

    # Finanzas: serie anual del total de ingresos y del total de gastos.
    for tipo, grupo in finanzas.groupby("tipo"):
        por_anio = grupo.groupby("anio")["valor_rs"].sum()
        clave = "finanzas_ingresos" if tipo == "Receita" else "finanzas_gastos"
        etiqueta = "Ingresos" if tipo == "Receita" else "Gastos"
        for anio, total in por_anio.items():
            registros.append(
                indicador(
                    clave=clave,
                    campo_lago="valor_rs",
                    valor=None if pd.isna(total) else float(total),
                    unidad="R$",
                    nivel="municipio",
                    codigo="MSP",
                    nombre="Município de São Paulo",
                    fuente_id="F04",
                    vigencia=int(anio),
                    calculo=f"suma de valor_rs de todos los conceptos de {etiqueta.lower()} en el año",
                )
            )

    cabecera = {"seccion": "municipio", "pregunta": "", "generado": dt.date.today().isoformat()}
    publicar("indicadores/municipio/indicadores.json", {**cabecera, "indicadores": registros})

    # Tablas de detalle para la sección: salud por red y tipo, y finanzas por concepto del último año.
    salud_detalle = salud.to_dict(orient="records")
    ultimo = int(finanzas["anio"].max())
    fin = finanzas[finanzas["anio"] == ultimo].copy()
    fin["valor_rs"] = fin["valor_rs"].astype("Float64")
    finanzas_detalle = [
        {
            "anio": int(r["anio"]),
            "tipo": r["tipo"],
            "concepto": r["concepto"],
            "valor_rs": None if pd.isna(r["valor_rs"]) else float(r["valor_rs"]),
        }
        for r in fin.to_dict(orient="records")
    ]
    publicar(
        "indicadores/municipio/detalle.json",
        {
            **cabecera,
            "salud_vigencia": "2025",
            "finanzas_anio": ultimo,
            "salud": salud_detalle,
            "finanzas": finanzas_detalle,
        },
    )


# Fuentes del lago que el sitio no muestra, y por qué. Las que sí salen se detectan solas (fuentes_publicadas).
MOTIVOS_SOLO_LAGO = {
    "F23": "Está en el lago para comparar shoppings entre años; el sitio muestra solo 2025 (F22).",
    "F24": "Está en el lago para comparar shoppings entre años; el sitio muestra solo 2025 (F22).",
    "F28": "Está en el lago, pero el sitio no la muestra: es una sola cifra para la ciudad, sin relación con P1 ni P2.",
}

# Fuentes rastreadas que no entraron al lago. Ya no están en el Excel (la entrega pide dejar ahí solo lo que
# está en el lago), pero el catálogo del sitio las sigue contando, con su motivo.
FUERA_DEL_LAGO = [
    (
        "F02",
        "Vistas mensuales del artículo «São Paulo» en Wikipedia",
        "Wikimedia",
        "No integrada",
        "No responde ninguna de las preguntas.",
    ),
    (
        "F08",
        "Población estimada de São Paulo (API de Agregados del IBGE)",
        "IBGE",
        "No integrada",
        "La API del IBGE no respondía al integrarla (octubre de 2026); la población sale del censo 2022 (F41).",
    ),
    (
        "F09",
        "API Olho Vivo / GTFS de SPTrans",
        "SPTrans",
        "No integrada",
        "Buses en tiempo real: pide un token que se renueva y un servidor, y el sitio es estático.",
    ),
    (
        "F10",
        "Tráfego mensal do Portal de Dados Abertos",
        "CGM São Paulo",
        "Descartada",
        "Descartada en el catálogo: no responde ninguna de las preguntas.",
    ),
    (
        "F37",
        "Curva maestra (curvas de nivel)",
        "PMSP - SMUL (GeoSampa)",
        "No integrada",
        "Demasiado pesada para un sitio estático.",
    ),
    (
        "F38",
        "Museos",
        "PMSP - SMC (GeoSampa)",
        "Descartada",
        "Descartada por el equipo: lleva el sistema hacia el turismo, fuera de P1 y P2.",
    ),
]


def fuentes_publicadas() -> set[str]:
    """Las fuentes que aparecen en algún indicador o capa de public/data/."""
    usadas = set()
    for ruta in PUBLIC_DATA.rglob("*"):
        if ruta.suffix not in (".json", ".geojson") or "catalogo" in ruta.parts:
            continue
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        if not isinstance(datos, dict):
            continue
        if datos.get("fuente_id"):
            usadas.add(datos["fuente_id"])
        for i in datos.get("indicadores", []):
            usadas.add(i["fuente_id"])
            usadas.update(i.get("fuentes_adicionales") or [])
    return usadas


def construir_catalogo():
    """Va al final: el estado de cada fuente en el sitio sale de lo que de verdad se publicó.

    El sitio muestra «estado_sitio» y, si la fuente no se publica, el motivo. Suma las fuentes que no entraron
    al lago (FUERA_DEL_LAGO), que ya no están en el Excel.
    """
    fuentes = pd.read_csv(FUENTES_CSV, dtype=str).fillna("")
    dicc = pd.read_csv(DICCIONARIO_CSV, dtype=str).fillna("")
    usadas = fuentes_publicadas()
    sin_motivo = set(fuentes["fuente_id"]) - usadas - set(MOTIVOS_SOLO_LAGO)
    if sin_motivo:
        raise ValueError(f"Fuentes del lago sin publicar y sin motivo en MOTIVOS_SOLO_LAGO: {sorted(sin_motivo)}")
    fuentes["estado_sitio"] = ["En el sitio" if f in usadas else "Solo en el lago" for f in fuentes["fuente_id"]]
    fuentes["motivo"] = [MOTIVOS_SOLO_LAGO.get(f, "") if f not in usadas else "" for f in fuentes["fuente_id"]]
    fuera = pd.DataFrame(
        [
            {"fuente_id": f, "nombre": n, "entidad": e, "estado_sitio": estado, "motivo": m}
            for f, n, e, estado, m in FUERA_DEL_LAGO
        ]
    )
    fuentes = pd.concat([fuentes, fuera], ignore_index=True).fillna("").sort_values("fuente_id")
    publicar("catalogo/fuentes.json", fuentes.to_dict(orient="records"))
    publicar("catalogo/diccionario.json", dicc.to_dict(orient="records"))


def main():
    if PUBLIC_DATA.exists():
        shutil.rmtree(PUBLIC_DATA)
    construir_territorio()
    construir_empleo()
    construir_transporte()
    construir_equipamientos()
    construir_gente()
    construir_municipio()
    construir_ambiente()
    construir_temperatura()
    construir_invertir()
    construir_equidad()
    construir_catalogo()


if __name__ == "__main__":
    main()
