// broadcast.js
const ffmpeg = require("fluent-ffmpeg");
const puppeteer = require('puppeteer');
const path = require('path');

class BroadcastManager {
  constructor() {
    this.ffmpegProcesses = new Map(); // Almacena los procesos por nombre de canal
    this.refreshIntervals = new Map(); // Almacena los intervalos de actualización
    this.proxy = {
      protocol: 'http',
      host: 'geo.iproyal.com',
      port: 12321,
      auth: {
        username: '8f5rPXvqWW6AIar4',
        password: 'zLB6CCfYyc9BEii2_country-cr'
      }
    };
  }

  async getHlsUrl(channel) {
    // Implementar lógica específica por canal para obtener URL
    if (channel.requiresAuth) {
      return await this._getTDMaxUrl(channel);
    }
    return channel.hlsUrl;
  }

  async _getTDMaxUrl(channel) {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=http://${this.proxy.host}:${this.proxy.port}`
      ]
    });

    try {
      const page = await browser.newPage();
      await page.authenticate(this.proxy.auth);
      
      // Login process
      await page.goto('https://www.tdmax.com/login', { waitUntil: 'networkidle2' });
      await page.waitForSelector('input#auto-login-emailLabel', {visible: true});
      await page.type('input#auto-login-emailLabel', channel.authEmail);
      await page.waitForSelector('input#auto_password', {visible: true});
      await page.type('input#auto_password', channel.authPassword);
      await page.click('#auto-login-button');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Get stream URL
      await page.goto(channel.streamPageUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 10000));
      await page.select('select#showFirstLast', 'last');
      const link = await page.$eval('a#m3u8Link', element => element.textContent.trim());
      
      return link;
    } finally {
      await browser.close();
    }
  }

  startBroadcast(channel) {
    console.log(`Iniciando transmisión para canal: ${channel.name}`);
    
    const process = ffmpeg()
      .input(channel.hlsUrl)
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
      .output(channel.rtmpUrl)
      .on("start", () => {
        console.log(`Transmisión iniciada para ${channel.name}`);
      })
      .on("error", async (err) => {
        console.error(`Error en transmisión de ${channel.name}:`, err.message);
        await this.restartBroadcast(channel);
      })
      .on("end", async () => {
        console.log(`Transmisión finalizada para ${channel.name}`);
        await this.restartBroadcast(channel);
      });

    this.ffmpegProcesses.set(channel.name, process.run());

    // Configurar actualización periódica de URL si es necesario
    if (channel.requiresAuth) {
      this.refreshIntervals.set(channel.name, setInterval(async () => {
        await this.updateChannelUrl(channel);
      }, channel.refreshInterval || 3600000));
    }
  }

  async stopBroadcast(channel) {
    const process = this.ffmpegProcesses.get(channel.name);
    if (process) {
      return new Promise((resolve) => {
        try {
          process.kill('SIGTERM');
          setTimeout(() => {
            if (this.ffmpegProcesses.has(channel.name)) {
              process.kill('SIGKILL');
              this.ffmpegProcesses.delete(channel.name);
            }
            resolve();
          }, 5000);
        } catch (error) {
          console.error(`Error al detener ${channel.name}:`, error);
          this.ffmpegProcesses.delete(channel.name);
          resolve();
        }
      });
    }
  }

  async restartBroadcast(channel) {
    await this.stopBroadcast(channel);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Actualizar URL si es necesario
    if (channel.requiresAuth) {
      const newUrl = await this.getHlsUrl(channel);
      channel.hlsUrl = newUrl;
    }
    
    this.startBroadcast(channel);
  }

  async updateChannelUrl(channel) {
    try {
      const newUrl = await this.getHlsUrl(channel);
      if (newUrl !== channel.hlsUrl) {
        channel.hlsUrl = newUrl;
        await this.restartBroadcast(channel);
      }
    } catch (error) {
      console.error(`Error actualizando URL para ${channel.name}:`, error);
    }
  }
}

module.exports = new BroadcastManager();