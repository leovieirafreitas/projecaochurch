#!/usr/bin/env python3
import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

# Testar diferentes formatos de autenticação
auth_formats = [
    {'token': TOKEN},
    {'Authorization': f'Bearer {TOKEN}'},
    {'Authorization': TOKEN},
    {'api_key': TOKEN},
    {'X-API-Key': TOKEN},
]

for i, headers in enumerate(auth_formats, 1):
    headers['Content-Type'] = 'application/json'
    
    print(f"\nTeste {i}: Headers = {headers}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/GetBibles",
            json={},
            headers=headers
        )
        print(f"  Status: {response.status_code}")
        print(f"  Resposta: {response.text[:200]}")
        
        if response.status_code == 200:
            print(f"\n✓✓✓ SUCESSO COM FORMATO {i}! ✓✓✓\n")
            break
    except Exception as e:
        print(f"  Erro: {e}")
