#!/usr/bin/env python3
"""
Testa API do Holyrics CORRETAMENTE baseado na documentação oficial
"""

import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def api_request(action, params=None):
    """Faz uma requisição à API do Holyrics"""
    url = f"{BASE_URL}/api/{action}?token={TOKEN}"
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(url, json=params or {}, headers=headers)
        print(f"\nPOST /api/{action}")
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ SUCESSO!")
            print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}")
            return data
        else:
            print(f"  ✗ Erro: {response.text}")
            return None
    except Exception as e:
        print(f"  ✗ Exceção: {e}")
        return None

def main():
    print("="*70)
    print("TESTANDO API DO HOLYRICS - FORMATO CORRETO")
    print(f"Token: {TOKEN}")
    print("="*70)
    
    # Teste 1: Listar versões da Bíblia
    print("\n" + "="*70)
    print("TESTE 1: GetBibleVersionsV2")
    print("="*70)
    versions = api_request('GetBibleVersionsV2')
    
    # Teste 2: Obter texto de versículo
    print("\n" + "="*70)
    print("TESTE 2: GetText - João 3:16")
    print("="*70)
    text = api_request('GetText', {
        'input': {
            'version': 'pt_nvi',
            'reference': 'João 3:16'
        }
    })
    
    # Teste 3: Obter texto de capítulo completo
    print("\n" + "="*70)
    print("TESTE 3: GetText - Gênesis 1")
    print("="*70)
    genesis = api_request('GetText', {
        'input': {
            'version': 'pt_nvi',
            'reference': 'Gênesis 1'
        }
    })
    
    # Salvar resultados
    results = {
        'versions': versions,
        'john_3_16': text,
        'genesis_1': genesis
    }
    
    with open('holyrics_success.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*70)
    print("✓ Resultados salvos em: holyrics_success.json")
    print("="*70)

if __name__ == "__main__":
    main()
