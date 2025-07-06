import { iso2to3 } from "../data/iso2to3.js";
import { executeQuery } from "./dataLoader.js";

async function renderChart3(geoData, onCountryClick) {
  const svg = d3.select("#chart3 svg");
  svg.selectAll("*").remove();

  if (d3.select("#selectedCountry").empty()) {
    d3.select("#chart3")
      .insert("div", ":first-child")
      .attr("id", "selectedCountry")
      .style("font-size", "16px")
      .style("margin-bottom", "10px")
      .style("font-weight", "bold")
      .text("Clique em um país para ver os detalhes");
  }

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const projection = d3.geoMercator().fitSize([width, height], geoData);
  const path = d3.geoPath().projection(projection);

  const validCountryCodes = new Set(geoData.features.map((f) => f.id));

  const iso3to2 = Object.fromEntries(
    Object.entries(iso2to3).map(([iso2, iso3]) => [iso3, iso2])
  );

  const query = `
    SELECT
        country,
        AVG(popularity) as avg_popularity
    FROM spotify
    WHERE EXTRACT(year FROM CAST(snapshot_date AS DATE)) = 2024 AND country IS NOT NULL
    GROUP BY country
  `;

  const queryResult = await executeQuery(query);

  const popularityByCountry = new Map();
  for (const row of queryResult) {
    if (row.country) {
      const iso3 = iso2to3[row.country.trim().toUpperCase()];
      if (iso3 && validCountryCodes.has(iso3)) {
        popularityByCountry.set(iso3, row.avg_popularity);
      }
    }
  }

  const popularityValues = Array.from(popularityByCountry.values());
  const popularityExtent = popularityValues.length ? d3.extent(popularityValues) : [0, 1];

  const color = d3.scaleSequential(d3.interpolateYlGnBu).domain(popularityExtent);

  const tooltip = d3.select("body").selectAll(".tooltip").data([null]).join("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-size", "14px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("display", "none")
    .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)");

  svg.selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => {
      const iso3 = d.id;
      const val = popularityByCountry.get(iso3);
      return val !== undefined ? color(val) : "#eee";
    })
    .attr("stroke", "#ccc")
    .attr("stroke-width", 0.5)
    .on("mouseover", function (event, d) {
      const iso3 = d.id;
      const val = popularityByCountry.get(iso3);
      if (val === undefined) {
        tooltip.style("opacity", 0).style("display", "none");
        return;
      }

      d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);

      const countryName = d.properties.name || d.properties.ADMIN || "Desconhecido";
      tooltip
        .style("display", "block")
        .style("opacity", 1)
        .html(`<strong>${countryName}</strong><br>Popularidade Média: ${val.toFixed(2)}`)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mousemove", event => {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#ccc").attr("stroke-width", 0.5);
      tooltip.style("opacity", 0).style("display", "none");
    })
    .on("click", function (event, d) {
      const iso3 = d.id;
      const val = popularityByCountry.get(iso3);

      if (val === undefined) {
        // país sem dados: trata como clique fora
        if (typeof onCountryClick === "function") {
          onCountryClick("NENHUM");
          d3.select("#selectedCountry").text("Clique em um país para ver os detalhes");
        }
        return;
      }

      const iso2 = iso3to2[iso3] || iso3;
      const countryName =
        d.properties.name || d.properties.ADMIN || "Desconhecido";

      d3.select("#selectedCountry").text(`País selecionado: ${countryName} (${iso2})`);

      if (typeof onCountryClick === "function") {
        onCountryClick(iso2);
      }
    });

  // Legenda
  const legendWidth = 200;
  const legendHeight = 10;
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legendGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  const stops = d3.range(0, 1.01, 0.1);
  stops.forEach((s) => {
    gradient
      .append("stop")
      .attr("offset", `${s * 100}%`)
      .attr(
        "stop-color",
        color(
          popularityExtent[0] + s * (popularityExtent[1] - popularityExtent[0])
        )
      );
  });

  const legendX = width - legendWidth - 300;
  const legendY = height - 40;

  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legendGradient)")
    .style("stroke", "#ccc");

  const legendScale = d3.scaleLinear().domain(popularityExtent).range([0, legendWidth]);
  const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format(".2f"));

  svg.append("g")
    .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
    .call(legendAxis)
    .selectAll("text").style("font-size", "12px");

  svg.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 8)
    .text("Popularidade Média das Músicas")
    .style("font-size", "14px")
    .style("fill", "#333");
}

export { renderChart3 };
