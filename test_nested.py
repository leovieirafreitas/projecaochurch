#!/usr/bin/env python3
import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def test(name, payload):
    url = f"{BASE_URL}/api/ApiAction?token={TOKEN}"
    print(f"\nTESTE: {name}")
    print(f"Payload: {json.dumps(payload)}")
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        try:
            print(f"Resp: {json.dumps(response.json(), indent=2)[:300]}")
        except:
            print(f"Resp Texto: {response.text}")
    except Exception as e:
        print(f"Erro: {e}")

# 1. Tentar chamar my_custom_action através de ApiAction
# O script padrão chama myCustomAction(content) quando action='my_custom_action'
# 'content' é o resto do JSON?
test("Nested Action", {
    "action": "my_custom_action",
    "action_inside": "get_bible_versions", # Se content for o próprio obj?
    "params": {
        "action": "get_bible_versions"     # Ou se estiver em params?
    },
    "content": {                           # Holyrics pode passar 'content' separado?
        "action": "get_bible_versions"
    }
})

# 2. Tentar formato direto se ApiAction apenas repassar
test("Direct Action", {
    "action": "get_bible_versions"
})
