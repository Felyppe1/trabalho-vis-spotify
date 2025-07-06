import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const margin = { top: 100, right: 20, bottom: 10, left: 150 };
const size = 10;
const numArtists = 70;
const width = size * numArtists;
const height = size * numArtists;

const svg = d3.select("#heatmap")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#heatmap")
  .append("div")
  .attr("class", "tooltip-heatmap") // Classe exclusiva
  .style("opacity", 0);

const parseDate = d3.timeParse("%Y-%m-%d");
function isIn2024(dateStr) {
  const d = parseDate(dateStr);
  return d && d.getFullYear() === 2024;
}

d3.csv("../data/spotify.csv").then(data => {
  const filtered = data.filter(d => isIn2024(d.snapshot_date));

  const songMap = new Map();
  filtered.forEach(d => {
    if (!songMap.has(d.spotify_id)) songMap.set(d.spotify_id, d);
  });

  const songs = Array.from(songMap.values());

  const pairCounts = {};
  const collabSum = {};

  songs.forEach(d => {
    const artists = d.artists.split(",").map(a => a.trim());
    if (artists.length < 2) return;
    for (let i = 0; i < artists.length; i++) {
      collabSum[artists[i]] = (collabSum[artists[i]] || 0);
      for (let j = i + 1; j < artists.length; j++) {
        const [a1, a2] = [artists[i], artists[j]].sort();
        const key = `${a1}|||${a2}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
        collabSum[a1]++;
        collabSum[a2]++;
      }
    }
  });

  const topArtists = Object.entries(collabSum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, numArtists)
    .map(d => d[0]);

  const matrix = Array(numArtists).fill().map(() => Array(numArtists).fill(0));
  for (const key in pairCounts) {
    const [a, b] = key.split("|||");
    if (topArtists.includes(a) && topArtists.includes(b)) {
      const i = topArtists.indexOf(a);
      const j = topArtists.indexOf(b);
      matrix[i][j] = pairCounts[key];
      matrix[j][i] = pairCounts[key];
    }
  }

  const artists = topArtists.map((name, i) => ({
    name,
    index: i,
    count: collabSum[name],
    vector: matrix[i]
  }));

  function clusterOrder() {
    const order = [];
    const used = new Set();
    let current = 0;
    let maxCount = -1;

    for (let i = 0; i < numArtists; i++) {
      if (artists[i].count > maxCount) {
        maxCount = artists[i].count;
        current = i;
      }
    }

    order.push(current);
    used.add(current);

    while (order.length < numArtists) {
      const last = order[order.length - 1];
      let next = null;
      let maxCollab = -1;

      for (let i = 0; i < numArtists; i++) {
        if (!used.has(i) && matrix[last][i] > maxCollab) {
          maxCollab = matrix[last][i];
          next = i;
        }
      }

      if (next === null) {
        for (let i = 0; i < numArtists; i++) {
          if (!used.has(i)) {
            next = i;
            break;
          }
        }
      }

      used.add(next);
      order.push(next);
    }

    return order;
  }

  const orders = {
    name: d3.range(numArtists).sort((a, b) =>
      artists[a].name.localeCompare(artists[b].name, 'pt', { sensitivity: 'base' })
    ),
    count: d3.range(numArtists).sort((a, b) => artists[b].count - artists[a].count),
    cluster: clusterOrder()
  };

  const initialOrder = "name";
  const x = d3.scaleBand().range([0, width]).domain(orders[initialOrder]).padding(0.05);
  const y = d3.scaleBand().range([0, height]).domain(orders[initialOrder]).padding(0.05);

  const maxCollab = d3.max(matrix.flat());
  const color = d3.scaleSequential()
    .interpolator(t => d3.interpolateGreens(t * 0.8 + 0.2))
    .domain([1, maxCollab]);

  const row = svg.selectAll(".row")
    .data(orders[initialOrder])
    .join("g")
    .attr("class", "row")
    .attr("transform", i => `translate(0,${y(i)})`);

  row.append("text")
    .attr("x", -6)
    .attr("y", size / 2)
    .attr("dy", ".32em")
    .attr("text-anchor", "end")
    .attr("font-size", "8px")
    .text(i => artists[i].name);

  row.each(function (rowIdx) {
    d3.select(this)
      .selectAll(".cell")
      .data(orders[initialOrder].map(colIdx => ({
        x: colIdx,
        y: rowIdx,
        value: matrix[rowIdx][colIdx]
      })))
      .join("rect")
      .attr("class", "cell")
      .attr("x", d => x(d.x))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", d => d.value ? color(d.value) : "#fff")
      .style("stroke", "#ccc")
      .on("mouseover", function (event, d) {
        if (d.value === 0) return;
        const rowArtist = artists[d.y];
        const colArtist = artists[d.x];

        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${rowArtist.name}</strong>: ${rowArtist.count} colaboração(ões)<br>` +
            `<strong>${rowArtist.name}</strong> & <strong>${colArtist.name}</strong>: ${d.value} música(s) juntos`
          );
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 40}px`);
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  });

  const col = svg.selectAll(".column")
    .data(orders[initialOrder])
    .join("g")
    .attr("class", "column")
    .attr("transform", i => `translate(${x(i)}) rotate(-90)`);

  col.append("text")
    .attr("x", 6)
    .attr("y", x.bandwidth() / 2)
    .attr("dy", ".32em")
    .attr("text-anchor", "start")
    .attr("font-size", "8px")
    .text(i => artists[i].name);

  d3.select("#order").on("change", function () {
    const value = this.value;
    x.domain(orders[value]);
    y.domain(orders[value]);

    svg.selectAll(".row")
      .transition()
      .duration(1000)
      .attr("transform", i => `translate(0,${y(i)})`)
      .each(function (rowIdx) {
        d3.select(this).selectAll("rect")
          .data(orders[value].map(colIdx => ({
            x: colIdx,
            y: rowIdx,
            value: matrix[rowIdx][colIdx]
          })))
          .transition()
          .duration(1000)
          .attr("x", d => x(d.x))
          .style("fill", d => d.value ? color(d.value) : "#fff");
      });

    svg.selectAll(".column")
      .transition()
      .duration(1000)
      .attr("transform", i => `translate(${x(i)}) rotate(-90)`);
  });
});
