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

# Lee la información desde el archivo channels.json
with open('channels.json', 'r') as json_file:
    urls = json.load(json_file)

# Función para descomprimir las respuestas comprimidas
def decompress_gzip(response_body):
    buf = BytesIO(response_body)
    f = gzip.GzipFile(fileobj=buf)
    return f.read()

# Extrae el channel_id de la URL
def extract_channel_id(channel_url):
    return channel_url.split("/player/channel/")[1].split("?")[0]

# Visita cada URL y actualiza las entradas en el archivo JSON
for url in urls:
    print(f"Navegando a {url['name']}")
    driver.get(url['id'])
    time.sleep(10)  # Espera para que las solicitudes se completen

    channel_id = extract_channel_id(url['id'])

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
                        url['playlist_url'] = response_json['url']  # Actualiza la URL en la entrada
                        print(f"URL encontrada para {url['name']}: {response_json['url']}")
                        break  # Sale del bucle después de encontrar la URL
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # En caso de que no se pueda parsear la respuesta como JSON o decodificarla, ignora esta respuesta
                    continue

# Cierra el navegador
driver.quit()

# Guarda los datos actualizados en el archivo JSON
with open('channels.json', 'w') as json_file:
    json.dump(urls, json_file, indent=4)

print("Datos actualizados en 'channels.json'")
