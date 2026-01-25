
import requests

# Testar endpoint Winamp do Letras.mus.br com parametro 't' (busca livre)
# Esse endpoint era usado por plugins antigos e costuma retornar XML direto.

url = "https://www.letras.mus.br/winamp.php?t=Julliany%20Souza%20Lindo%20Momento"
print(f"Testing: {url}")

try:
    r = requests.get(url, timeout=5)
    print(f"Status: {r.status_code}")
    print(r.text[:500])
except Exception as e:
    print(e)
