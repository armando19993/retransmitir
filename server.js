// Requiere las librerías necesarias
const express = require("express");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const app = express();
const PORT = 3000;

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

// Función para iniciar transmisión
function startBroadcast(channelName, hlsUrl, rtmpUrl) {
  console.log(`Iniciando retransmisión para ${channelName} desde: ${hlsUrl}`);

  const process = ffmpeg()
    .input(hlsUrl)
    .inputOptions(["-fflags +genpts", "-re"])
    .outputOptions([
      "-c:v libx264",
      "-preset medium",
      "-tune zerolatency",
      "-c:a aac",
      "-b:a 128k",
      "-b:v 1500k",
      "-maxrate 2000k",
      "-bufsize 6000k",
      "-f flv",
    ])
    .output(rtmpUrl)
    .on("start", () => {
      console.log(`Transmisión iniciada para ${channelName}`);
      ffmpegProcesses[channelName] = { process, status: "running" };
    })
    .on("error", (err) => {
      console.error(`Error en la transmisión de ${channelName}:`, err.message);
      ffmpegProcesses[channelName] = { process: null, status: "error" };
    })
    .on("end", () => {
      console.log(`Transmisión finalizada para ${channelName}`);
      ffmpegProcesses[channelName] = { process: null, status: "stopped" };
    })
    .run();
}

// Función para detener transmisión
function stopBroadcast(channelName) {
  return new Promise((resolve) => {
    const channelProcess = ffmpegProcesses[channelName];
    if (channelProcess && channelProcess.process) {
      console.log(`Deteniendo transmisión para ${channelName}`);
      channelProcess.process.kill("SIGTERM");
      ffmpegProcesses[channelName] = { process: null, status: "stopped" };
      resolve(true);
    } else {
      resolve(false);
    }
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
    channels.push({ name, hlsUrl, rtmpUrl });
    await saveChannels(channels);
    res.redirect("/channels");
  } catch (err) {
    res.status(500).send("Error al guardar el nuevo canal.");
  }
});

// Ruta para iniciar transmisión
app.post("/channels/start", async (req, res) => {
  const { name } = req.body;

  try {
    const data = await fs.promises.readFile(channelsFile, "utf-8");
    const channels = JSON.parse(data);
    const channel = channels.find((c) => c.name === name);

    if (channel) {
      startBroadcast(channel.name, channel.hlsUrl, channel.rtmpUrl);
      res.redirect("/channels");
    } else {
      res.status(404).send("Canal no encontrado.");
    }
  } catch (err) {
    res.status(500).send("Error al iniciar la transmisión.");
  }
});

// Ruta para detener transmisión
app.post("/channels/stop", async (req, res) => {
  const { name } = req.body;

  try {
    const stopped = await stopBroadcast(name);
    if (stopped) {
      res.redirect("/channels");
    } else {
      res.status(404).send("No se está transmitiendo ese canal.");
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
    const updatedChannels = channels.filter((c) => c.name !== name);

    await stopBroadcast(name); // Detener transmisión si está activa
    await saveChannels(updatedChannels);
    res.redirect("/channels");
  } catch (err) {
    res.status(500).send("Error al eliminar el canal.");
  }
});


app.post("/channels/edit", (req, res) => {
  const { index, name, hlsUrl, rtmpUrl } = req.body;

  fs.readFile(channelsFile, "utf-8", (err, data) => {
    if (err) {
      return res.status(500).send("Error al leer el archivo de canales.");
    }

    const channels = JSON.parse(data);

    if (index >= 0 && index < channels.length) {
      channels[index] = { name, hlsUrl, rtmpUrl };
    } else {
      return res.status(400).send("Índice de canal no válido.");
    }

    fs.writeFile(channelsFile, JSON.stringify(channels, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Error al guardar el canal editado.");
      }
      res.redirect("/channels");
    });
  });
});


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
