#!/usr/bin/env python3
"""
Testa API do Holyrics com o token real
"""

import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def test_endpoint(method, endpoint, data=None):
    """Testa um endpoint específico"""
    headers = {
        'Content-Type': 'application/json',
        'token': TOKEN
    }
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        else:
            response = requests.post(url, json=data or {}, headers=headers)
        
        print(f"{method} {endpoint}")
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"  ✓ SUCESSO!")
                print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:800]}")
                return data
            except:
                print(f"  Resposta (texto): {response.text[:500]}")
                return response.text
        else:
            print(f"  ✗ Erro: {response.text}")
            return None
    except Exception as e:
        print(f"  ✗ Exceção: {e}")
        return None

def main():
    print("="*70)
    print("TESTANDO API DO HOLYRICS COM TOKEN REAL")
    print(f"Token: {TOKEN}")
    print("="*70 + "\n")
    
    # Teste 1: Listar Bíblias
    print("\n" + "="*70)
    print("TESTE 1: Listar Bíblias")
    print("="*70)
    bibles = test_endpoint('POST', '/api/GetBibles')
    
    # Teste 2: Listar Livros
    print("\n" + "="*70)
    print("TESTE 2: Listar Livros")
    print("="*70)
    books = test_endpoint('POST', '/api/GetBooks', {'bible': 'pt_nvi'})
    
    # Teste 3: Obter Texto
    print("\n" + "="*70)
    print("TESTE 3: Obter Texto de Gênesis 1")
    print("="*70)
    text = test_endpoint('POST', '/api/GetText', {
        'bible': 'pt_nvi',
        'book': 'GEN',
        'chapter': 1
    })
    
    # Teste 4: Obter Versículos
    print("\n" + "="*70)
    print("TESTE 4: Obter Versículos")
    print("="*70)
    verses = test_endpoint('POST', '/api/GetVerses', {
        'bible': 'pt_nvi',
        'book': 'GEN',
        'chapter': 1
    })
    
    # Salvar resultados
    results = {
        'bibles': bibles,
        'books': books,
        'text': text,
        'verses': verses
    }
    
    with open('holyrics_api_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*70)
    print("Resultados salvos em: holyrics_api_results.json")
    print("="*70)

if __name__ == "__main__":
    main()
