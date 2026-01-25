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

# Hipótese: ApiAction espera "name" da ação a ser executada
payload_correct = {
    "name": "my_custom_action",
    "params": {
        "action": "get_bible_versions"
    }
}

test("ApiAction with Name/Params", payload_correct)
