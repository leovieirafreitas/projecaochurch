
import requests
import urllib.parse
import sys

print("--- DIAGNOSTICO LYRICS.OVH (CONTROLE) ---")

tests = [
    ("Casa Worship", "A Casa É Sua"), # Com acento
    ("Casa Worship", "A Casa E Sua"), # Sem acento
    ("Gabriela Rocha", "Lugar Secreto"),
]

for art, tit in tests:
    url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(art)}/{urllib.parse.quote(tit)}"
    print(f"Tentando: {art} | {tit}")
    print(f"URL: {url}")
    try:
        r = requests.get(url, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(">>> SUCESSO! LETRA ENCONTRADA!")
        else:
            print("Falhou (404)")
    except Exception as e:
        print(f"Erro: {e}")
    print("-" * 20)
