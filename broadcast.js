const ffmpeg = require('fluent-ffmpeg');

// Almacena los procesos de FFmpeg activos
const ffmpegProcesses = {};

const broadcastManager = {
  // Inicia la transmisión para un canal
  startBroadcast: async function(channel) {
    // Validar que tengamos tanto URL de origen como destino
    if (!channel.playlist_url) {
      console.log(`Error: URL de origen (playlist_url) no encontrada para el canal ${channel.name}`);
      return;
    }

    if (!channel.rtmp_url) {
      console.log(`Error: URL de destino (rtmp_url) no encontrada para el canal ${channel.name}`);
      return;
    }

    // Verifica si ya hay un proceso activo para este canal y lo detiene
    if (ffmpegProcesses[channel.name]?.process) {
      console.log(`Transmisión activa detectada para ${channel.name}. Deteniendo la transmisión anterior.`);
      await this.stopBroadcast(channel);
    }

    console.log(`Iniciando transmisión para ${channel.name}`);
    console.log(`Origen (HLS): ${channel.playlist_url}`);
    console.log(`Destino (RTMP): ${channel.rtmp_url}`);

    try {
      const process = ffmpeg()
        .input(channel.playlist_url)
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
        .output(channel.rtmp_url);

      // Manejadores de eventos
      process
        .on('start', (commandLine) => {
          console.log(`Transmisión iniciada para ${channel.name}`);
          console.log('Comando FFmpeg:', commandLine);
          ffmpegProcesses[channel.name] = {
            process,
            status: 'running',
            startTime: new Date(),
            command: commandLine
          };
        })
        .on('error', (err, stdout, stderr) => {
          console.error(`Error en la transmisión de ${channel.name}:`, err.message);
          console.error('Error detallado:', stderr);
          ffmpegProcesses[channel.name] = {
            process: null,
            status: 'error',
            lastError: err.message,
            errorDetails: stderr
          };
          
          // Intentar reiniciar la transmisión después de un error
          setTimeout(() => {
            console.log(`Intentando reiniciar la transmisión para ${channel.name}...`);
            this.startBroadcast(channel);
          }, 5000); // Espera 5 segundos antes de reintentar
        })
        .on('end', () => {
          console.log(`Transmisión finalizada para ${channel.name}`);
          ffmpegProcesses[channel.name] = {
            process: null,
            status: 'stopped',
            endTime: new Date()
          };
          
          // Intentar reiniciar la transmisión si finaliza inesperadamente
          setTimeout(() => {
            console.log(`Reiniciando transmisión para ${channel.name}...`);
            this.startBroadcast(channel);
          }, 5000);
        });

      // Inicia la transmisión
      process.run();
    } catch (error) {
      console.error(`Error al iniciar la transmisión de ${channel.name}:`, error.message);
      ffmpegProcesses[channel.name] = {
        process: null,
        status: 'error',
        lastError: error.message
      };
    }
  },

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

  getStatus: function(channelName) {
    return ffmpegProcesses[channelName] || {
      process: null,
      status: 'stopped'
    };
  }
};

module.exports = broadcastManager;