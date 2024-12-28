const ffmpeg = require('fluent-ffmpeg');

// Almacena los procesos de FFmpeg activos
const ffmpegProcesses = {};

const broadcastManager = {
  // Inicia la transmisión para un canal
  startBroadcast: async function(channel) {
    if (ffmpegProcesses[channel.name]?.process) {
      console.log(`Ya existe una transmisión activa para ${channel.name}`);
      return;
    }

    console.log(`Iniciando transmisión para ${channel.name}`);
    console.log(`HLS URL: ${channel.hlsUrl}`);
    console.log(`RTMP URL: ${channel.rtmpUrl}`);

    try {
      const process = ffmpeg()
        .input(channel.hlsUrl)
        .inputOptions([
          '-re',                // Lee input a velocidad nativa
          '-reconnect 1',       // Intenta reconectar si pierde conexión
          '-reconnect_at_eof 1',
          '-reconnect_streamed 1',
          '-reconnect_delay_max 2',
          '-fflags +genpts'     // Genera timestamps
        ])
        .outputOptions([
          '-c:v copy',          // Copia el video sin recodificar
          '-c:a aac',           // Codec de audio
          '-b:a 128k',          // Bitrate de audio
          '-f flv'              // Formato de salida
        ])
        .output(channel.rtmpUrl);

      // Manejadores de eventos
      process
        .on('start', () => {
          console.log(`Transmisión iniciada para ${channel.name}`);
          ffmpegProcesses[channel.name] = { 
            process,
            status: 'running',
            startTime: new Date()
          };
        })
        .on('error', (err) => {
          console.error(`Error en la transmisión de ${channel.name}:`, err.message);
          ffmpegProcesses[channel.name] = { 
            process: null, 
            status: 'error',
            lastError: err.message
          };
        })
        .on('end', () => {
          console.log(`Transmisión finalizada para ${channel.name}`);
          ffmpegProcesses[channel.name] = { 
            process: null, 
            status: 'stopped',
            endTime: new Date()
          };
        });

      // Inicia la transmisión
      process.run();
      
      return true;
    } catch (error) {
      console.error(`Error al iniciar la transmisión de ${channel.name}:`, error);
      ffmpegProcesses[channel.name] = { 
        process: null, 
        status: 'error',
        lastError: error.message
      };
      throw error;
    }
  },

  // Detiene la transmisión de un canal
  stopBroadcast: async function(channel) {
    return new Promise((resolve) => {
      const channelProcess = ffmpegProcesses[channel.name];
      if (channelProcess?.process) {
        console.log(`Deteniendo transmisión para ${channel.name}`);
        channelProcess.process.kill('SIGTERM');
        ffmpegProcesses[channel.name] = { 
          process: null, 
          status: 'stopped',
          endTime: new Date()
        };
        resolve(true);
      } else {
        console.log(`No hay transmisión activa para ${channel.name}`);
        resolve(false);
      }
    });
  },

  // Obtiene el estado de un canal
  getStatus: function(channelName) {
    return ffmpegProcesses[channelName] || { 
      process: null, 
      status: 'stopped' 
    };
  },

  // Obtiene el estado de todos los canales
  getAllStatus: function() {
    return ffmpegProcesses;
  }
};

module.exports = broadcastManager;
