import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { executeQuery } from "./dataLoader.js";

// Função para carregar dados de colaboração usando DuckDB
async function loadCollaborationData(numArtists) {
  // Query SQL para calcular colaborações entre artistas
  const query = `
    WITH unique_songs AS (
        SELECT DISTINCT
            spotify_id,
            artists
        FROM spotify
        WHERE EXTRACT(year FROM CAST(snapshot_date AS DATE)) = 2024
    ),
    artist_pairs AS (
        SELECT 
            spotify_id,
            TRIM(UNNEST(string_split(artists, ','))) as artist
        FROM unique_songs
        WHERE length(string_split(artists, ',')) >= 2
    ),
    collaborations AS (
        SELECT 
            a1.artist as artist1,
            a2.artist as artist2,
            COUNT(*) as collab_count
        FROM artist_pairs a1
        JOIN artist_pairs a2 ON a1.spotify_id = a2.spotify_id AND a1.artist < a2.artist
        GROUP BY a1.artist, a2.artist
    ),
    artist_collab_totals AS (
        SELECT 
            artist,
            SUM(collab_count) as total_collabs
        FROM (
            SELECT artist1 as artist, collab_count FROM collaborations
            UNION ALL
            SELECT artist2 as artist, collab_count FROM collaborations
        )
        GROUP BY artist
    ),
    top_artists AS (
        SELECT artist, total_collabs
        FROM artist_collab_totals
        ORDER BY total_collabs DESC
        LIMIT ${numArtists}
    )
    SELECT 
        c.artist1,
        c.artist2,
        CAST(c.collab_count AS INTEGER) as collab_count,
        CAST(t1.total_collabs AS INTEGER) as artist1_total,
        CAST(t2.total_collabs AS INTEGER) as artist2_total
    FROM collaborations c
    JOIN top_artists t1 ON c.artist1 = t1.artist
    JOIN top_artists t2 ON c.artist2 = t2.artist
    
    UNION ALL
    
    SELECT 
        artist as artist1,
        artist as artist2,
        CAST(0 AS INTEGER) as collab_count,
        CAST(total_collabs AS INTEGER) as artist1_total,
        CAST(total_collabs AS INTEGER) as artist2_total
    FROM top_artists
    ORDER BY artist1_total DESC, artist2_total DESC
  `;

  const result = await executeQuery(query);

  // Processar resultados da query
  const collabSum = new Map();
  const pairCounts = new Map();

  result.forEach((row) => {
    // Adicionar contagens totais de colaboração
    if (!collabSum.has(row.artist1)) {
      collabSum.set(row.artist1, row.artist1_total);
    }
    if (!collabSum.has(row.artist2)) {
      collabSum.set(row.artist2, row.artist2_total);
    }

    // Adicionar contagens de pares (apenas se não for o mesmo artista)
    if (row.artist1 !== row.artist2 && row.collab_count > 0) {
      const key = `${row.artist1}|||${row.artist2}`;
      pairCounts.set(key, row.collab_count);
    }
  });

  const topArtists = Array.from(collabSum.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, numArtists)
    .map((d) => d[0]);

  const matrix = Array(numArtists)
    .fill()
    .map(() => Array(numArtists).fill(0));
  for (const [key, count] of pairCounts) {
    const [a, b] = key.split("|||");
    if (topArtists.includes(a) && topArtists.includes(b)) {
      const i = topArtists.indexOf(a);
      const j = topArtists.indexOf(b);
      matrix[i][j] = count;
      matrix[j][i] = count;
    }
  }

  const artists = topArtists.map((name, i) => ({
    name,
    index: i,
    count: collabSum.get(name),
    vector: matrix[i],
  }));

  return { artists, matrix, topArtists };
}

// Função principal exportável para o heatmap de colaborações
export async function grafico1() {
  const margin = { top: 100, right: 20, bottom: 10, left: 150 };
  const size = 10;
  const numArtists = 70;
  const width = size * numArtists;
  const height = size * numArtists;

  const svg = d3
    .select("#heatmap")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3
    .select("#heatmap")
    .append("div")
    .attr("class", "tooltip-heatmap")
    .style("opacity", 0);

  try {
    const { artists, matrix, topArtists } = await loadCollaborationData(
      numArtists
    );
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
        artists[a].name.localeCompare(artists[b].name, "pt", {
          sensitivity: "base",
        })
      ),
      count: d3
        .range(numArtists)
        .sort((a, b) => artists[b].count - artists[a].count),
      cluster: clusterOrder(),
    };

    const initialOrder = "name";
    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(orders[initialOrder])
      .padding(0.05);
    const y = d3
      .scaleBand()
      .range([0, height])
      .domain(orders[initialOrder])
      .padding(0.05);

    const maxCollab = d3.max(matrix.flat());
    const color = d3
      .scaleSequential()
      .interpolator((t) => d3.interpolateGreens(t * 0.8 + 0.2))
      .domain([1, maxCollab]);

    const row = svg
      .selectAll(".row")
      .data(orders[initialOrder])
      .join("g")
      .attr("class", "row")
      .attr("transform", (i) => `translate(0,${y(i)})`);

    row
      .append("text")
      .attr("x", -6)
      .attr("y", size / 2)
      .attr("dy", ".32em")
      .attr("text-anchor", "end")
      .attr("font-size", "8px")
      .text((i) => artists[i].name);

    row.each(function (rowIdx) {
      d3.select(this)
        .selectAll(".cell")
        .data(
          orders[initialOrder].map((colIdx) => ({
            x: colIdx,
            y: rowIdx,
            value: matrix[rowIdx][colIdx],
          }))
        )
        .join("rect")
        .attr("class", "cell")
        .attr("x", (d) => x(d.x))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", (d) => (d.value ? color(d.value) : "#fff"))
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

    const col = svg
      .selectAll(".column")
      .data(orders[initialOrder])
      .join("g")
      .attr("class", "column")
      .attr("transform", (i) => `translate(${x(i)}) rotate(-90)`);

    col
      .append("text")
      .attr("x", 6)
      .attr("y", x.bandwidth() / 2)
      .attr("dy", ".32em")
      .attr("text-anchor", "start")
      .attr("font-size", "8px")
      .text((i) => artists[i].name);

    d3.select("#order").on("change", function () {
      const value = this.value;
      x.domain(orders[value]);
      y.domain(orders[value]);

      svg
        .selectAll(".row")
        .transition()
        .duration(1000)
        .attr("transform", (i) => `translate(0,${y(i)})`)
        .each(function (rowIdx) {
          d3.select(this)
            .selectAll("rect")
            .data(
              orders[value].map((colIdx) => ({
                x: colIdx,
                y: rowIdx,
                value: matrix[rowIdx][colIdx],
              }))
            )
            .transition()
            .duration(1000)
            .attr("x", (d) => x(d.x))
            .style("fill", (d) => (d.value ? color(d.value) : "#fff"));
        });

      svg
        .selectAll(".column")
        .transition()
        .duration(1000)
        .attr("transform", (i) => `translate(${x(i)}) rotate(-90)`);
    });
  } catch (error) {
    console.error("Erro ao carregar dados de colaboração:", error);
  }
}
