import json
import gzip
from io import BytesIO
from seleniumwire import webdriver  # Importa selenium-wire
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import time

# Opciones para el navegador
chrome_options = Options()
chrome_options.add_argument("--headless")  # Ejecuta el navegador sin ventana visible
chrome_options.add_argument("--no-sandbox")  # Ejecuta el navegador sin restricciones

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
        'name': 'Teletica',
        'url': 'https://www.tdmax.com/player/channel/617c2f66e4b045a692106126?isFromTabLayout=true',
        'rtmp_url': 'rtmp://fluestabiliz.giize.com/costaCANAL11',
    },
    {
        'name': 'Canal 6',
        'url': 'https://www.tdmax.com/player/channel/65d7aca4e4b0140cbf380bd0?isFromTabLayout=true',
        'rtmp_url': None,
    },
    {
        'name': 'FuTV',
        'url': "https://www.tdmax.com/player/channel/641cba02e4b068d89b2344e3?isFromTabLayout=true",
        'rtmp_url': None
    },
    {
        'name': 'Canal 11',
        'url': "https://www.tdmax.com/player/channel/65d7ac79e4b0140cbf380bca?isFromTabLayout=true",
        'rtmp_url': None
    },
    {
        'name': 'Tigo',
        'url': "https://www.tdmax.com/player/channel/664237788f085ac1f2a15f81?isFromTabLayout=true",
        'rtmp_url': None
    }
]

# Función para descomprimir las respuestas comprimidas
def decompress_gzip(response_body):
    buf = BytesIO(response_body)
    f = gzip.GzipFile(fileobj=buf)
    return f.read()

# Extrae el channel_id de la URL
def extract_channel_id(channel_url):
    return channel_url.split("/player/channel/")[1].split("?")[0]

# Visita cada URL y captura las solicitudes
for url in urls:
    print(f"Navegando a {url['name']}")
    driver.get(url['url'])
    time.sleep(10)  # Espera para que las solicitudes se completen

    channel_id = extract_channel_id(url['url'])

    # Busca las solicitudes específicas
    for request in driver.requests:
        if request.response:  # Solo solicitudes con respuesta
            if request.url.startswith(f"https://api.streann.tech/loadbalancer/services/v1/channels-secure/{channel_id}") and "playlist.m3u8?access_token=" in request.url:
                try:
                    # Verifica si la respuesta está comprimida (gzip)
                    if request.response.headers.get('Content-Encoding', '') == 'gzip':
                        response_body = decompress_gzip(request.response.body)
                    else:
                        response_body = request.response.body
                    
                    # Intenta parsear el JSON de la respuesta
                    response_json = json.loads(response_body.decode('utf-8'))
                    if "url" in response_json:  # Verifica si la respuesta contiene la URL
                        url['playlist_url'] = response_json['url']  # Guarda la URL encontrada
                        print(f"URL encontrada para {url['name']}: {response_json['url']}")
                        break  # Sale del bucle después de encontrar la URL
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # En caso de que no se pueda parsear la respuesta como JSON o decodificarla, ignora esta respuesta
                    continue

# Cierra el navegador
driver.quit()

# Guarda los datos en un archivo JSON
with open('channels.json', 'w') as json_file:
    json.dump(urls, json_file, indent=4)

print("Datos guardados en 'channels.json'")
