import { iso2to3 } from "../data/iso2to3.js";
import { grafico2 } from "./grafico2.js";
document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

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
    //   const sampleSize = 10000;
    //   const sampledData = sampleArray(data, sampleSize);
    //   console.log("Dados amostrados para visualização:", sampledData.length);
    // data.forEach(d => console.log(d.album_release_date));
    data.forEach(d => {
        d.album_release_date = new Date(new Date(d.album_release_date).getTime() + 3 * 60 * 60 * 1000);
    });

    // console.log(data.filter(d => d.album_release_date.getFullYear() == 1979))
    //   data.forEach(d => {
    //     d.album_release_date = new Date(d.album_release_date);
    // });
    //   renderChart1(sampledData);
    //   renderChart2(data);
      grafico2(data)
    //   renderChart3(data, geoData); // mapa usa dados completos (agregado)
    //   renderChart4(data); // top10 artistas - só filtra no método
    } catch (error) {
      console.error("Erro no carregamento dos dados:", error);
      alert("Erro no carregamento dos dados: veja o console");
    }
  }

  main();

//   function renderChart1(data) {
//     const svg = d3.select("#chart1 svg");
//     svg.selectAll("*").remove();

//     const width = svg.node().clientWidth;
//     const height = svg.node().clientHeight;
//     const margin = { top: 20, right: 30, bottom: 70, left: 60 };

//     // Filtra top 50 diários
//     const top50 = data.filter((d) => d.daily_rank && d.daily_rank <= 50);

//     // Atributos para analisar
//     const attrs = ["danceability", "energy", "valence", "acousticness"];

//     // Calcula média por atributo
//     const averages = attrs.map((attr) => {
//       const mean = d3.mean(top50, (d) => d[attr]);
//       return { attr, mean };
//     });

//     const x = d3
//       .scaleBand()
//       .domain(attrs)
//       .range([margin.left, width - margin.right])
//       .padding(0.3);

//     const y = d3
//       .scaleLinear()
//       .domain([0, 1])
//       .range([height - margin.bottom, margin.top]);

//     svg
//       .append("g")
//       .attr("transform", `translate(0,${height - margin.bottom})`)
//       .call(d3.axisBottom(x))
//       .selectAll("text")
//       .attr("transform", "rotate(-40)")
//       .style("text-anchor", "end");

//     svg
//       .append("g")
//       .attr("transform", `translate(${margin.left},0)`)
//       .call(d3.axisLeft(y));

//     // Cria tooltip
//     const tooltip = d3
//       .select("body")
//       .selectAll(".tooltip")
//       .data([null])
//       .join("div")
//       .attr("class", "tooltip")
//       .style("position", "absolute")
//       .style("padding", "6px 10px")
//       .style("background", "white")
//       .style("border", "1px solid #ccc")
//       .style("border-radius", "4px")
//       .style("font-size", "14px")
//       .style("pointer-events", "none")
//       .style("opacity", 0)
//       .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)");

//     svg
//       .selectAll("rect")
//       .data(averages)
//       .join("rect")
//       .attr("x", (d) => x(d.attr))
//       .attr("y", (d) => y(d.mean))
//       .attr("width", x.bandwidth())
//       .attr("height", (d) => y(0) - y(d.mean))
//       .attr("fill", "#1db954")
//       .on("mouseover", function (event, d) {
//         d3.select(this).attr("fill", "#14833b");

//         tooltip
//           .style("opacity", 1)
//           .html(`<strong>${d.attr}</strong><br>Média: ${d.mean.toFixed(2)}`)
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mousemove", function (event) {
//         tooltip
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mouseout", function () {
//         d3.select(this).attr("fill", "#1db954");
//         tooltip.style("opacity", 0);
//       });
//   }

//   function renderChart3(data, geoData) {
//     const svg = d3.select("#chart3 svg");
//     svg.selectAll("*").remove();

//     const width = svg.node().clientWidth;
//     const height = svg.node().clientHeight;

//     const projection = d3.geoMercator().fitSize([width, height], geoData);
//     const path = d3.geoPath().projection(projection);

//     // Obter todos os códigos ISO3 válidos do geoData (feature.id)
//     const validCountryCodes = new Set(geoData.features.map((f) => f.id));

//     // Filtrar dados que têm país e converte ISO2 para ISO3, e verifica se ISO3 existe no geoData
//     const filteredData = data.filter((d) => {
//       if (!d.country) return false;
//       const iso3 = iso2to3[d.country.trim().toUpperCase()];
//       return iso3 && validCountryCodes.has(iso3);
//     });

//     // Agrupar por país (ISO3), calcular média de popularidade
//     const popularityByCountry = d3.rollup(
//       filteredData,
//       (v) => d3.mean(v, (d) => d.popularity),
//       (d) => iso2to3[d.country.trim().toUpperCase()] // converte ISO2 → ISO3 aqui
//     );

//     const popularityValues = Array.from(popularityByCountry.values());
//     const popularityExtent = popularityValues.length
//       ? d3.extent(popularityValues)
//       : [0, 1];

//     const color = d3
//       .scaleSequential()
//       .interpolator(d3.interpolateYlGnBu)
//       .domain(popularityExtent);

//     // Tooltip — criar uma vez
//     const tooltip = d3
//       .select("body")
//       .selectAll(".tooltip")
//       .data([null])
//       .join("div")
//       .attr("class", "tooltip")
//       .style("position", "absolute")
//       .style("padding", "6px 10px")
//       .style("background", "white")
//       .style("border", "1px solid #ccc")
//       .style("border-radius", "4px")
//       .style("font-size", "14px")
//       .style("pointer-events", "none")
//       .style("opacity", 0)
//       .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)");

