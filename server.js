// Requiere las librerías necesarias
const express = require("express");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const cors = require('cors');
const app = express();
const PORT = 3000;
const broadcastManager = require('./broadcast');

app.use(cors());
// Rutas de los archivos
const channelsFile = path.join(__dirname, "channels.json");

// Configurar EJS como motor de vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware para archivos estáticos
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); // Procesar formularios
app.use(express.json()); // Procesar datos JSON

// Variables para gestionar procesos FFmpeg
const ffmpegProcesses = {}; // Almacena los procesos de cada canal por su nombre

// Función para guardar cambios en el archivo channels.json
function saveChannels(channels) {
  return new Promise((resolve, reject) => {
    fs.writeFile(channelsFile, JSON.stringify(channels, null, 2), (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}


// Ruta principal
app.get("/", (req, res) => {
  res.render("index", { title: "Bienvenido", message: "Gestión de Canales" });
});

// Ruta para listar canales y estados
app.get("/channels", (req, res) => {
  fs.readFile(channelsFile, "utf-8", (err, data) => {
    if (err) return res.status(500).send("Error al leer el archivo de canales.");
    const channels = JSON.parse(data);

    // Adjuntar estado actual de cada canal
    channels.forEach((channel) => {
      channel.status = ffmpegProcesses[channel.name]?.status || "stopped";
    });

    res.render("channels", { channels });
  });
});

// Ruta para agregar un nuevo canal
app.post("/channels/add", async (req, res) => {
  const { name, hlsUrl, rtmpUrl } = req.body;

  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);
    channels.push({ name, hlsUrl, rtmpUrl, lastUpdated: new Date().toISOString() });
    await saveChannels(channels);
    res.redirect("/channels");
  } catch (err) {
    res.status(500).send("Error al guardar el nuevo canal.");
  }
});

// Ruta para iniciar transmisión
app.post("/channels/start", async (req, res) => {
  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    for (const channel of channels) {
      if (channel.rtmp_url) {
        try {
          await broadcastManager.startBroadcast(channel);
          console.log(`Transmisión iniciada para el canal: ${channel.name}`);
        } catch (err) {
          console.error(`Error al iniciar transmisión para ${channel.name}:`, err.message);
        }
      } else {
        console.log(`Canal ${channel.name} no tiene una URL RTMP válida, omitido.`);
      }
    }

    res.redirect("channels");
  } catch (err) {
    console.error("Error al iniciar las transmisiones:", err.message);
    res.status(500).send("Error al iniciar las transmisiones.");
  }
});

// Ruta para detener transmisión
app.post("/channels/stop", async (req, res) => {
  const { name } = req.body;

  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);
    const channel = channels.find((c) => c.name === name);

    if (channel) {
      await broadcastManager.stopBroadcast(channel);
      res.redirect("/channels");
    } else {
      res.status(404).send("Canal no encontrado.");
    }
  } catch (err) {
    res.status(500).send("Error al detener la transmisión.");
  }
});

// Ruta para eliminar un canal
app.post("/channels/delete", async (req, res) => {
  const { name } = req.body;

  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    // Filtra el canal que corresponde al `name`
    const updatedChannels = channels.filter((c) => c.name !== name);

    if (channels.length === updatedChannels.length) {
      // No se encontró el canal a eliminar
      return res.status(404).send("Canal no encontrado.");
    }

    await broadcastManager.stopBroadcast(name);
    await saveChannels(updatedChannels); // Guardar los cambios en el archivo
    res.redirect("/channels");
  } catch (err) {
    console.error("Error al eliminar el canal:", err); // Log de detalle
    res.status(500).send("Error al eliminar el canal: " + err.message); // Mensaje más detallado
  }
});



app.post("/channels/edit", async (req, res) => {
  const { index, name, rtmp_url } = req.body;

  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    if (index >= 0 && index < channels.length) {
      // Mantener los campos existentes y actualizar solo los proporcionados
      channels[index] = {
        ...channels[index],
        name: name || channels[index].name,
        rtmp_url: rtmp_url,
        lastUpdated: new Date().toISOString()
      };

      await saveChannels(channels);
      res.redirect("/channels");
    } else {
      res.status(400).json({ error: "Índice de canal no válido" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el canal" });
  }
});

// Agregar estas nuevas rutas justo antes de app.listen(PORT, ...)

// Ruta para iniciar todas las transmisiones
const { exec } = require("child_process");

// Ruta para iniciar todas las transmisiones
app.post("/channels/startAll", async (req, res) => {
  try {
    // Función para ejecutar el script Python
    const runPythonScript = () => {
      return new Promise((resolve, reject) => {
        exec("python3 import\\ json.py", (error, stdout, stderr) => {
          if (error) {
            console.error(`Error al ejecutar el script Python: ${error.message}`);
            return reject(error);
          }
          if (stderr) {
            console.error(`Error en el script Python: ${stderr}`);
          }
          console.log(`Salida del script Python: ${stdout}`);
          resolve();
        });
      });
    };

    // Ejecutar el script Python y esperar su finalización
    console.log("Ejecutando script Python...");
    await runPythonScript();
    console.log("Script Python ejecutado correctamente.");

    // Leer los canales del archivo JSON
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    console.log("Iniciando todas las transmisiones...");
    for (const channel of channels) {
      if (channel.rtmp_url) {
        try {
          await broadcastManager.startBroadcast(channel);
          console.log(`Transmisión iniciada para el canal: ${channel.name}`);
        } catch (err) {
          console.error(`Error al iniciar transmisión para ${channel.name}:`, err.message);
        }
      } else {
        console.log(`Canal ${channel.name} no tiene una URL RTMP válida, omitido.`);
      }
    }

    res.redirect("/channels");
  } catch (err) {
    console.error("Error al iniciar todas las transmisiones:", err.message);
    res.status(500).send("Error al iniciar todas las transmisiones.");
  }
});

app.get('/channels/list', async (req, res) => {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(channelsFile)) {
      return res.status(404).json({
        error: 'Channels file not found'
      });
    }

    // Leer y parsear el archivo
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    // Enviar respuesta
    res.status(200).json(channels);

  } catch (error) {
    console.error('Error reading channels:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});


// Ruta para detener todas las transmisiones
app.post("/channels/stopAll", async (req, res) => {
  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);

    console.log("Deteniendo todas las transmisiones...");
    for (const channel of channels) {
      try {
        await broadcastManager.stopBroadcast(channel);
        console.log(`Transmisión detenida para el canal: ${channel.name}`);
      } catch (err) {
        console.error(`Error al detener transmisión para ${channel.name}:`, err.message);
      }
    }

    res.redirect("/channels");
  } catch (err) {
    console.error("Error al detener todas las transmisiones:", err.message);
    res.status(500).send("Error al detener todas las transmisiones.");
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
