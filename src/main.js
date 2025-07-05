import { renderChart3 } from "./grafico3.js";
import { renderChart4 } from "./grafico4.js";
import { grafico2 } from "./grafico2.js";
document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

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
      const geoData = await d3.json("./data/world.geojson");
      console.log("GeoJSON carregado:", geoData.features.length, "features");

      progressBar.style.width = "100%";
      progressText.textContent = "Dados carregados. Preparando visualização...";
      await new Promise((r) => setTimeout(r, 500));

      loadingOverlay.style.display = "none";
    data.forEach(d => {
        d.album_release_date = new Date(new Date(d.album_release_date).getTime() + 3 * 60 * 60 * 1000);
    });

      grafico2(data);
      renderChart3(data, geoData, function (siglaPais) {
        renderChart4(data, siglaPais);
      });
    } catch (error) {
      console.error("Erro no carregamento dos dados:", error);
      alert("Erro no carregamento dos dados: veja o console");
    }
  }

  main();
});
