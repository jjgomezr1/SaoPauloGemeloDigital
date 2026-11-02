"""Municipio: F03 establecimientos de salud por red y F04 finanzas (ingresos y gastos).

Son fuentes del municipio en conjunto: no se abren por distrito (la sección «Municipio» del sitio).

Salidas:
  data/lago/salud_establecimientos.csv, una fila por red y tipo de servicio:
    red, tipo_servicio, establecimientos.
  data/lago/finanzas_municipio.csv, una fila por año, tipo y concepto:
    anio, tipo, concepto, valor_rs.

Ambas tablas de Infocidade traen filas de total (el «995» de salud, los subtotales por bloque de
finanzas): se quitan para no contar dos veces. Los parsers fallan ruidosamente si la estructura de
la fuente cambia, en vez de producir cifras mal leídas.
"""

import re

import pandas as pd

from comun import (
    a_numero,
    descargar,
    es_vacio,
    guardar_lago,
    leer_excel,
    limpiar_espacios,
)

URL_F03 = (
    "https://prefeitura.sp.gov.br/documents/d/licenciamento/tabela-estabelecimentos-e-servicos-de-saude-por-rede-2025"
)
URL_F04 = (
    "https://prefeitura.sp.gov.br/documents/d/licenciamento/1_receita_segundo_fontes_e_despesas_por_categoria_2025-1-"
)

# Las redes son los títulos de bloque de la tabla de salud (una red, debajo sus tipos de servicio).
# El texto de la fuente trae «Rede Municipal», «Rede Estadual», etc.; se guarda la palabra clave.
REDES = {
    "rede municipal": "Municipal",
    "municipal": "Municipal",
    "rede estadual": "Estadual",
    "estadual": "Estadual",
    "rede federal": "Federal",
    "federal": "Federal",
    "rede privada": "Privada",
    "privada": "Privada",
}
# Palabras que marcan una fila de total o subtotal, que no se guarda (evita doble conteo).
TOTALES = ("total", "subtotal")

# F04: los dos bloques de la primera columna.
BLOQUES_F04 = {
    "receita": "Receita",
    "receitas": "Receita",
    "despesa": "Despesa",
    "despesas": "Despesa",
}


def _clave(texto) -> str:
    return limpiar_espacios(str(texto)).lower()


def salud() -> pd.DataFrame:
    """F03: establecimientos de salud por red y tipo de servicio, año 2025.

    La fuente pone cada red como título de bloque y, debajo, una fila por tipo de servicio con su
    conteo a la derecha. Se arrastra la red a cada tipo y se descartan las filas de total.
    """
    ruta = descargar(URL_F03, "f03_salud_por_red", "xls")
    crudo = leer_excel(ruta)
    # La tabla tiene dos columnas útiles: nombre (tipo o título de red) y conteo.
    # Se localiza la primera fila cuyo texto es una red conocida: ahí empieza la tabla.
    primera = crudo[0].fillna("").map(_clave)
    inicio = primera[primera.isin(REDES)].index
    if inicio.empty:
        raise ValueError("F03: no se encontró ninguna fila de red (Municipal, Estadual, Federal, Privada)")
    cuerpo = crudo.iloc[inicio[0] :, :2].copy()
    cuerpo.columns = ["nombre", "conteo"]
    cuerpo["nombre"] = cuerpo["nombre"].map(lambda v: limpiar_espacios(str(v)) if not es_vacio(v) else "")

    filas = []
    red_actual = None
    for nombre, conteo in zip(cuerpo["nombre"], cuerpo["conteo"], strict=True):
        clave = nombre.lower()
        if not nombre:
            continue
        if clave in REDES and es_vacio(conteo):
            # Título de bloque: fija la red y no es un dato.
            red_actual = REDES[clave]
            continue
        if any(t in clave for t in TOTALES):
            continue
        if es_vacio(conteo):
            continue
        if red_actual is None:
            raise ValueError(f"F03: la fila {nombre!r} aparece antes de cualquier título de red")
        filas.append((red_actual, nombre.upper(), int(a_numero(conteo))))

    df = pd.DataFrame(filas, columns=["red", "tipo_servicio", "establecimientos"])
    if df.empty:
        raise ValueError("F03: no se leyó ningún establecimiento; revisa la estructura de la fuente")
    df = df[df["establecimientos"] > 0]
    df = df.groupby(["red", "tipo_servicio"], as_index=False)["establecimientos"].sum()
    return df.sort_values(["red", "tipo_servicio"]).reset_index(drop=True)


def _anios_en_encabezado(fila) -> dict[int, int]:
    """Columnas cuyo encabezado es un año → {columna: año}. F04 trae 2016 … 2025 como columnas."""
    anios = {}
    for col, valor in enumerate(fila):
        texto = "" if es_vacio(valor) else str(valor)
        m = re.fullmatch(r"\s*(20\d{2})(?:[\s·.²¹]*)?", texto)
        if m:
            anios[col] = int(m.group(1))
    return anios


def finanzas() -> pd.DataFrame:
    """F04: ingresos por fuente y gastos por categoría del municipio, 2016-2025.

    La fuente tiene dos bloques («Receitas», «Despesas»); dentro, una fila por concepto y una columna
    por año. Se pasa de ancho a largo y se quitan las filas de total de cada bloque.
    """
    ruta = descargar(URL_F04, "f04_receita_despesa", "xls")
    crudo = leer_excel(ruta)
    # El encabezado de años es la primera fila con varias columnas de año.
    fila_enc = None
    anios = {}
    for i in range(min(15, len(crudo))):
        candidato = _anios_en_encabezado(crudo.iloc[i])
        if len(candidato) >= 3:
            fila_enc, anios = i, candidato
            break
    if fila_enc is None:
        raise ValueError("F04: no se encontró la fila de encabezado con los años (2016 … 2025)")

    cuerpo = crudo.iloc[fila_enc + 1 :]
    filas = []
    tipo_actual = None
    for _, fila in cuerpo.iterrows():
        etiqueta = "" if es_vacio(fila[0]) else limpiar_espacios(str(fila[0]))
        clave = etiqueta.lower()
        if not etiqueta:
            continue
        # Título de bloque: «Receitas» / «Despesas» (sin cifras).
        sin_cifras = all(es_vacio(fila[c]) for c in anios)
        bloque = next((BLOQUES_F04[b] for b in BLOQUES_F04 if clave.startswith(b)), None)
        if bloque and sin_cifras:
            tipo_actual = bloque
            continue
        if any(t in clave for t in TOTALES):
            continue
        if sin_cifras:
            continue
        if tipo_actual is None:
            raise ValueError(f"F04: el concepto {etiqueta!r} aparece antes de «Receitas» o «Despesas»")
        for col, anio in anios.items():
            valor = a_numero(fila[col])  # «1.234.567,89» → 1234567.89; «-» → None
            filas.append((anio, tipo_actual, etiqueta, valor))

    df = pd.DataFrame(filas, columns=["anio", "tipo", "concepto", "valor_rs"])
    if df.empty:
        raise ValueError("F04: no se leyó ningún valor; revisa la estructura de la fuente")
    df["anio"] = df["anio"].astype(int)
    df["valor_rs"] = pd.to_numeric(df["valor_rs"], errors="coerce").astype("Float64")
    return df.sort_values(["tipo", "concepto", "anio"]).reset_index(drop=True)


def main():
    guardar_lago(salud(), "salud_establecimientos.csv")
    guardar_lago(finanzas(), "finanzas_municipio.csv")


if __name__ == "__main__":
    main()
