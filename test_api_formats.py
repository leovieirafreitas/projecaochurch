#!/usr/bin/env python3
"""
Testa API do Holyrics com diferentes formatos de requisição
"""

import requests
import json

def test_api_formats():
    """Testa diferentes formatos de requisição"""
    base_url = "http://localhost:8091"
    
    print("="*70)
    print("TESTANDO FORMATOS DE REQUISIÇÃO DA API HOLYRICS")
    print("="*70 + "\n")
    
    # Teste 1: GET simples
    print("Teste 1: GET /api/GetBibles")
    try:
        response = requests.get(f"{base_url}/api/GetBibles")
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")
    
    # Teste 2: POST com JSON vazio
    print("Teste 2: POST /api/GetBibles com JSON vazio")
    try:
        response = requests.post(
            f"{base_url}/api/GetBibles",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")
    
    # Teste 3: POST com parâmetros
    print("Teste 3: POST /api/GetText com parâmetros")
    try:
        response = requests.post(
            f"{base_url}/api/GetText",
            json={
                "bible": "pt_nvi",
                "book": "GEN",
                "chapter": 1
            },
            headers={'Content-Type': 'application/json'}
        )
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")
    
    # Teste 4: Sem autenticação mas com header especial
    print("Teste 4: Com header de origem local")
    try:
        response = requests.get(
            f"{base_url}/api/GetBibles",
            headers={
                'Origin': 'http://localhost:8091',
                'Referer': 'http://localhost:8091'
            }
        )
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")
    
    # Teste 5: Tentar endpoint de documentação
    print("Teste 5: GET /api (documentação)")
    try:
        response = requests.get(f"{base_url}/api")
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")
    
    # Teste 6: Endpoint raiz
    print("Teste 6: GET / (raiz)")
    try:
        response = requests.get(f"{base_url}/")
        print(f"  Status: {response.status_code}")
        print(f"  Content-Type: {response.headers.get('Content-Type')}")
        print(f"  Resposta: {response.text[:500]}\n")
    except Exception as e:
        print(f"  Erro: {e}\n")

if __name__ == "__main__":
    test_api_formats()
