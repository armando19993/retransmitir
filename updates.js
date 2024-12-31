const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const channels = [
        {
            name: 'Channel 1',
            url: 'https://www.tdmax.com/player/channel/617c2f66e4b045a692106126?isFromTabLayout=true',
            rtmpUrl: 'rtmp://fluestabiliz.giize.com/costaCANAL11',
        },
        // Agrega más canales según sea necesario
    ];

    // Inicia el navegador con las opciones necesarias
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Accede a la página de inicio de sesión
    await page.goto('https://www.tdmax.com/login', { waitUntil: 'networkidle2' });

    await page.type('input[type=email]', 'arlopfa@gmail.com');
    await page.type('input[type=password]', 'vM5SdnKpPjlypvJW');
    await page.click('button[type=submit]');
    await page.waitForTimeout(5000);

    for (let channel of channels) {
        console.log(`Navegando a ${channel.name}: ${channel.url}`);
        await page.goto(channel.url, { waitUntil: 'networkidle2' });

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

        channel.playlistUrl = playlistUrl || null;
        console.log(`URL encontrada para ${channel.name}: ${playlistUrl}`);
    }

    fs.writeFileSync('channels.json', JSON.stringify(channels, null, 2));
    console.log('Información guardada en channels.json');

    await browser.close();
})();
