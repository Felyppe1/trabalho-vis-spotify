import { renderChart3 } from "./grafico3.js";
import { renderChart4 } from "./grafico4.js";
import { grafico2 } from "./grafico2.js";
import { grafico1 } from "./grafico1.js";
import { initializeDatabase } from "./dataLoader.js";
document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  async function main() {
    try {
      progressText.textContent = "Inicializando banco de dados...";
      await initializeDatabase();
      console.log("Banco de dados inicializado");

      progressText.textContent = "Carregando dados do Spotify...";
      progressBar.style.width = "50%";

      progressText.textContent = "Carregando GeoJSON do mundo...";
      progressBar.style.width = "75%";
      const geoData = await d3.json("./data/world.geojson");
      progressText.textContent = "Construindo gráficos...";
      progressBar.style.width = "90%";

      await grafico1();
      await grafico2();
      await renderChart3(geoData, function (siglaPais) {
        renderChart4(siglaPais);
      });

      progressBar.style.width = "100%";
      progressText.textContent = "Tudo pronto!";
      await new Promise((r) => setTimeout(r, 500));
      loadingOverlay.style.display = "none";
    } catch (error) {
      console.error("Erro no carregamento dos dados:", error);
      alert("Erro no carregamento dos dados: veja o console");
    }
  }

  main();
});