//     // Desenhar os países no mapa
//     svg
//       .selectAll("path")
//       .data(geoData.features)
//       .join("path")
//       .attr("d", path)
//       .attr("fill", (d) => {
//         const iso3 = d.id; // geoData usa ISO3 em id
//         const val = popularityByCountry.get(iso3);
//         return val !== undefined ? color(val) : "#eee";
//       })
//       .attr("stroke", "#ccc")
//       .attr("stroke-width", 0.5)
//       .on("mouseover", function (event, d) {
//         d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);

//         const iso3 = d.id;
//         const val = popularityByCountry.get(iso3);
//         const countryName =
//           d.properties.name || d.properties.ADMIN || "Desconhecido";

//         tooltip
//           .style("opacity", 1)
//           .html(
//             `<strong>${countryName}</strong><br>Popularidade Média: ${
//               val !== undefined ? val.toFixed(2) : "Sem dados"
//             }`
//           )
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mousemove", function (event) {
//         tooltip
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mouseout", function () {
//         d3.select(this).attr("stroke", "#ccc").attr("stroke-width", 0.5);
//         tooltip.style("opacity", 0);
//       });

//     // Legenda (igual ao original)
//     const legendWidth = 200;
//     const legendHeight = 10;

//     const defs = svg.append("defs");
//     const gradient = defs
//       .append("linearGradient")
//       .attr("id", "legendGradient")
//       .attr("x1", "0%")
//       .attr("y1", "0%")
//       .attr("x2", "100%")
//       .attr("y2", "0%");

//     const stops = d3.range(0, 1.01, 0.1);
//     stops.forEach((s) => {
//       gradient
//         .append("stop")
//         .attr("offset", `${s * 100}%`)
//         .attr(
//           "stop-color",
//           color(
//             popularityExtent[0] +
//               s * (popularityExtent[1] - popularityExtent[0])
//           )
//         );
//     });

//     const legendX = width - legendWidth - 20;
//     const legendY = height - 40;

//     svg
//       .append("rect")
//       .attr("x", legendX)
//       .attr("y", legendY)
//       .attr("width", legendWidth)
//       .attr("height", legendHeight)
//       .style("fill", "url(#legendGradient)")
//       .style("stroke", "#ccc");

//     const legendScale = d3
//       .scaleLinear()
//       .domain(popularityExtent)
//       .range([0, legendWidth]);

//     const legendAxis = d3
//       .axisBottom(legendScale)
//       .ticks(5)
//       .tickFormat(d3.format(".2f"));

//     svg
//       .append("g")
//       .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
//       .call(legendAxis)
//       .selectAll("text")
//       .style("font-size", "12px");

//     svg
//       .append("text")
//       .attr("x", legendX)
//       .attr("y", legendY - 8)
//       .text("Popularidade Média por País")
//       .style("font-size", "14px")
//       .style("fill", "#333");
//   }

//   function renderChart4(data) {
//     const svg = d3.select("#chart4 svg");
//     svg.selectAll("*").remove();

//     const width = svg.node().clientWidth;
//     const height = svg.node().clientHeight;
//     const margin = { top: 20, right: 30, bottom: 50, left: 150 };

//     const top10 = data.filter((d) => d.daily_rank <= 10);

//     const counts = d3
//       .rollups(
//         top10,
//         (v) => v.length,
//         (d) => d.artists
//       )
//       .sort((a, b) => d3.descending(a[1], b[1]))
//       .slice(0, 10);

//     const y = d3
//       .scaleBand()
//       .domain(counts.map((d) => d[0]))
//       .range([margin.top, height - margin.bottom])
//       .padding(0.1);

//     const x = d3
//       .scaleLinear()
//       .domain([0, d3.max(counts, (d) => d[1])])
//       .range([margin.left, width - margin.right]);

//     svg
//       .append("g")
//       .attr("transform", `translate(0,${height - margin.bottom})`)
//       .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));

//     svg
//       .append("g")
//       .attr("transform", `translate(${margin.left},0)`)
//       .call(d3.axisLeft(y));

//     // Tooltip
//     const tooltip = d3
//       .select("body")
//       .selectAll(".tooltip")
//       .data([null])
//       .join("div")
//       .attr("class", "tooltip")
//       .style("position", "absolute")
//       .style("padding", "6px 10px")
//       .style("background", "white")
//       .style("border", "1px solid #ccc")
//       .style("border-radius", "4px")
//       .style("font-size", "14px")
//       .style("pointer-events", "none")
//       .style("opacity", 0)
//       .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)");

//     svg
//       .selectAll("rect")
//       .data(counts)
//       .join("rect")
//       .attr("x", margin.left)
//       .attr("y", (d) => y(d[0]))
//       .attr("width", (d) => x(d[1]) - margin.left)
//       .attr("height", y.bandwidth())
//       .attr("fill", "#1db954")
//       .on("mouseover", function (event, d) {
//         d3.select(this).attr("fill", "#128c43");

//         tooltip
//           .style("opacity", 1)
//           .html(`<strong>${d[0]}</strong><br>${d[1]} músicas no Top 10`)
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mousemove", function (event) {
//         tooltip
//           .style("left", event.pageX + 15 + "px")
//           .style("top", event.pageY - 20 + "px");
//       })
//       .on("mouseout", function () {
//         d3.select(this).attr("fill", "#1db954");
//         tooltip.style("opacity", 0);
//       });
//   }
});
