#!/usr/bin/env python3
"""
Verifica a chave da API YouVersion e lista versões em português (com parametro corrigido).
"""

import requests
import json

APP_KEY = "SLYCefOBEYni8Ej4fV8A4BzqrdAl6HY1B2aK8erAt5GJQs76"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json"
}

def get_bibles():
    print("="*60)
    print("BUSCANDO BÍBLIAS (Português)")
    print("="*60)
    
    # Adicionando parametro de linguagem obrigatório
    url = f"{BASE_URL}/bibles?language_tag=por"
    
    print(f"URL: {url}")
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            bibles = data.get('data', [])
            print(f"Total de Bíblias encontradas: {len(bibles)}")
            
            for b in bibles[:10]: 
                print(f" - {b['name']} (ID: {b['id']}) - {b.get('abbreviation')}")
                
            return bibles
        else:
            print(f"Erro: {response.text}")
            return []
    except Exception as e:
        print(f"Exceção: {e}")
        return []

def get_passage(bible_id, passage_id):
    print("\n" + "="*60)
    print(f"BUSCANDO PASSAGEM: {passage_id} na Bíblia {bible_id}")
    print("="*60)
    
    url = f"{BASE_URL}/bibles/{bible_id}/passages/{passage_id}"
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json().get('data', {})
            content = data.get('content', '') # Content is usually HTML or text
            print(f"Conteúdo recebido ({len(content)} chars)")
            print(f"Preview: {content[:200]}...")
            return True
        else:
            print(f"Erro: {response.text}")
            return False
            
    except Exception as e:
        print(f"Exceção: {e}")
        return False

def main():
    bibles = get_bibles()
    
    if bibles:
        # Tentar pegar João 3:16 da primeira bíblia encontrada
        first_bible_id = bibles[0]['id']
        get_passage(first_bible_id, "JHN.3.16")
        
        # Procurar NVI especificamente (Nova Versão Internacional)
        nvi = next((b for b in bibles if 'NVI' in b.get('abbreviation', '').upper()), None)
        if nvi:
            print(f"\nEncontrada NVI: {nvi['name']} ({nvi['id']})")
            get_passage(nvi['id'], "JHN.3.16")
        
        # Procurar Almeida
        almeida = next((b for b in bibles if 'ALMEIDA' in b.get('name', '').upper() or 'ARA' in b.get('abbreviation', '').upper()), None)
        if almeida:
             print(f"\nEncontrada Almeida: {almeida['name']} ({almeida['id']})")
             get_passage(almeida['id'], "JHN.3.16")

if __name__ == "__main__":
    main()
