  function renderChart4(data) {
    const svg = d3.select("#chart4 svg");
    svg.selectAll("*").remove();

    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 150 };

    const top10 = data.filter((d) => d.daily_rank <= 10);

    const counts = d3
      .rollups(
        top10,
        (v) => v.length,
        (d) => d.artists
      )
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10);

    const y = d3
      .scaleBand()
      .domain(counts.map((d) => d[0]))
      .range([margin.top, height - margin.bottom])
      .padding(0.1);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(counts, (d) => d[1])])
      .range([margin.left, width - margin.right]);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Tooltip
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
      .data(counts)
      .join("rect")
      .attr("x", margin.left)
      .attr("y", (d) => y(d[0]))
      .attr("width", (d) => x(d[1]) - margin.left)
      .attr("height", y.bandwidth())
      .attr("fill", "#1db954")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#128c43");

        tooltip
          .style("opacity", 1)
          .html(`<strong>${d[0]}</strong><br>${d[1]} músicas no Top 10`)
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