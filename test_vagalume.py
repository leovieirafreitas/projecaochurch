
import requests

# Teste com uma musica "facil" e famosa
url = "https://api.vagalume.com.br/search.php?art=Casa%20Worship&mus=A%20Casa%20E%20Sua"

print(f"Testing: {url}")
try:
    r = requests.get(url, timeout=5)
    print(f"Status: {r.status_code}")
    print(r.text[:500])
except Exception as e:
    print(e)
