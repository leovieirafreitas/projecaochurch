#!/usr/bin/env python3
import requests
import json

APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json",
    "User-Agent": "PostmanRuntime/7.26.8" 
}

def test_param(param_str):
    url = f"{BASE_URL}/bibles/129/passages/GEN.1?{param_str}"
    print(f"\nTestando: {url}")
    try:
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        data = r.json()
        content = data.get('data', {}).get('content', '')
        print(f"Content Length: {len(content)}")
        if content:
            print("Preview:", content[:50])
    except Exception as e:
        print("Erro:", e)

# Testes de parâmetros
test_param("content_type=html")
test_param("content_type=json")
test_param("content_type=text")
test_param("format=html") # Conforme docs
test_param("type=html")
