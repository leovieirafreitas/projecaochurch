
import requests

# Testando API Bolls Life (Open Source)
# https://bolls.life/api/
# Endpoint: https://bolls.life/get-chapter/ACF/1/1/ (Versão/LivroID/Capítulo)
# Livro ID: Genesis = 1? Vamos conferir.

def test_bolls():
    print("Testando Bolls Life (ACF)...")
    
    # Bolls usa IDs numéricos ou abreviações?
    # Listar bíblias para achar ACF
    try:
        r = requests.get("https://bolls.life/static/bolls/app/views/languages_conf.json")
        # Mas vamos testar direto o endpoint de texto se funcionar
        
        # Gênesis 1 na ACF
        # https://bolls.life/get-chapter/ACF/1/1/
        url = "https://bolls.life/get-chapter/ACF/1/1/"
        
        r = requests.get(url)
        print(f"Status: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            # Retorna lista de versicuos
            # [{'pk': ..., 'verse': 1, 'text': 'No princípio...'}]
            
            print(f"Versiculos retornados: {len(data)}")
            if len(data) > 0:
                print(f"V1: {data[0].get('text')}")
                
                # HTML Formatado?
                # Geralmente vem texto puro HTML
                print(f"Raw: {data[0]}")
        else:
            print("Erro Bolls")
            
    except Exception as e:
        print(f"Erro: {e}")

test_bolls()
