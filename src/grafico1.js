function renderChart1(data) {
  const svg = d3.select("#chart1 svg");
  svg.selectAll("*").remove();

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 20, right: 30, bottom: 70, left: 60 };

  const top50_2024 = data.filter((d) => {
    const date = new Date(d.snapshot_date);
    return (
      d.daily_rank &&
      +d.daily_rank <= 50 &&
      date.getFullYear() === 2024
    );
  });

  const attrLabels = {
    danceability: "Dançabilidade",
    energy: "Energia",
    valence: "Valência",
    acousticness: "Acústica"
  };
  const attrs = Object.keys(attrLabels);

  const averages = attrs.map((attr) => {
    const mean = d3.mean(top50_2024, (d) => +d[attr]);
  
    const topArtists = top50_2024
      .filter(d => d[attr] !== undefined)
      .sort((a, b) => +b[attr] - +a[attr])
      .slice(0, 3)
      .map(d => ({
        name: d.artists,
        rank: +d.daily_rank,
        valor: +d[attr]
      }));

    return { attr, mean, topArtists };
  });

  const x = d3
    .scaleBand()
    .domain(attrs.map((a) => attrLabels[a]))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

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

  svg
    .selectAll("rect")
    .data(averages)
    .join("rect")
    .attr("x", (d) => x(attrLabels[d.attr]))
    .attr("y", (d) => y(d.mean))
    .attr("width", x.bandwidth())
    .attr("height", (d) => y(0) - y(d.mean))
    .attr("fill", "#1db954")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#14833b");

      const tooltipText = `
        <strong>${attrLabels[d.attr]}</strong><br>
        Média: ${d.mean.toFixed(2)}<br><br>
        ${d.topArtists
          .map(
            (artist, i) =>
              `${i + 1}º: ${artist.name} (Posição: ${artist.rank})`
          )
          .join("<br>")}
      `;

      tooltip
        .style("opacity", 1)
        .html(tooltipText)
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

export { renderChart1 };
