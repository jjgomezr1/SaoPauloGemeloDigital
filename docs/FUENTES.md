# Fuentes que usa el gemelo digital

Qué fuente del Diccionario (`data/Diccionario_de_datos_TallerDatos.xlsx`) entra al sitio, para qué sirve y
dónde aparece. Los IDs son los de la hoja «1. Fuentes». El detalle de cada campo está en la hoja
«2. Diccionario» y, ya exportado, en `data/diccionario.csv` y en la sección «Fuentes y método» del sitio.

Resumen: de las 41 fuentes del catálogo, 32 se publican en el sitio, 3 están solo en el lago (F23, F24 y F28) y
6 quedan por fuera (al final, con el motivo). La sección «Fuentes y método» del sitio calcula este estado a
partir de lo que de verdad se publica (`build_web.py`, `MOTIVOS_NO_PUBLICADA`).

## P1. Transporte y equipamientos

¿Qué tan cubierta está la ciudad por transporte público, y dónde se concentran los equipamientos?

| ID | Qué es | Publica | Para qué se usa | Archivo del lago |
|---|---|---|---|---|
| F29 | Recorridos de las líneas de bus | SPTrans, vía GeoSampa | Líneas que pasan por cada distrito y km de red (cada calle una vez). Capa «Red de bus» del mapa 3D. | `geo/buses.geojson` (no se sube: pesa 61 MB) |
| F30 | Paradas de bus | SPTrans, vía GeoSampa | Paradas por distrito y por km²; base de la cobertura a 500 m. Capa «Paradas» del mapa 3D. | `geo/paradas.geojson` |
| F31 | Líneas de tren | CPTM, vía GeoSampa | Capa «Tren CPTM» del mapa 3D. | `geo/tren.geojson` |
| F35 | Líneas de metro | SMUL, vía GeoSampa | Capa «Metro» del mapa 3D, con el color oficial de cada línea. | `geo/metro.geojson` |
| F36 | Estaciones de metro | STM, vía GeoSampa | Estaciones por distrito y cobertura por metro. | `geo/estaciones.geojson` |
| F41 | Población por sector censal, censo 2022 | IBGE, vía GeoSampa | Población cubierta a 500 m de una parada o estación; población y densidad por distrito; denominador de los indicadores «por 10 mil habitantes». | `geo/densidad_sectores.geojson` (no se sube: trae el índice de vulnerabilidad, que es Sensible) |
| F05 | Pasajeros transportados por línea | SPTrans, vía Infocidade | Serie mensual de pasajeros de los buses municipales y las 15 líneas con más pasajeros. No tiene geografía. | `sptrans_pasajeros.csv` |
| F39 | Escuelas públicas de educación infantil | SMUL, vía GeoSampa | Escuelas infantiles por distrito y por 10 mil habitantes. Capa del mapa 3D. | `geo/escuelas_infantil.geojson` |
| F40 | Escuelas públicas de enseñanza fundamental y media | SMUL, vía GeoSampa | Escuelas por distrito y por 10 mil habitantes. Capa del mapa 3D. | `geo/escuelas_basica.geojson` |
| F33 | Centros deportivos y balnearios | SEME, vía GeoSampa | Centros deportivos por distrito. Capa del mapa 3D. | `geo/centros_deportivos.geojson` |
| F34 | Estadios | SEME, vía GeoSampa | Estadios por distrito. Capa del mapa 3D. | `geo/estadios.geojson` |
| F21 | Ferias libres, mercados y sacolões, 2003-2025 | SMDHC/SESANA, vía Infocidade | Ferias por distrito y por 10 mil habitantes; mercados y sacolões por distrito (año 2025). | `ferias_mercados.csv` |
| F22 | Shoppings 2025 (censo de ABRASCE) | ABRASCE, vía Infocidade | Shoppings y área bruta locable (ABL) por distrito. | `shoppings.csv` |
| F23, F24 | Shoppings 2021 y 2017 | ABRASCE, vía Infocidade | Están en el lago, con un identificador común por shopping, para comparar años. El sitio muestra solo 2025. | `shoppings.csv` |

