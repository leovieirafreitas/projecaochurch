
import requests
import json

APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json",
    "User-Agent": "PostmanRuntime/7.26.8" 
}

def analyze():
    print("--- 1. ANALISANDO VERSÕES ---")
    r = requests.get(f"{BASE_URL}/bibles?language_ranges[]=por", headers=headers)
    if r.status_code == 200:
        data = r.json().get('data', [])
        if data:
            v = data[0]
            print("Chaves disponíveis na versão:", v.keys())
            print(f"Exemplo: Name='{v.get('name')}', LocalTitle='{v.get('local_title')}', Abbrev='{v.get('abbreviation')}'")
    else:
        print("Erro ao buscar versões")

    print("\n--- 2. ANALISANDO HTML DOS VERSÍCULOS ---")
    r = requests.get(f"{BASE_URL}/bibles/129/passages/GEN.1", headers=headers)
    if r.status_code == 200:
        try:
            content = r.json().get('content', '')
            if not content:
                content = r.json().get('data', {}).get('content', '')
            
            print("HTML Bruto (primeiros 1000 chars):")
            print(content[:1000])
        except:
            print("Erro ao ler JSON")

analyze()
