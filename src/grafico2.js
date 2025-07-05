export function grafico2(data) {
    const svg = d3.select("#chart2 svg");

    const uniqueTracks = Array.from(
        d3
        .rollup(
            data.filter((d) => d.album_release_date && d.duration_ms),
            (v) => v[0], 
            (d) => d.spotify_id 
        )
        .values()
    );

    uniqueTracks.forEach((d) => {
        d.release_year = new Date(d.album_release_date).getFullYear();
    });

    
    const statsByYear = Array.from(
        d3.group(uniqueTracks, (d) => d.release_year),
        ([year, values]) => {
        const durations = values.map((d) => d.duration_ms / 60000); 
        const avgDuration = d3.mean(durations);

        
        const total = values.length;
        const under2 = values.filter((d) => d.duration_ms / 60000 < 2).length;
        const between2and3 = values.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 2 && min < 3;
        }).length;
        const between3and4 = values.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 3 && min < 4;
        }).length;
        const between4and5 = values.filter((d) => {
            const min = d.duration_ms / 60000;
            return min >= 4 && min < 5;
        }).length;
        const over5 = values.filter((d) => d.duration_ms / 60000 >= 5).length;

        
        const shortest = values.reduce((a, b) =>
            a.duration_ms < b.duration_ms ? a : b
        );
        const longest = values.reduce((a, b) =>
            a.duration_ms > b.duration_ms ? a : b
        );

        return {
            year: +year,
            avg_duration_min: Math.round(avgDuration * 100) / 100,
            stats: {
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
            total,
            },
        };
        }
    ).sort((a, b) => a.year - b.year);

    const durationByYear = statsByYear;

    
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

    
    function brushed(event) {
        const selection = event.selection;

        if (!selection) {
        brushInfo.style("display", "none");
        return;
        }

        
        const [x0, x1] = selection.map(xScale.invert);

        
        const selectedYears = durationByYear.filter(
        (d) => d.year >= x0 && d.year <= x1
        );

        if (selectedYears.length === 0) {
        brushInfo.style("display", "none");
        return;
        }

        
        const allSongsInPeriod = [];
        selectedYears.forEach((yearData) => {
        
        const songsInYear = uniqueTracks.filter(
            (d) => d.release_year === yearData.year
        );
        allSongsInPeriod.push(...songsInYear);
        });

        if (allSongsInPeriod.length === 0) {
        brushInfo.style("display", "none");
        return;
        }

        
        const durations = allSongsInPeriod.map((d) => d.duration_ms / 60000);
        const avgDuration = d3.mean(durations);

        const total = allSongsInPeriod.length;
        const under2 = allSongsInPeriod.filter(
        (d) => d.duration_ms / 60000 < 2
        ).length;
        const between2and3 = allSongsInPeriod.filter((d) => {
        const min = d.duration_ms / 60000;
        return min >= 2 && min < 3;
        }).length;
        const between3and4 = allSongsInPeriod.filter((d) => {
        const min = d.duration_ms / 60000;
        return min >= 3 && min < 4;
        }).length;
        const between4and5 = allSongsInPeriod.filter((d) => {
        const min = d.duration_ms / 60000;
        return min >= 4 && min < 5;
        }).length;
        const over5 = allSongsInPeriod.filter(
        (d) => d.duration_ms / 60000 >= 5
        ).length;

        const shortest = allSongsInPeriod.reduce((a, b) =>
        a.duration_ms < b.duration_ms ? a : b
        );
        const longest = allSongsInPeriod.reduce((a, b) =>
        a.duration_ms > b.duration_ms ? a : b
        );

        const percentages = {
        under2: ((under2 / total) * 100).toFixed(1),
        between2and3: ((between2and3 / total) * 100).toFixed(1),
        between3and4: ((between3and4 / total) * 100).toFixed(1),
        between4and5: ((between4and5 / total) * 100).toFixed(1),
        over5: ((over5 / total) * 100).toFixed(1),
        };

        const startYear = Math.floor(x0);
        const endYear = Math.ceil(x1);
        const periodText =
        startYear === endYear ? startYear : `${startYear} - ${endYear}`;

        brushInfo.style("display", "block").html(`
                <div style="font-weight: bold; margin-bottom: 12px; color: #333; border-bottom: 2px solid #1DB954; padding-bottom: 8px; font-size: 16px;">
                    📊 Análise do Período Selecionado: ${periodText}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                    <div>
                        <div style="margin-bottom: 8px;"><strong>Total de músicas:</strong> ${total.toLocaleString()}</div>
                        <div style="margin-bottom: 8px;"><strong>Duração Média:</strong> ${avgDuration.toFixed(
                        2
                        )} min</div>
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #555; margin-bottom: 6px;">Distribuição por Duração:</div>
                        <div style="font-size: 13px;">
                            • Menos de 2 min: ${percentages.under2}%<br>
                            • Entre 2-3 min: ${percentages.between2and3}%<br>
                            • Entre 3-4 min: ${percentages.between3and4}%<br>
                            • Entre 4-5 min: ${percentages.between4and5}%<br>
                            • Mais de 5 min: ${percentages.over5}%
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background: #fff; padding: 10px; border-radius: 6px; border-left: 4px solid #1DB954;">
                        <div style="font-weight: bold; color: #555; margin-bottom: 6px;">🎵 Música Mais Curta:</div>
                        <div style="font-size: 13px;">
                            <strong>"${shortest.name}"</strong><br>
                            por ${shortest.artists}<br>
                            <span style="color: #1DB954; font-weight: bold;">${(
                            shortest.duration_ms / 60000
                            ).toFixed(2)} min</span>
                        </div>
                    </div>
                    <div style="background: #fff; padding: 10px; border-radius: 6px; border-left: 4px solid #ff6b6b;">
                        <div style="font-weight: bold; color: #555; margin-bottom: 6px;">🎶 Música Mais Longa:</div>
                        <div style="font-size: 13px;">
                            <strong>"${longest.name}"</strong><br>
                            por ${longest.artists}<br>
                            <span style="color: #ff6b6b; font-weight: bold;">${(
                            longest.duration_ms / 60000
                            ).toFixed(2)} min</span>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; text-align: center;">
                    💡 Arraste no gráfico para selecionar diferentes períodos | Passe o mouse sobre os pontos para dados específicos
                </div>
            `);
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
