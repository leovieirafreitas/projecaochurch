#!/usr/bin/env python3
import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def test(name, payload):
    url = f"{BASE_URL}/api/ApiRequest?token={TOKEN}"
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

# Tentar ApiRequest
# Se ApiRequest chama request(action, ...), devemos passar action no JSON
test("ApiRequest Direct", {
    "action": "my_custom_action",
    "params": {
        "action": "get_bible_versions"
    }
})
