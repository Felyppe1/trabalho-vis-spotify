import { iso2to3 } from "../data/iso2to3.js";
import { renderChart1 } from "./grafico1.js";
import { renderChart4 } from "./grafico4.js";
document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  // Função para amostragem aleatória
  function sampleArray(arr, size) {
    const shuffled = arr.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, size);
  }

  // Carregar CSV com progresso usando fetch manualmente
  async function loadCSVWithProgress(url, onProgress) {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Erro ao buscar ${url}: ${response.statusText}`);

    const reader = response.body.getReader();
    const contentLength = +response.headers.get("Content-Length");
    let receivedLength = 0; // bytes lidos
    let chunks = []; // array de Uint8Arrays

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (onProgress) onProgress(receivedLength / contentLength);
    }

    // concatenar chunks em uma string
    let chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }
    let resultString = new TextDecoder("utf-8").decode(chunksAll);
    return d3.csvParse(resultString, d3.autoType);
  }

  async function main() {
    try {
      progressText.textContent = "Carregando CSV do Spotify...";
      const data = await loadCSVWithProgress(
        "./data/spotify.csv",
        (progress) => {
          let p = Math.floor(progress * 100);
          progressBar.style.width = `${p}%`;
          progressText.textContent = `Carregando CSV do Spotify... ${p}%`;
        }
      );
      console.log("CSV carregado:", data.length, "registros");

      progressText.textContent = "Carregando GeoJSON do mundo...";
      progressBar.style.width = `0%`;
      // Para GeoJSON, não temos suporte nativo para progresso, vamos só carregar direto
      const geoData = await d3.json("./data/world.geojson");
      console.log("GeoJSON carregado:", geoData.features.length, "features");

      progressBar.style.width = "100%";
      progressText.textContent = "Dados carregados. Preparando visualização...";
      // Aguarde um pouco pra visualizar 100%
      await new Promise((r) => setTimeout(r, 500));

      loadingOverlay.style.display = "none";

      // Amostragem: pegar 10k registros aleatórios para os gráficos de pontos
      const sampleSize = 10000;
      const sampledData = sampleArray(data, sampleSize);
      console.log("Dados amostrados para visualização:", sampledData.length);

      renderChart1(sampledData);
      renderChart2(sampledData);
      renderChart3(data, geoData); // mapa usa dados completos (agregado)
      renderChart4(data); // top10 artistas - só filtra no método
    } catch (error) {
      console.error("Erro no carregamento dos dados:", error);
      alert("Erro no carregamento dos dados: veja o console");
    }
  }

  main();


  function renderChart2(data) {
    const svg = d3.select("#chart2 svg");
    svg.selectAll("*").remove();

    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };

    // Agrupamento mais detalhado por ano com estatísticas completas
    const statsByYear = d3
      .rollups(
        data.filter((d) => d.album_release_date && d.duration_ms),
        (v) => {
          const durations = v.map((d) => d.duration_ms / 60000); // em minutos
          const avgDuration = d3.mean(durations);

          // Calcular porcentagens por faixa de duração
          const total = v.length;
          const under2 = v.filter((d) => d.duration_ms / 60000 < 2).length;
          const between2and3 = v.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 2 && min < 3;
          }).length;
          const between3and4 = v.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 3 && min < 4;
          }).length;
          const between4and5 = v.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 4 && min < 5;
          }).length;
          const over5 = v.filter((d) => d.duration_ms / 60000 >= 5).length;

          // Encontrar música mais curta e mais longa
          const shortest = v.reduce((a, b) =>
            a.duration_ms < b.duration_ms ? a : b
          );
          const longest = v.reduce((a, b) =>
            a.duration_ms > b.duration_ms ? a : b
          );

          return {
            avgDuration,
            percentages: {
              under2: ((under2 / total) * 100).toFixed(1),
              between2and3: ((between2and3 / total) * 100).toFixed(1),
              between3and4: ((between3and4 / total) * 100).toFixed(1),
              between4and5: ((between4and5 / total) * 100).toFixed(1),
              over5: ((over5 / total) * 100).toFixed(1),
            },
            shortest: {
              name: shortest.name,
              artist: shortest.artists,
              duration: (shortest.duration_ms / 60000).toFixed(2),
            },
            longest: {
              name: longest.name,
              artist: longest.artists,
              duration: (longest.duration_ms / 60000).toFixed(2),
            },
          };
        },
        (d) => new Date(d.album_release_date).getFullYear()
      )
      .sort((a, b) => a[0] - b[0]);

    // Extrair apenas a média para os eixos (compatibilidade com código existente)
    const avgDurationByYear = statsByYear.map((d) => [d[0], d[1].avgDuration]);

    const years = avgDurationByYear.map((d) => d[0]);
    const durations = avgDurationByYear.map((d) => d[1]);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(years))
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([d3.min(durations), d3.max(durations)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line()
      .x((d) => x(d[0]))
      .y((d) => y(d[1]));

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickFormat((d) => `${d.toFixed(1)} min`));

    svg
      .append("path")
      .datum(avgDurationByYear)
      .attr("fill", "none")
      .attr("stroke", "#ff7f0e")
      .attr("stroke-width", 2)
      .attr("d", line); // Tooltip personalizado com estilo melhorado
    const tooltip = d3
      .select("body")
      .selectAll(".tooltip")
      .data([null])
      .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("padding", "10px 12px")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("border-radius", "6px")
      .style("font-size", "13px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.15)")
      .style("max-width", "320px")
      .style("line-height", "1.4");

    svg
      .selectAll("circle")
      .data(avgDurationByYear)
      .join("circle")
      .attr("cx", (d) => x(d[0]))
      .attr("cy", (d) => y(d[1]))
      .attr("r", 4)
      .attr("fill", "#ff7f0e")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#c25100");

        // Buscar estatísticas detalhadas para este ano
        const yearStats = statsByYear.find((s) => s[0] === d[0])[1];

        tooltip
          .style("opacity", 1)
          .html(
            `
            <div style="font-weight: bold; margin-bottom: 8px; color: #333;">${
              d[0]
            }</div>
            <div style="margin-bottom: 6px;"><strong>Duração Média:</strong> ${d[1].toFixed(
              2
            )} min</div>
            
            <div style="margin-bottom: 4px; font-weight: bold; color: #555;">Distribuição por Duração:</div>
            <div style="margin-left: 8px; margin-bottom: 6px;">
              • Menos de 2 min: ${yearStats.percentages.under2}%<br>
              • Entre 2-3 min: ${yearStats.percentages.between2and3}%<br>
              • Entre 3-4 min: ${yearStats.percentages.between3and4}%<br>
              • Entre 4-5 min: ${yearStats.percentages.between4and5}%<br>
              • Mais de 5 min: ${yearStats.percentages.over5}%
            </div>
            
            <div style="margin-bottom: 4px; font-weight: bold; color: #555;">Extremos:</div>
            <div style="margin-left: 8px;">
              <div style="margin-bottom: 3px;">
                <strong>Mais Curta:</strong><br>
                "${yearStats.shortest.name}" - ${yearStats.shortest.artist}<br>
                <span style="color: #666;">${
                  yearStats.shortest.duration
                } min</span>
              </div>
              <div>
                <strong>Mais Longa:</strong><br>
                "${yearStats.longest.name}" - ${yearStats.longest.artist}<br>
                <span style="color: #666;">${
                  yearStats.longest.duration
                } min</span>
              </div>
            </div>
          `
          )
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#ff7f0e");
        tooltip.style("opacity", 0);
      });
  }

  function renderChart3(data, geoData) {
    const svg = d3.select("#chart3 svg");
    svg.selectAll("*").remove();

    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    const projection = d3.geoMercator().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);

    // Obter todos os códigos ISO3 válidos do geoData (feature.id)
    const validCountryCodes = new Set(geoData.features.map((f) => f.id));

    // Filtrar dados que têm país e converte ISO2 para ISO3, e verifica se ISO3 existe no geoData
    const filteredData = data.filter((d) => {
      if (!d.country) return false;
      const iso3 = iso2to3[d.country.trim().toUpperCase()];
      return iso3 && validCountryCodes.has(iso3);
    });

    // Agrupar por país (ISO3), calcular média de popularidade
    const popularityByCountry = d3.rollup(
      filteredData,
      (v) => d3.mean(v, (d) => d.popularity),
      (d) => iso2to3[d.country.trim().toUpperCase()] // converte ISO2 → ISO3 aqui
    );

    const popularityValues = Array.from(popularityByCountry.values());
    const popularityExtent = popularityValues.length
      ? d3.extent(popularityValues)
      : [0, 1];

    const color = d3
      .scaleSequential()
      .interpolator(d3.interpolateYlGnBu)
      .domain(popularityExtent);

    // Tooltip — criar uma vez
    const tooltip = d3
      .select("body")
      .selectAll(".tooltip")
      .data([null])
      .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("padding", "6px 10px")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)");

    // Desenhar os países no mapa
    svg
      .selectAll("path")
      .data(geoData.features)
      .join("path")
      .attr("d", path)
      .attr("fill", (d) => {
        const iso3 = d.id; // geoData usa ISO3 em id
        const val = popularityByCountry.get(iso3);
        return val !== undefined ? color(val) : "#eee";
      })
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);

        const iso3 = d.id;
        const val = popularityByCountry.get(iso3);
        const countryName =
          d.properties.name || d.properties.ADMIN || "Desconhecido";

        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${countryName}</strong><br>Popularidade Média: ${
              val !== undefined ? val.toFixed(2) : "Sem dados"
            }`
          )
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", "#ccc").attr("stroke-width", 0.5);
        tooltip.style("opacity", 0);
      });

    // Legenda (igual ao original)
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
            popularityExtent[0] +
              s * (popularityExtent[1] - popularityExtent[0])
          )
        );
    });

    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legendGradient)")
      .style("stroke", "#ccc");

    const legendScale = d3
      .scaleLinear()
      .domain(popularityExtent)
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    svg
      .append("g")
      .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "12px");

    svg
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 8)
      .text("Popularidade Média por País")
      .style("font-size", "14px")
      .style("fill", "#333");
  }


});
