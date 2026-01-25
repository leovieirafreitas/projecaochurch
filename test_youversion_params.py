#!/usr/bin/env python3
import requests
import json

APP_KEY = "SLYCefOBEYni8Ej4fV8A4BzqrdAl6HY1B2aK8erAt5GJQs76"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json"
}

def test_param(name, value):
    print(f"\nTestando param: {name}={value}")
    try:
        # Request manual para garantir o formato exato da query string
        if name.endswith('[]'):
            # Requests as vezes encoda [] como %5B%5D
            url = f"{BASE_URL}/bibles?{name}={value}"
        else:
            url = f"{BASE_URL}/bibles"
            # params = {name: value}
            # requests.get(..., params=params)
            url = f"{BASE_URL}/bibles?{name}={value}"
            
        print(f"URL: {url}")
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ SUCESSO!")
            data = response.json()
            print(f"Total: {len(data.get('data', []))}")
            return True
        else:
            print(f"Erro: {response.text}")
            return False
    except Exception as e:
        print(f"Exceção: {e}")
        return False

# Testes
test_param("language_tag", "por") # Já falhou
test_param("language_ranges", "por")
test_param("language_ranges[]", "por")