## P2. Empleo formal

¿Cómo se distribuye el empleo formal entre los distritos?

| ID | Qué es | Publica | Para qué se usa | Archivo del lago |
|---|---|---|---|---|
| F11 | Establecimientos formales (RAIS), 2011-2024 | MTE, vía Infocidade | Establecimientos por distrito y año. | `establecimientos_empleos.csv` |
| F12 | Empleos formales (RAIS), 2011-2024 | MTE, vía Infocidade | Empleos por distrito, participación en el municipio, empleos por km² y serie anual. | `establecimientos_empleos.csv` |
| F13, F14, F15 | Empleos formales por sexo: 2024, 2023 y 2022 | MTE, vía Infocidade | Porcentaje de empleos ocupados por mujeres, por distrito. | `empleo_sexo.csv` |
| F16, F17 | Empleos formales por raza o color: 2024 y 2023 | MTE, vía Infocidade | Porcentaje de empleos por raza o color y de personas pretas o pardas, por distrito. | `empleo_raza.csv` (no se sube: el conteo es Sensible) |

Raza o color es un campo Sensible en el Diccionario: el sitio lo muestra solo como porcentaje y suprime toda
categoría con menos de 10 empleos (`UMBRAL_SUPRESION` en `config.py`). Desde 2022 la RAIS cambió la forma de
captar los datos; cada tarjeta lo advierte.

## Gente y ambiente

| ID | Qué es | Publica | Para qué se usa | Archivo del lago |
|---|---|---|---|---|
| F32 | Favelas (polígonos) | SEHAB/HABITASAMPA, vía GeoSampa | Favelas, domicilios en favelas (número y % de los domicilios del censo) y % del área, por distrito. Capa del mapa 3D con el nombre de cada favela, sin su calle. | `geo/favelas.geojson` (no se sube: trae la calle y la propiedad del terreno, que son Sensibles) |
| F28 | Área construida residencial (catastro del IPTU), 1995-2025 | Prefeitura, vía Infocidade | Solo en el lago: el sitio dejó de mostrarla porque es una sola cifra para la ciudad, sin relación con P1 ni P2. | `area_construida_residencial.csv` |
| F01 | Población histórica, 1872-2022 | IBGE (censos), vía Infocidade | Población de cada censo en Brasil, el Estado, la Región Metropolitana y el municipio (la RM desde 1980). Gráfico de la sección Gente. | `poblacion_historica.csv` |
| F07 | IDH municipal (IDHM), 2000 y 2010 | PNUD/FJP/IPEA (Atlas 2013), vía Infocidade | IDHM e IDHM Renda por subprefeitura. La fuente trae 31 prefeituras regionales: Sapopemba (subprefeitura desde 2013) está dentro de Vila Prudente y queda sin cifra. Longevidad y educación están en la fuente, pero no son campos del Diccionario y no se guardan. | `idhm.csv` |
| F18, F19, F20 | Nacidos vivos y tipo de parto: 2025, 2024 y 2023 | SMS (SINASC), vía Infocidade | Nacimientos por distrito y año, y por mil habitantes (población del censo 2022, F41). Solo el total: `tipo_parto` es Sensible. En 2024 y 2025 el 16 % de los nacimientos no tiene distrito (en 2023, 0,05 %). | `nacimientos_tipo_parto.csv` (no se sube: trae el tipo de parto, que es Sensible) |
| F25, F26, F27 | Cobertura vegetal por subprefeitura: 2020, 2015 y 2010 | SVMA, vía Infocidade | Vegetación por habitante y superficie verde por subprefeitura, un año a la vez. | `cobertura_vegetal.csv` |
| F06 | Temperatura mínima media mensual del aire, 1933-2025 | IAG/USP (estación Água Funda), vía Infocidade | Promedio anual, diferencia con la normal 1991-2020 y comparación mes a mes, en la sección Ambiente. | `temperatura_minima.csv` |

