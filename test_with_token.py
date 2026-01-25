#!/usr/bin/env python3
"""
Testa API do Holyrics com token
"""

import requests
import json

def test_with_token(token=""):
    """Testa API com token"""
    base_url = "http://localhost:8091"
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    if token:
        headers['Authorization'] = f'Bearer {token}'
        headers['token'] = token
    
    print("="*70)
    print(f"TESTANDO API COM TOKEN: '{token}'")
    print("="*70 + "\n")
    
    # Teste 1: GetBibles
    print("Teste 1: POST /api/GetBibles")
    try:
        response = requests.post(
            f"{base_url}/api/GetBibles",
            json={},
            headers=headers
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ SUCESSO!")
            print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        else:
            print(f"  Resposta: {response.text}")
    except Exception as e:
        print(f"  Erro: {e}")
    
    print("\n" + "="*70 + "\n")
    
    # Teste 2: GetBooks
    print("Teste 2: POST /api/GetBooks")
    try:
        response = requests.post(
            f"{base_url}/api/GetBooks",
            json={"bible": "pt_nvi"},
            headers=headers
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ SUCESSO!")
            print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        else:
            print(f"  Resposta: {response.text}")
    except Exception as e:
        print(f"  Erro: {e}")

if __name__ == "__main__":
    # Primeiro tentar sem token (local)
    print("\n" + "="*70)
    print("TENTATIVA 1: SEM TOKEN (requisição local)")
    print("="*70)
    test_with_token("")
    
    # Tentar com token de exemplo
    print("\n\n" + "="*70)
    print("TENTATIVA 2: COM TOKEN 'abcxyz'")
    print("="*70)
    test_with_token("abcxyz")
    
    print("\n\n" + "="*70)
    print("Se ainda não funcionar, você precisa:")
    print("1. Ir em Ferramentas → Configurações → API Server")
    print("2. Clicar em 'Gerenciar permissões'")
    print("3. Gerar um token")
    print("4. Me enviar o token gerado")
    print("="*70)
