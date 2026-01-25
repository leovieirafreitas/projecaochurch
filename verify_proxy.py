#!/usr/bin/env python3
"""
Testa a conexão com o Script Proxy instalado no Holyrics.
Usa o endpoint /api/my_custom_action para invocar o script.
"""

import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def test_proxy(action, params=None):
    url = f"{BASE_URL}/api/my_custom_action?token={TOKEN}"
    
    payload = {
        "action": action,
        "params": params or {}
    }
    
    print(f"\nTestando ação: {action}")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload)}")
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("Resposta JSON:")
                print(json.dumps(data, indent=2, ensure_ascii=False)[:500])
                if len(str(data)) > 500:
                    print("... (truncado)")
                return True
            except:
                print(f"Resposta Texto: {response.text}")
        else:
            print(f"Erro: {response.text}")
            return False
            
    except Exception as e:
        print(f"Exceção: {e}")
        return False

def main():
    print("="*60)
    print("VERIFICADOR DE INSTALAÇÃO DO PROXY HOLYRICS")
    print("="*60)
    
    success_versions = test_proxy("get_bible_versions")
    
    if success_versions:
        print("\n✅ Script Proxy parece estar instalado e respondendo!")
        
        # Testar busca de texto se versões funcionou
        test_proxy("get_bible_text", {"version": "pt_nvi", "reference": "João 3:16"})
    else:
        print("\n❌ Não foi possível comunicar com o proxy.")
        print("Verifique se:")
        print("1. O código foi colado corretamente no 'JavaScript Editor'")
        print("2. O script foi SALVO e EXECUTADO (Play)")
        print("3. O endpoint /api/my_custom_action está acessível (permissões)")

if __name__ == "__main__":
    main()
