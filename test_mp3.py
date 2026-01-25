
import requests

# Tentativa de encontrar URL de áudio MP3 pública e estável
# Fonte: WordProject (Bíblia Falada Português)
# Padrão provável: https://www.wordproject.org/bibles/audio/01_portuguese/B{LIVRO}___{CAPITULO}.mp3

def check_audio_source():
    # Gênesis 1
    # Livro 01, Cap 01 a 20 (as vezes tem padding)
    
    # Tentativa 1: WordProject
    # A URL costuma ser algo como:
    # https://audio.wordproject.com/bibles/app/po/1/1.mp3
    
    urls = [
        "https://www.wordproject.org/bibles/audio/01_portuguese/B01___01.mp3", # Gen 1
        "https://audio.wordproject.com/bibles/app/po/1/1.mp3"
    ]
    
    print("Testando fontes de áudio MP3...")
    
    for url in urls:
        try:
            r = requests.head(url)
            print(f"URL: {url} - Status: {r.status_code}")
            if r.status_code == 200 and 'audio' in r.headers.get('Content-Type', ''):
                print("ACHEI! Áudio válido.")
        except Exception as e:
            print(f"Erro {url}: {e}")

check_audio_source()
