import { executeQuery } from "./dataLoader.js";

async function renderChart4(siglaPais) {
  const svg = d3.select("#chart4 svg");
  svg.selectAll("*").remove();

  if (siglaPais === "NENHUM") {
    d3.select("#chart4 h2").text("");
    return;
  }

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const margin = { top: 40, right: 30, bottom: 80, left: 150 };

  const query = `
    WITH artist_tracks AS (
        SELECT 
            TRIM(UNNEST(string_split(artists, ','))) as artist, 
            daily_rank, 
            spotify_id, 
            snapshot_date
        FROM spotify
        WHERE country = '${siglaPais}' AND EXTRACT(year FROM CAST(snapshot_date AS DATE)) = 2024
    ),
    artist_scores AS (
        SELECT 
            artist,
            SUM(51 - daily_rank) as score
        FROM artist_tracks
        GROUP BY artist
    ),
    top_10_artists AS (
        SELECT artist, score
        FROM artist_scores
        ORDER BY score DESC
        LIMIT 10
    ),
    song_counts AS (
        SELECT 
            artist,
            COUNT(DISTINCT spotify_id) as song_count
        FROM artist_tracks
        WHERE daily_rank <= 50 AND artist IN (SELECT artist FROM top_10_artists)
        GROUP BY artist
    ),
    monthly_ranks AS (
        SELECT 
            artist,
            EXTRACT(month FROM CAST(snapshot_date AS DATE)) as month,
            MIN(daily_rank) as min_rank
        FROM artist_tracks
        WHERE artist IN (SELECT artist FROM top_10_artists)
        GROUP BY artist, month
    )
    SELECT 
        t.artist,
        t.score,
        CAST(COALESCE(s.song_count, 0) AS INTEGER) as song_count,
        CAST(m.month AS INTEGER) as month,
        CAST(m.min_rank AS INTEGER) as min_rank
    FROM top_10_artists t
    LEFT JOIN song_counts s ON t.artist = s.artist
    LEFT JOIN monthly_ranks m ON t.artist = m.artist
    ORDER BY t.score DESC, m.month ASC
  `;

  const queryResult = await executeQuery(query);

  const artistData = new Map();
  for (const row of queryResult) {
    if (!artistData.has(row.artist)) {
      artistData.set(row.artist, {
        artist: row.artist,
        score: row.score,
        songCount: row.song_count,
        lineData: [],
      });
    }
    if (row.month && row.min_rank) {
      artistData
        .get(row.artist)
        .lineData.push({ month: row.month, rank: row.min_rank });
    }
  }

  const top10 = Array.from(artistData.values()).sort(
    (a, b) => b.songCount - a.songCount
  );
  const songCountMap = new Map(top10.map((d) => [d.artist, d.songCount]));
  const lineMap = new Map(top10.map((d) => [d.artist, d.lineData]));

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(top10, (d) => d.songCount)])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleBand()
    .domain(top10.map((d) => d.artist))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

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
    .attr("width", (d) => x(d.songCount) - x(0))
    .attr("height", y.bandwidth())
    .attr("fill", (_, i) => color(i))
    .on("mouseover", function (event, d) {
      const lines = lineMap.get(d.artist) || [];
      const totalSongs = songCountMap.get(d.artist) || 0;

      const widthTooltip = 300;
      const heightTooltip = 100;
      const marginTooltip = { left: 40, right: 20, top: 20, bottom: 30 };

      const xTooltip = d3
        .scaleLinear()
        .domain([1, 12])
        .range([marginTooltip.left, widthTooltip - marginTooltip.right]);
      const yTooltip = d3
        .scaleLinear()
        .domain([50, 1])
        .range([heightTooltip - marginTooltip.bottom, marginTooltip.top]);

      const points = lines
        .map((p) => `${xTooltip(p.month)},${yTooltip(p.rank)}`)
        .join(" ");

      const monthsLabels = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez",
      ];
      const xAxisLabels = monthsLabels
        .map(
          (m, i) =>
            `<text x="${xTooltip(i + 1)}" y="${
              heightTooltip - 10
            }" font-size="10" text-anchor="middle">${m}</text>`
        )
        .join("");

      const yTicks = [1, 10, 20, 30, 40, 50];
      const yAxisTicks = yTicks.map(t => `<text x="${marginTooltip.left - 5}" y="${yTooltip(t) + 4}" font-size="10" text-anchor="end">${t}</text>`).join("");
      const yAxisLines = yTicks.map(t => `<line x1="${marginTooltip.left}" y1="${yTooltip(t)}" x2="${widthTooltip - marginTooltip.right}" y2="${yTooltip(t)}" stroke="#eee" stroke-width="1"/>`).join("");

      const circlesAndLabels = lines
        .map((p) => {
          const cx = xTooltip(p.month);
          const cy = yTooltip(p.rank);
          return `
          <circle cx="${cx}" cy="${cy}" r="3" fill="#0077b6" />
          <text x="${cx + 5}" y="${cy + 4}" font-size="9" fill="#333">${
            p.rank
          }</text>
        `;
        })
        .join("");

      tooltip
        .style("opacity", 1)
        .html(
          `
          <strong>${d.artist}</strong><br/>
          Músicas no Top 50: ${totalSongs}<br/>
          <svg width="${widthTooltip}" height="${heightTooltip}">
            <text x="${widthTooltip / 2}" y="12" text-anchor="middle" font-size="12" fill="#333" font-weight="bold">
              Posição no Top 50 por mês
            </text>
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
        `
        )
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

  d3.select("#chart4 h2").text(`4. Top 10 artistas em ${siglaPais} por nº de músicas no Top 50 (2024)`);
}

export { renderChart4 };
