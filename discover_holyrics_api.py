#!/usr/bin/env python3
"""
Script para descobrir e testar a API do Holyrics
"""

import requests
import json

def find_holyrics_port():
    """Tenta encontrar a porta da API do Holyrics"""
    common_ports = [5316, 8000, 8080, 3000, 5000, 7000, 9000]
    
    print("Procurando porta da API do Holyrics...")
    for port in common_ports:
        try:
            url = f"http://localhost:{port}"
            response = requests.get(url, timeout=1)
            print(f"✓ Porta {port} respondeu! Status: {response.status_code}")
            return port
        except:
            print(f"✗ Porta {port} não respondeu")
    
    return None

def discover_api_endpoints(port):
    """Descobre endpoints disponíveis na API"""
    base_url = f"http://localhost:{port}"
    
    # Endpoints comuns para testar
    endpoints = [
        "/",
        "/api",
        "/api/bible",
        "/api/bibles",
        "/api/verses",
        "/api/books",
        "/api/chapters",
        "/bible",
        "/bibles",
        "/v1/bible",
        "/v1/bibles",
        "/help",
        "/docs",
        "/swagger",
    ]
    
    print(f"\n{'='*70}")
    print(f"Testando endpoints em {base_url}")
    print(f"{'='*70}\n")
    
    working_endpoints = []
    
    for endpoint in endpoints:
        try:
            url = f"{base_url}{endpoint}"
            response = requests.get(url, timeout=2)
            
            if response.status_code == 200:
                print(f"✓ {endpoint}")
                print(f"  Status: {response.status_code}")
                print(f"  Content-Type: {response.headers.get('Content-Type', 'N/A')}")
                
                # Tentar parsear JSON
                try:
                    data = response.json()
                    print(f"  Resposta JSON: {json.dumps(data, indent=2)[:200]}...")
                except:
                    print(f"  Resposta (texto): {response.text[:200]}...")
                
                working_endpoints.append({
                    'endpoint': endpoint,
                    'url': url,
                    'status': response.status_code,
                    'content_type': response.headers.get('Content-Type')
                })
                print()
            else:
                print(f"✗ {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"✗ {endpoint} - Erro: {str(e)[:50]}")
    
    return working_endpoints

def test_bible_endpoints(port):
    """Testa endpoints específicos de bíblia"""
    base_url = f"http://localhost:{port}"
    
    print(f"\n{'='*70}")
    print("Testando endpoints de Bíblia")
    print(f"{'='*70}\n")
    
    # Tentar diferentes formatos de requisição
    tests = [
        {"method": "GET", "url": "/api/GetBibles"},
        {"method": "GET", "url": "/api/GetBooks"},
        {"method": "GET", "url": "/api/GetVerses"},
        {"method": "POST", "url": "/api/GetBibles", "data": {}},
        {"method": "POST", "url": "/api/GetText", "data": {"book": "GEN", "chapter": 1}},
        {"method": "GET", "url": "/api/bible/list"},
        {"method": "GET", "url": "/api/bible/versions"},
    ]
    
    for test in tests:
        try:
            url = f"{base_url}{test['url']}"
            
            if test['method'] == 'GET':
                response = requests.get(url, timeout=2)
            else:
                response = requests.post(url, json=test.get('data', {}), timeout=2)
            
            print(f"{test['method']} {test['url']}")
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"  ✓ Resposta JSON: {json.dumps(data, indent=2)[:300]}...")
                except:
                    print(f"  Resposta: {response.text[:200]}")
            print()
        except Exception as e:
            print(f"{test['method']} {test['url']} - Erro: {str(e)[:50]}\n")

def main():
    print("="*70)
    print("DESCOBRIDOR DE API DO HOLYRICS")
    print("="*70)
    print("\nCertifique-se de que o Holyrics está RODANDO!\n")
    
    # Encontrar porta
    port = find_holyrics_port()
    
    if not port:
        print("\n❌ Não foi possível encontrar a API do Holyrics.")
        print("Certifique-se de que o Holyrics está rodando!")
        return
    
    print(f"\n✓ API encontrada na porta {port}!\n")
    
    # Descobrir endpoints
    endpoints = discover_api_endpoints(port)
    
    # Testar endpoints de bíblia
    test_bible_endpoints(port)
    
    # Salvar resultados
    results = {
        'port': port,
        'endpoints': endpoints
    }
    
    with open('holyrics_api_discovery.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*70}")
    print(f"Resultados salvos em: holyrics_api_discovery.json")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()
