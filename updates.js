const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    // Archivo de canales
    const channels = [
        {
            name: 'Channel 1',
            url: 'https://www.tdmax.com/player/channel/617c2f66e4b045a692106126?isFromTabLayout=true',
            rtmpUrl: 'rtmp://fluestabiliz.giize.com/costaCANAL11',
        },
        {
            name: 'Channel 2',
            url: 'https://www.tdmax.com/player/channel/65d7aca4e4b0140cbf380bd0?isFromTabLayout=true',
            rtmpUrl: null,
        },
        {
            name: 'Channel 3',
            url: 'https://www.tdmax.com/player/channel/641cba02e4b068d89b2344e3?isFromTabLayout=true',
            rtmpUrl: null,
        },
        {
            name: 'Channel 4',
            url: 'https://www.tdmax.com/player/channel/65d7ac79e4b0140cbf380bca?isFromTabLayout=true',
            rtmpUrl: null,
        },
        {
            name: 'Channel 5',
            url: 'https://www.tdmax.com/player/channel/664237788f085ac1f2a15f81?isFromTabLayout=true',
            rtmpUrl: null,
        },
    ];

    // Inicia el navegador
    const browser = await puppeteer.launch({ headless: false }); // Cambia a true para ejecución sin interfaz gráfica
    const page = await browser.newPage();

    // Accede a la página de inicio de sesión
    await page.goto('https://www.tdmax.com/login', { waitUntil: 'networkidle2' });

    // Completa el formulario de inicio de sesión
    await page.type('input[type=email]', 'arlopfa@gmail.com');
    await page.type('input[type=password]', 'vM5SdnKpPjlypvJW');

    // Haz clic en el botón de inicio de sesión
    await page.click('button[type=submit]');
    await page.waitForTimeout(5000); // Espera para asegurarte que el inicio de sesión se complete

    // Itera sobre las URLs de los canales
    for (let channel of channels) {
        console.log(`Navegando a ${channel.name}: ${channel.url}`);
        await page.goto(channel.url, { waitUntil: 'networkidle2' });

        // Intercepta las solicitudes de red
        const playlistUrl = await page.evaluate(() => {
            return new Promise((resolve) => {
                const originalOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function (method, url) {
                    if (url.includes('playlist.m3u8')) {
                        resolve(url);
                    }
                    originalOpen.apply(this, arguments);
                };
            });
        });

        // Actualiza el objeto del canal con la URL encontrada
        channel.playlistUrl = playlistUrl || null;
        console.log(`URL encontrada para ${channel.name}: ${playlistUrl}`);
    }

    // Guarda los resultados en channels.json
    fs.writeFileSync('channels.json', JSON.stringify(channels, null, 2));
    console.log('Información guardada en channels.json');

    // Cierra el navegador
    await browser.close();
})();
