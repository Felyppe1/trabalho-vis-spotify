import { executeQuery } from "./dataLoader";

export async function grafico2() {
  const query = `
    WITH unique_tracks AS (
        SELECT DISTINCT
            spotify_id,
            name,
            artists,
            duration_ms,
            album_release_date,
            EXTRACT(year FROM CAST(album_release_date AS DATE)) AS release_year
        FROM spotify
    ),
    yearly_stats AS (
        SELECT 
            yt.release_year,
            AVG(yt.duration_ms / 60000.0) AS avg_duration_min,
            COUNT(*) AS total_tracks,
            COUNT(CASE WHEN yt.duration_ms / 60000.0 < 2 THEN 1 END) AS under_2_min,
            COUNT(CASE WHEN yt.duration_ms / 60000.0 >= 2 AND yt.duration_ms / 60000.0 < 3 THEN 1 END) AS between_2_3_min,
            COUNT(CASE WHEN yt.duration_ms / 60000.0 >= 3 AND yt.duration_ms / 60000.0 < 4 THEN 1 END) AS between_3_4_min,
            COUNT(CASE WHEN yt.duration_ms / 60000.0 >= 4 AND yt.duration_ms / 60000.0 < 5 THEN 1 END) AS between_4_5_min,
            COUNT(CASE WHEN yt.duration_ms / 60000.0 >= 5 THEN 1 END) AS over_5_min,
            MIN(yt.duration_ms) AS min_duration_ms,
            MAX(yt.duration_ms) AS max_duration_ms,
            
            -- Pegando menor duração
            MIN_BY(yt.name, yt.duration_ms) AS shortest_name,
            MIN_BY(yt.artists, yt.duration_ms) AS shortest_artist,
            
            -- Pegando maior duração
            MAX_BY(yt.name, yt.duration_ms) AS longest_name,
            MAX_BY(yt.artists, yt.duration_ms) AS longest_artist
        FROM unique_tracks yt
        GROUP BY yt.release_year
    )
    SELECT 
        CAST(release_year AS INTEGER) AS release_year,
        ROUND(avg_duration_min, 2) AS avg_duration_min,
        CAST(total_tracks AS INTEGER) AS total_tracks,
        ROUND((under_2_min * 100.0 / total_tracks), 1) AS percent_under_2,
        ROUND((between_2_3_min * 100.0 / total_tracks), 1) AS percent_2_3,
        ROUND((between_3_4_min * 100.0 / total_tracks), 1) AS percent_3_4,
        ROUND((between_4_5_min * 100.0 / total_tracks), 1) AS percent_4_5,
        ROUND((over_5_min * 100.0 / total_tracks), 1) AS percent_over_5,
        shortest_name,
        shortest_artist,
        ROUND(min_duration_ms / 60000.0, 2) AS shortest_duration_min,
        longest_name,
        longest_artist,
        ROUND(max_duration_ms / 60000.0, 2) AS longest_duration_min
    FROM yearly_stats
    ORDER BY release_year;
    `;

  const result = await executeQuery(query);

  const durationByYear = result.map((row) => ({
    year: row.release_year,
    avg_duration_min: row.avg_duration_min,
    stats: {
      total: row.total_tracks,
      percentages: {
        under2: row.percent_under_2,
        between2and3: row.percent_2_3,
        between3and4: row.percent_3_4,
        between4and5: row.percent_4_5,
        over5: row.percent_over_5,
      },
      shortest: {
        name: row.shortest_name,
        artist: row.shortest_artist,
        duration: row.shortest_duration_min,
      },
      longest: {
        name: row.longest_name,
        artist: row.longest_artist,
        duration: row.longest_duration_min,
      },
    },
  }));
  console.log(durationByYear);

  const svg = d3.select("#chart2 svg");

  svg.selectAll("*").remove();

  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const containerWidth =
    svg.node().getBoundingClientRect().width || svg.node().clientWidth || 800;
  const width = containerWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const g = svg
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(durationByYear, (d) => d.year))
    .range([0, width]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(durationByYear, (d) => d.avg_duration_min))
    .nice()
    .range([height, 0]);

  const line = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.avg_duration_min))
    .curve(d3.curveMonotoneX);

  console.log(line);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
    .attr("class", "x-axis");

  g.append("g").call(d3.axisLeft(yScale));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - height / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Duração Média (minutos)");

  g.append("text")
    .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 5})`)
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Ano")
    .attr("class", "x-label");

  g.append("path")
    .datum(durationByYear)
    .attr("fill", "none")
    .attr("stroke", "#1DB954")
    .attr("stroke-width", 2)
    .attr("d", line)
    .attr("class", "line");

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("brush end", brushed);

  const brushGroup = g.append("g").attr("class", "brush").call(brush);

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip2")
    .style("position", "absolute")
    .style("padding", "10px 12px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("box-shadow", "0 4px 8px rgba(0,0,0,0.15)")
    .style("max-width", "350px")
    .style("line-height", "1.4");

  g.selectAll(".dot")
    .data(durationByYear)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => xScale(d.year))
    .attr("cy", (d) => yScale(d.avg_duration_min))
    .attr("r", 4)
    .attr("fill", "#1DB954")
    .style("pointer-events", "all")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#14833b");

      tooltip.transition().duration(200).style("opacity", 1);

      tooltip
        .html(
          `
                    <div style="font-weight: bold; margin-bottom: 8px; color: #333;">${d.year}</div>
                    <div style="margin-bottom: 6px;"><strong>Duração Média:</strong> ${d.avg_duration_min} min</div>
                    <div style="margin-bottom: 6px;"><strong>Total de músicas:</strong> ${d.stats.total}</div>
                    
                    <div style="margin-bottom: 4px; font-weight: bold; color: #555;">Distribuição por Duração:</div>
                    <div style="margin-left: 8px; margin-bottom: 6px;">
                    • Menos de 2 min: ${d.stats.percentages.under2}%<br>
                    • Entre 2-3 min: ${d.stats.percentages.between2and3}%<br>
                    • Entre 3-4 min: ${d.stats.percentages.between3and4}%<br>
                    • Entre 4-5 min: ${d.stats.percentages.between4and5}%<br>
                    • Mais de 5 min: ${d.stats.percentages.over5}%
                    </div>
                    
                    <div style="margin-bottom: 4px; font-weight: bold; color: #555;">Extremos:</div>
                    <div style="margin-left: 8px;">
                    <div style="margin-bottom: 3px;">
                        <strong>Mais Curta:</strong><br>
                        "${d.stats.shortest.name}" - ${d.stats.shortest.artist}<br>
                        <span style="color: #666;">${d.stats.shortest.duration} min</span>
                    </div>
                    <div>
                        <strong>Mais Longa:</strong><br>
                        "${d.stats.longest.name}" - ${d.stats.longest.artist}<br>
                        <span style="color: #666;">${d.stats.longest.duration} min</span>
                    </div>
                    </div>
                `
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#1DB954");
      tooltip.transition().duration(200).style("opacity", 0);
    });

  const brushInfo = d3
    .select("#chart2")
    .append("div")
    .attr("class", "brush-info")
    .style("margin-top", "15px")
    .style("padding", "15px")
    .style("background", "#f8f9fa")
    .style("border", "1px solid #dee2e6")
    .style("border-radius", "8px")
    .style("font-size", "14px")
    .style("line-height", "1.5")
    .style("display", "none");

  async function brushed(event) {
    if (event.type !== "end") return;
    
    const selection = event.selection;

    if (!selection) {
      brushInfo.style("display", "none");
      return;
    }

    const [x0, x1] = selection.map(xScale.invert);

    const startYear = Math.ceil(x0);
    const endYear = Math.floor(x1);

    const query = `
    WITH unique_tracks AS (
        SELECT DISTINCT
            spotify_id,
            name,
            artists,
            duration_ms,
            album_release_date,
            EXTRACT(year from CAST(album_release_date AS DATE)) as release_year
        FROM spotify
        WHERE EXTRACT(year from CAST(album_release_date AS DATE)) BETWEEN ${startYear} AND ${endYear}
    ),
    yearly_stats AS (
        SELECT 
            AVG(duration_ms / 60000.0) as avg_duration_min,
            COUNT(*) as total_tracks,
            COUNT(CASE WHEN duration_ms / 60000.0 < 2 THEN 1 END) as under_2_min,
            COUNT(CASE WHEN duration_ms / 60000.0 >= 2 AND duration_ms / 60000.0 < 3 THEN 1 END) as between_2_3_min,
            COUNT(CASE WHEN duration_ms / 60000.0 >= 3 AND duration_ms / 60000.0 < 4 THEN 1 END) as between_3_4_min,
            COUNT(CASE WHEN duration_ms / 60000.0 >= 4 AND duration_ms / 60000.0 < 5 THEN 1 END) as between_4_5_min,
            COUNT(CASE WHEN duration_ms / 60000.0 >= 5 THEN 1 END) as over_5_min,
            MIN(duration_ms) as min_duration_ms,
            MAX(duration_ms) as max_duration_ms
        FROM unique_tracks
    ),
    yearly_extremes AS (
        SELECT 
            ys.avg_duration_min,
            ys.total_tracks,
            ys.under_2_min,
            ys.between_2_3_min,
            ys.between_3_4_min,
            ys.between_4_5_min,
            ys.over_5_min,
            shortest.name as shortest_name,
            shortest.artists as shortest_artist,
            shortest.duration_ms as shortest_duration_ms,
            longest.name as longest_name,
            longest.artists as longest_artist,
            longest.duration_ms as longest_duration_ms
        FROM yearly_stats ys
        LEFT JOIN unique_tracks shortest
            on ys.min_duration_ms = shortest.duration_ms
        LEFT JOIN unique_tracks longest
            on ys.max_duration_ms = longest.duration_ms
    )
    SELECT 
    --    CAST(release_year AS INTEGER) release_year,
        ROUND(avg_duration_min, 2) as avg_duration_min,
        CAST(total_tracks AS INTEGER) total_tracks,
        ROUND((under_2_min * 100.0 / total_tracks), 1) as percent_under_2,
        ROUND((between_2_3_min * 100.0 / total_tracks), 1) as percent_2_3,
        ROUND((between_3_4_min * 100.0 / total_tracks), 1) as percent_3_4,
        ROUND((between_4_5_min * 100.0 / total_tracks), 1) as percent_4_5,
        ROUND((over_5_min * 100.0 / total_tracks), 1) as percent_over_5,
        shortest_name,
        shortest_artist,
        ROUND(shortest_duration_ms / 60000.0, 2) as shortest_duration_min,
        longest_name,
        longest_artist,
        ROUND(longest_duration_ms / 60000.0, 2) as longest_duration_min
    FROM yearly_extremes
    `;

    try {
      const result = await executeQuery(query);

      if (result.length === 0) {
        brushInfo.style("display", "none");
        return;
      }

      const data = result[0];

      const periodText =
        startYear === endYear ? startYear : `${startYear} - ${endYear}`;

      brushInfo.style("display", "block").html(`
        <div style="font-weight: bold; margin-bottom: 12px; color: #333; border-bottom: 2px solid #1DB954; padding-bottom: 8px; font-size: 16px;">
            Análise do Período Selecionado: ${periodText}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
            <div>
                <div style="margin-bottom: 8px;"><strong>Total de músicas:</strong> ${data.total_tracks.toLocaleString()}</div>
                <div style="margin-bottom: 8px;"><strong>Duração Média:</strong> ${data.avg_duration_min.toFixed(
                  2
                )} min</div>
            </div>
            <div>
                <div style="font-weight: bold; margin-bottom: 6px;">Distribuição por Duração:</div>
                <div style="font-size: 13px;">
                    • Menos de 2 min: ${data.percent_under_2}%<br>
                    • Entre 2-3 min: ${data.percent_2_3}%<br>
                    • Entre 3-4 min: ${data.percent_3_4}%<br>
                    • Entre 4-5 min: ${data.percent_4_5}%<br>
                    • Mais de 5 min: ${data.percent_over_5}%
                </div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: #fff; padding: 10px; border-radius: 6px; border-left: 4px solid #1DB954;">
                <div style="font-weight: bold; margin-bottom: 6px;">Música Mais Curta:</div>
                <div style="font-size: 13px;">
                    <strong>"${data.shortest_name}"</strong><br>
                    por ${data.shortest_artist}<br>
                    <span style="color: #1DB954; font-weight: bold;">${
                      data.shortest_duration_min
                    } min</span>
                </div>
            </div>
            <div style="background: #fff; padding: 10px; border-radius: 6px; border-left: 4px solid #ff6b6b;">
                <div style="font-weight: bold; margin-bottom: 6px;">Música Mais Longa:</div>
                <div style="font-size: 13px;">
                    <strong>"${data.longest_name}"</strong><br>
                    por ${data.longest_artist}<br>
                    <span style="color: #ff6b6b; font-weight: bold;">${
                      data.longest_duration_min
                    } min</span>
                </div>
            </div>
        </div>
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; text-align: center;">
            💡 Arraste no gráfico para selecionar diferentes períodos | Passe o mouse sobre os pontos para dados específicos
        </div>
      `);
    } catch (error) {
      console.error("Erro ao executar a query:", error);
      brushInfo.style("display", "none");
    }
  }

  function resize() {
    const newContainerWidth =
      svg.node().getBoundingClientRect().width || svg.node().clientWidth || 800;
    const newWidth = newContainerWidth - margin.left - margin.right;

    svg.attr("width", newWidth + margin.left + margin.right);

    xScale.range([0, newWidth]);

    g.select(".x-axis").call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    g.select(".line").attr("d", line);

    g.selectAll(".dot").attr("cx", (d) => xScale(d.year));

    g.select(".x-label").attr(
      "transform",
      `translate(${newWidth / 2}, ${height + margin.bottom - 5})`
    );

    brush.extent([
      [0, 0],
      [newWidth, height],
    ]);
    brushGroup.call(brush);
  }

  window.addEventListener("resize", resize);

  console.log(
    "Gráfico 2 renderizado com",
    durationByYear.length,
    "pontos de dados"
  );
}
