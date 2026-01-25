
import requests

# Testar Letras.mus.br
url = "https://api.letras.mus.br/winamp.php?art=Julliany%20Souza&mus=Lindo%20Momento"

print(f"Testing: {url}")
try:
    r = requests.get(url, timeout=5)
    print(f"Status: {r.status_code}")
    print(r.text[:500])
except Exception as e:
    print(e)
