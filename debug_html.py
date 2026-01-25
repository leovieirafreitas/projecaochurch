
import requests
import json
import os

APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json",
    "User-Agent": "PostmanRuntime/7.26.8" 
}

def get_html(version_id, passage_id, filename):
    print(f"Baixando {passage_id} (Versão {version_id})...")
    
    # Tentando com parâmetros extras que talvez ajudem
    url = f"{BASE_URL}/bibles/{version_id}/passages/{passage_id}?include_notes=false&include_headings=true"
    
    try:
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            # Tenta pegar content direto ou em data.content
            content = data.get('content') or data.get('data', {}).get('content')
            
            if content:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Sucesso! Salvo em {filename}")
                print(f"Preview (primeiros 200 chars): {content[:200]}")
            else:
                print("Conteúdo vazio/nulo encontrado no JSON.")
        else:
            print(f"Erro API: {r.status_code}")
            print(r.text)
            
    except Exception as e:
        print(f"Erro Script: {e}")

# Testar NVI (129)
get_html("129", "GEN.1", "nvi_gen1.html")

# Testar outra versão (ASV - 12 - Domínio Público, costuma ser mais 'suja' de tags)
get_html("12", "GEN.1", "asv_gen1.html")