Cada año de cobertura vegetal se midió con un método distinto (satélite SPOT en 2010, RapidEye en 2015 y
fotos aéreas de 2017-2018 con LiDAR en 2020). Por eso el sitio no calcula pérdida ni ganancia entre años.

F06 sale de una sola estación meteorológica (IAG, en Água Funda), así que no representa a toda la ciudad:
por eso no hay mapa de temperatura y cada cifra lleva esa advertencia. El sitio recalcula el promedio anual y
la normal 1991-2020 a partir de los doce meses de cada año; el lago guarda solo los meses, como pide el
Diccionario.

## Municipio

Cifras de la ciudad en conjunto (sin desglose por distrito), en la sección «Municipio».

| ID | Qué es | Publica | Para qué se usa | Archivo del lago |
|---|---|---|---|---|
| F03 | Establecimientos y servicios de salud por red, 2025 | SMS, vía Infocidade | Establecimientos de salud por red (municipal, estadual, federal, privada) y por tipo de servicio. | `salud_establecimientos.csv` |
| F04 | Ingresos por fuente y gastos por categoría, 2016-2025 | SF, vía Infocidade | Serie anual de ingresos y gastos del municipio y detalle por concepto del último año. | `finanzas_municipio.csv` |

Las dos son del municipio en conjunto. Salud cuenta establecimientos (no camas ni atenciones) y un mismo
establecimiento puede ofrecer varios servicios. Finanzas está en R$ corrientes, sin ajustar por inflación
(ingresos realizados, gastos empenhados): por eso cada cifra lleva su advertencia y la sección no compara
años directamente.

## Base geográfica (no son fuentes del catálogo)

- **Distritos y subprefeituras** de GeoSampa (WFS): el eje territorial de todo el lago.
- **Mapa base y edificios 3D**: teselas vectoriales de [OpenFreeMap](https://openfreemap.org), hechas con
  datos de © colaboradores de [OpenStreetMap](https://www.openstreetmap.org). Más detalle en
  [COMO_FUNCIONA.md](COMO_FUNCIONA.md#el-mapa-3d).

## Fuentes rastreadas que no entraron al lago

| ID | Qué es | Por qué no está |
|---|---|---|
| F02 | Visitas al artículo «São Paulo» en Wikipedia | No responde ninguna de las preguntas. |
| F08 | Estimación de población del IBGE | La API (`servicodados.ibge.gov.br`) no respondía al integrarla, en octubre de 2026. |
| F09 | Olho Vivo (buses en tiempo real) | Necesita llave y un servidor; el sitio es estático. |
| F10 | Tráfico del portal de datos abiertos | Descartada en el catálogo. |
| F37 | Curvas de nivel | Muy pesada para un sitio estático. |
| F38 | Museos | Descartada por el equipo en el catálogo. |

## Fuentes nuevas propuestas

`GestionGobernanza/Diccionario_de_datos_FuentesNuevas.xlsx` (fuera del repositorio) documenta, con el mismo
formato, nueve fuentes oficiales más para una segunda etapa: atractivos turísticos y equipamientos culturales
de GeoSampa, demanda por estación del Metrô y hospedajes de CADASTUR. Ese archivo numera sus fuentes de F42 a
F50; si se integran al Excel principal, conviene revisar que esos IDs sigan libres.

## El Excel

Desde el 2026-11-03 el Excel tiene solo las 35 fuentes que están en el lago, como pide la entrega:
- todas con estado «Integrada al lago»;
- la fecha de prueba es la de la descarga que usa el lago (la del nombre del crudo en `data/raw/`);
- la licencia es la que declara la fuente, o «no declara» a secas;
- la columna «Archivo o tabla en el lago» del diccionario nombra el archivo real.

Las seis que no entraron (tabla de arriba) siguen en el sitio, en `FUERA_DEL_LAGO` de `build_web.py`.
