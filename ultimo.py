import json
from seleniumwire import webdriver  # Importa selenium-wire
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import time

# Opciones para el navegador
chrome_options = Options()
# chrome_options.add_argument("--headless")  # Ejecuta el navegador sin ventana visible

# Inicializa el WebDriver para Chrome con Selenium-Wire
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

# Abre la página de login
driver.get("https://www.tdmax.com/login")
time.sleep(3)

# Realiza el inicio de sesión
email_field = driver.find_element(By.XPATH, '/html/body/streann-root/div[1]/streann-login/div/div[1]/form/streann-custom-input[1]/div/div[2]/input')
email_field.send_keys("arlopfa@gmail.com")

password_field = driver.find_element(By.XPATH, '/html/body/streann-root/div[1]/streann-login/div/div[1]/form/streann-custom-input[2]/div/div[2]/input')
password_field.send_keys("vM5SdnKpPjlypvJW")

login_button = driver.find_element(By.XPATH, '/html/body/streann-root/div[1]/streann-login/div/div[1]/form/div[2]/button')
login_button.click()
time.sleep(10)

# Lista de URLs a visitar
urls = [
    {
        'name': 'Channel 1',
        'url': 'https://www.tdmax.com/player/channel/617c2f66e4b045a692106126?isFromTabLayout=true',
        'rtmp_url': 'rtmp://fluestabiliz.giize.com/costaCANAL11',
    },
    {
        'name': 'Channel 2',
        'url': 'https://www.tdmax.com/player/channel/65d7aca4e4b0140cbf380bd0?isFromTabLayout=true',
        'rtmp_url': None,
    },
    {
        'name': 'Channel 3',
        'url': "https://www.tdmax.com/player/channel/641cba02e4b068d89b2344e3?isFromTabLayout=true",
        'rtmp_url': None
    },
    {
        'name': 'Channel 4',
        'url': "https://www.tdmax.com/player/channel/65d7ac79e4b0140cbf380bca?isFromTabLayout=true",
        'rtmp_url': None
    },
    {
        'name': 'Channel 5',
        'url': "https://www.tdmax.com/player/channel/664237788f085ac1f2a15f81?isFromTabLayout=true",
        'rtmp_url': None
    }
]

# Visita cada URL y captura las solicitudes
for url in urls:
    print(f"Navegando a {url['name']}")
    driver.get(url['url'])
    time.sleep(10)  # Espera para que las solicitudes se completen
    
    # Busca las solicitudes con playlist.m3u8
    for request in driver.requests:
        if request.response:  # Solo solicitudes con respuesta
            if "playlist.m3u8" in request.url:
                url['playlist_url'] = request.url  # Guarda la URL encontrada
                print(f"URL encontrada para {url['name']}: {request.url}")
                break  # Sale del bucle después de encontrar la URL

# Cierra el navegador
driver.quit()

# Guarda los datos en un archivo JSON
with open('channels.json', 'w') as json_file:
    json.dump(urls, json_file, indent=4)

print("Datos guardados en 'channels.json'")
