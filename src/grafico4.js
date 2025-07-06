function renderChart4(data, siglaPais) {
  const svg = d3.select("#chart4 svg");
  svg.selectAll("*").remove();

  if (siglaPais === "NENHUM") {
    d3.select("#chart4 h2").text("");
    return;
  }

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 40, right: 30, bottom: 80, left: 150 };

  const filtered = data.filter((d) => {
    return d.country === siglaPais && new Date(d.snapshot_date).getFullYear() === 2024;
  });

  const allTracks = filtered.flatMap((d) => {
    const artists = d.artists.split(",").map((a) => a.trim());
    return artists.map((artist) => ({
      ...d,
      artist,
    }));
  });

  const scoreByArtist = d3.rollups(
    allTracks,
    (v) => d3.sum(v, (d) => 51 - d.daily_rank),
    (d) => d.artist
  );

  const top10 = scoreByArtist
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 10)
    .map(([artist, score]) => ({ artist, score }));

  const songCount = d3.rollups(
    allTracks.filter((d) => d.daily_rank <= 50),
    (v) => new Set(v.map((d) => d.spotify_id)).size,
    (d) => d.artist
  );
  const songCountMap = new Map(songCount);

  const lineDataByArtist = d3.rollups(
    allTracks.filter((d) => top10.some((a) => a.artist === d.artist)),
    (v) => d3.min(v, (d) => d.daily_rank),
    (d) => d.artist,
    (d) => new Date(d.snapshot_date).getMonth() + 1
  );

  const lineMap = new Map();
  lineDataByArtist.forEach(([artist, values]) => {
    lineMap.set(
      artist,
      values.map(([month, rank]) => ({ month, rank }))
    );
  });

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(top10, (d) => d.score)])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleBand()
    .domain(top10.map((d) => d.artist))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  // Degradê de verde para os 10 artistas
  const color = d3.scaleOrdinal()
    .domain(top10.map((_, i) => i))
    .range(d3.range(0, 1, 1 / 10).map(t => d3.interpolateGreens(1 - t * 0.6)));

  svg
    .append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(d3.axisTop(x))
    .selectAll("text")
    .style("font-size", "12px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px");

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "10px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "14px")
    .style("opacity", 0);

  svg
    .selectAll("rect")
    .data(top10)
    .join("rect")
    .attr("x", x(0))
    .attr("y", (d) => y(d.artist))
    .attr("width", (d) => x(d.score) - x(0))
    .attr("height", y.bandwidth())
    .attr("fill", (_, i) => color(i))
    .on("mouseover", function (event, d) {
      const lines = lineMap.get(d.artist) || [];
      const totalSongs = songCountMap.get(d.artist) || 0;

      const widthTooltip = 300;
      const heightTooltip = 100;
      const marginTooltip = { left: 40, right: 20, top: 20, bottom: 30 };

      const xTooltip = d3.scaleLinear().domain([1, 12]).range([marginTooltip.left, widthTooltip - marginTooltip.right]);
      const yTooltip = d3.scaleLinear().domain([50, 1]).range([heightTooltip - marginTooltip.bottom, marginTooltip.top]);

      const points = lines
        .map(p => `${xTooltip(p.month)},${yTooltip(p.rank)}`)
        .join(" ");

      const monthsLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const xAxisLabels = monthsLabels.map((m, i) => `<text x="${xTooltip(i + 1)}" y="${heightTooltip - 10}" font-size="10" text-anchor="middle">${m}</text>`).join("");

      const yTicks = [1, 13, 25, 37, 50];
      const yAxisTicks = yTicks.map(t => `<text x="${marginTooltip.left - 5}" y="${yTooltip(t) + 4}" font-size="10" text-anchor="end">${t}</text>`).join("");
      const yAxisLines = yTicks.map(t => `<line x1="${marginTooltip.left}" y1="${yTooltip(t)}" x2="${widthTooltip - marginTooltip.right}" y2="${yTooltip(t)}" stroke="#eee" stroke-width="1"/>`).join("");

      const circlesAndLabels = lines.map(p => {
        const cx = xTooltip(p.month);
        const cy = yTooltip(p.rank);
        return `
          <circle cx="${cx}" cy="${cy}" r="3" fill="#0077b6" />
          <text x="${cx + 5}" y="${cy + 4}" font-size="9" fill="#333">${p.rank}</text>
        `;
      }).join("");

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.artist}</strong><br/>
          Músicas no Top 50: ${totalSongs}<br/>
          <svg width="${widthTooltip}" height="${heightTooltip}">
            ${yAxisLines}
            ${yAxisTicks}
            <polyline
              fill="none"
              stroke="#0077b6"
              stroke-width="2"
              points="${points}"
            />
            ${circlesAndLabels}
            ${xAxisLabels}
          </svg>
        `)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - heightTooltip - 40 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 30 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    });

  d3.select("#chart4 h2").text(`4. Top 10 artistas em ${siglaPais} (2024)`);
}

export { renderChart4 };
