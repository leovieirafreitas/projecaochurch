#!/usr/bin/env python3
"""
Testa Holyrics Plugin HTTP endpoints
"""

import requests

BASE_URL = "http://192.168.1.254:80"

endpoints = [
    "/view/text",
    "/view/widescreen",
    "/view/standard",
    "/view/text-aux-control",
    "/view/text2",
    "/view/text3",
    "/chat"
]

print("="*70)
print("TESTANDO HOLYRICS PLUGIN HTTP")
print(f"Base URL: {BASE_URL}")
print("="*70)

for endpoint in endpoints:
    url = f"{BASE_URL}{endpoint}"
    print(f"\nGET {endpoint}")
    try:
        response = requests.get(url, timeout=3)
        print(f"  Status: {response.status_code}")
        print(f"  Content-Type: {response.headers.get('Content-Type')}")
        print(f"  Content Length: {len(response.text)} bytes")
        
        if response.status_code == 200:
            print(f"  ✓ SUCESSO!")
            # Salvar conteúdo se for HTML
            if 'html' in response.headers.get('Content-Type', ''):
                filename = endpoint.replace('/', '_') + '.html'
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"  Salvo em: {filename}")
    except Exception as e:
        print(f"  ✗ Erro: {e}")

print("\n" + "="*70)
print("Teste concluído!")
print("="*70)
