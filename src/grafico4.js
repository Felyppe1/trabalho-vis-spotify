function renderChart4(data) {
  const svg = d3.select("#chart4 svg");
  svg.selectAll("*").remove();

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 20, right: 30, bottom: 50, left: 150 };

  // Filtrar top 10 de 2024
  const top10_2024 = data.filter((d) => {
    const date = new Date(d.snapshot_date);
    return d.daily_rank && +d.daily_rank <= 10 && date.getFullYear() === 2024;
  });

  // Função auxiliar para extrair array de artistas
  function getArtists(value) {
    if (typeof value === "string") {
      return value.split(",").map(a => a.trim());
    }
    if (Array.isArray(value)) {
      return value.map(a => a.trim());
    }
    return [];
  }

  // Contar participações individuais por artista
  const artistCounts = new Map();
  top10_2024.forEach((d) => {
    const artistas = getArtists(d.artists);
    artistas.forEach((artista) => {
      artistCounts.set(artista, (artistCounts.get(artista) || 0) + 1);
    });
  });

  // Obter os 10 artistas mais frequentes
  const counts = Array.from(artistCounts.entries())
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 10);

  // Escalas
  const y = d3.scaleBand()
    .domain(counts.map(d => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  const x = d3.scaleLinear()
    .domain([0, d3.max(counts, d => d[1])])
    .range([margin.left, width - margin.right]);

  // Eixos
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Tooltip
  const tooltip = d3.select("body")
    .selectAll(".tooltip")
    .data([null])
    .join("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "12px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("font-size", "14px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("box-shadow", "0 3px 8px rgba(0,0,0,0.15)");

  // Barras
  svg.selectAll("rect")
    .data(counts)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", d => y(d[0]))
    .attr("width", d => x(d[1]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "#1db954")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#128c43");

      const artist = d[0];
      // Inclui colaborações
      const artistData = top10_2024.filter((x) => {
        const artistas = getArtists(x.artists);
        return artistas.includes(artist);
      });

      // Média de rank por mês
      const monthMap = d3.rollup(
        artistData,
        v => d3.mean(v, d => +d.daily_rank),
        d => new Date(d.snapshot_date).getMonth()
      );

      const lineData = Array.from({ length: 12 }, (_, i) => ({
        month: i,
        rank: monthMap.get(i) || null
      }));

      // Mini gráfico no tooltip
      const miniWidth = 280;
      const miniHeight = 80;
      const miniMargin = { top: 10, right: 15, bottom: 20, left: 35 };

      const xMini = d3.scaleLinear()
        .domain([0, 11])
        .range([miniMargin.left, miniWidth - miniMargin.right]);

      const yMini = d3.scaleLinear()
        .domain([10, 1])
        .range([miniHeight - miniMargin.bottom, miniMargin.top]);

      const line = d3.line()
        .defined(d => d.rank !== null)
        .x(d => xMini(d.month))
        .y(d => yMini(d.rank));

      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${artist}</strong><br>
          <span style="font-size:12px; color:#666;">Evolução mensal no Top 10 (2024)</span>
          <svg width="${miniWidth}" height="${miniHeight}" style="display:block; margin-top:6px;">
            <g>
              <path d="${line(lineData)}" fill="none" stroke="#1db954" stroke-width="2.5"/>
              ${lineData
                .filter(p => p.rank !== null)
                .map(p => `<circle cx="${xMini(p.month)}" cy="${yMini(p.rank)}" r="3" fill="#1db954"/>`)
                .join("")}
              <g transform="translate(0,${miniHeight - miniMargin.bottom})">
                ${months.map((m, i) => `<text x="${xMini(i)}" y="13" font-size="9" text-anchor="middle">${m}</text>`).join("")}
              </g>
              <line x1="${miniMargin.left}" x2="${miniWidth - miniMargin.right}" y1="${yMini(1)}" y2="${yMini(1)}" stroke="#ccc" stroke-dasharray="2"/>
              <text x="${miniMargin.left}" y="${yMini(1) - 4}" font-size="8" fill="#999">#1</text>
            </g>
          </svg>
        `)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#1db954");
      tooltip.style("opacity", 0);
    });
}

export { renderChart4 };
