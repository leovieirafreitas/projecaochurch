
import requests
import json

# Testando API da ABibliaDigital para versão ACF (Almeida Corrigida Fiel)
# Documentação: https://www.abibliadigital.com.br/api

BASE_URL = "https://www.abibliadigital.com.br/api"

def test_acf():
    print("Testando Almeida Corrigida Fiel (ACF)...")
    
    # Endpoint: /verses/:version/:book/:chapter
    # ACF / gn (Genesis) / 1
    url = f"{BASE_URL}/verses/acf/gn/1"
    
    try:
        r = requests.get(url)
        print(f"Status: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            chapter_info = data.get('chapter', {})
            verses = data.get('verses', [])
            
            print(f"Capítulo: {chapter_info.get('number')} de {data.get('book', {}).get('name')}")
            print(f"Total Versículos: {len(verses)}")
            
            if verses:
                v1 = verses[0]
                print(f"Versículo 1: {v1.get('text')}")
        else:
            print("Erro na API Externa")
            
    except Exception as e:
        print(f"Erro Script: {e}")

test_acf()
