
import requests
import json

APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json"
}

def check_audio():
    print("Investigando Áudio na NVI (129)...")
    
    # 1. Ver na lista de versões se tem flag de áudio
    r = requests.get(f"{BASE_URL}/bibles?language_ranges[]=por", headers=headers)
    if r.status_code == 200:
        bibles = r.json().get('data', [])
        nvi = next((b for b in bibles if b['id'] == '129'), None)
        if nvi:
            print(f"Versão NVI tem áudio? {nvi.get('audio_bibles', 'N/A')}")
            # Às vezes o audio é uma "Bíblia" separada linkada
            
    # 2. Ver no capítulo
    # GET /bibles/129/books/GEN/chapters/1 (ou similar)
    # A rota de chapters retorna lista de capitulos. Vamos ver um item.
    r = requests.get(f"{BASE_URL}/bibles/129/books/GEN/chapters", headers=headers)
    if r.status_code == 200:
        chapters = r.json().get('data', [])
        if chapters:
            c1 = chapters[0]
            print(f"Capítulo 1 Dados: {c1.keys()}")
            print(f"Audio URL? {c1.get('audio_url')} ou {c1.get('audio_path')}")

check_audio()
