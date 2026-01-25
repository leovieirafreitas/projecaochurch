#!/usr/bin/env python3
"""
Testa múltiplos endpoints para tentar acessar o script proxy.
"""

import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def test_endpoint(endpoint_name, params=None):
    url = f"{BASE_URL}/api/{endpoint_name}?token={TOKEN}"
    
    # Se o endpoint for genérico, a ação real vai no body
    payload = params or {}
    
    print(f"\nTESTANDO: {endpoint_name.upper()}")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload)}")
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Resposta: {response.text[:300]}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and data.get('status') == 'ok':
                    print("✅ SUCESSO! Este é o endpoint correto.")
                    return True
            except:
                pass
        return False
            
    except Exception as e:
        print(f"Exceção: {e}")
        return False

def main():
    print("="*60)
    print("DIAGNÓSTICO DE ENDPOINT HOLYRICS")
    print("="*60)
    
    # Payload padrão para nosso script
    payload_get_versions = {
        "action": "get_bible_versions"  # O script lê isso em content.action
    }
    
    # 1. Testar my_custom_action (Padrão sugerido)
    # Requer permissão específica 'my_custom_action'?
    test_endpoint("my_custom_action", payload_get_versions)
    
    # 2. Testar ApiAction (Action genérica)
    # Requer permissão 'ApiAction'
    # Talvez o Holyrics passe o body para o script?
    test_endpoint("ApiAction", payload_get_versions)
    
    # 3. Testar ApiRequest (Request genérico)
    # Requer permissão 'ApiRequest'
    test_endpoint("ApiRequest", payload_get_versions)
    
    # 4. Testar encapsulando a ação
    # Talvez ApiAction espere 'action' como parâmetro de roteamento?
    payload_wrapped = {
        "action": "my_custom_action",
        "content": payload_get_versions
    }
    test_endpoint("ApiAction", payload_wrapped)

if __name__ == "__main__":
    main()
