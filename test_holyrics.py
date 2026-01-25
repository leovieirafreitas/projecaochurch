#!/usr/bin/env python3
"""
Testa endpoints específicos da API do Holyrics na porta 8091
"""

import requests
import json

def test_holyrics_endpoints():
    """Testa endpoints conhecidos da API do Holyrics"""
    base_url = "http://localhost:8091"
    
    # Endpoints baseados na documentação do Holyrics
    endpoints = [
        # Endpoints de API
        "/api/GetBibles",
        "/api/GetBooks",
        "/api/GetChapters",
        "/api/GetVerses",
        "/api/GetText",
        "/api/bible",
        "/api/bibles",
        
        # Endpoints de ações
        "/api/ShowVerse",
        "/api/ShowText",
        "/api/GetCurrentPresentation",
        
        # Endpoints de status
        "/api/status",
        "/api/ping",
        "/api/version",
        
        # Endpoints REST
        "/bibles",
        "/bible/list",
        "/v1/bibles",
        "/v1/bible",
    ]
    
    print("="*70)
    print("TESTANDO API DO HOLYRICS - Porta 8091")
    print("="*70 + "\n")
    
    working = []
    
    for endpoint in endpoints:
        url = f"{base_url}{endpoint}"
        
        # Tentar GET
        try:
            response = requests.get(url, timeout=2)
            if response.status_code != 404:
                print(f"✓ GET {endpoint} - Status: {response.status_code}")
                print(f"  Content-Type: {response.headers.get('Content-Type')}")
                
                try:
                    data = response.json()
                    print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:300]}")
                except:
                    print(f"  Resposta: {response.text[:200]}")
                
                working.append({'method': 'GET', 'endpoint': endpoint, 'status': response.status_code})
                print()
        except Exception as e:
            pass
        
        # Tentar POST
        try:
            response = requests.post(url, json={}, timeout=2)
            if response.status_code != 404:
                print(f"✓ POST {endpoint} - Status: {response.status_code}")
                print(f"  Content-Type: {response.headers.get('Content-Type')}")
                
                try:
                    data = response.json()
                    print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:300]}")
                except:
                    print(f"  Resposta: {response.text[:200]}")
                
                working.append({'method': 'POST', 'endpoint': endpoint, 'status': response.status_code})
                print()
        except Exception as e:
            pass
    
    print("\n" + "="*70)
    print(f"Endpoints funcionando: {len(working)}")
    print("="*70)
    
    if working:
        for item in working:
            print(f"  {item['method']} {item['endpoint']} - {item['status']}")
    else:
        print("  Nenhum endpoint encontrado!")
    
    # Salvar resultados
    with open('holyrics_endpoints.json', 'w', encoding='utf-8') as f:
        json.dump(working, f, indent=2, ensure_ascii=False)
    
    print(f"\nResultados salvos em: holyrics_endpoints.json")

if __name__ == "__main__":
    test_holyrics_endpoints()
