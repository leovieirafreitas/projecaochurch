#!/usr/bin/env python3
"""
Testa obtenção de versículos da API do Holyrics
Baseado na documentação: ShowVerse usa 'references' como 'Rm 12:2 Gn 1:1-3'
"""

import requests
import json

TOKEN = "4h7sSD4oabhZJ0TR"
BASE_URL = "http://localhost:8091"

def api_request(action, params=None):
    """Faz uma requisição à API do Holyrics"""
    url = f"{BASE_URL}/api/{action}?token={TOKEN}"
    
    headers = {'Content-Type': 'application/json'}
    
    try:
        response = requests.post(url, json=params or {}, headers=headers)
        print(f"\nPOST /api/{action}")
        print(f"  Params: {json.dumps(params, ensure_ascii=False)[:200]}")
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✓ SUCESSO!")
            print(f"  Resposta: {json.dumps(data, indent=2, ensure_ascii=False)[:2000]}")
            return data
        else:
            print(f"  ✗ Erro: {response.text}")
            return None
    except Exception as e:
        print(f"  ✗ Exceção: {e}")
        return None

def main():
    print("="*70)
    print("TESTANDO OBTENÇÃO DE VERSÍCULOS")
    print("="*70)
    
    # Teste 1: ShowVerse com referências (isso MOSTRA, não retorna texto)
    print("\n" + "="*70)
    print("TESTE 1: ShowVerse - João 3:16")
    print("="*70)
    show = api_request('ShowVerse', {
        'input': {
            'references': 'João 3:16',
            'version': 'pt_nvi'
        }
    })
    
    # Teste 2: Tentar GetCurrentPresentation para ver o que está sendo mostrado
    print("\n" + "="*70)
    print("TESTE 2: GetCurrentPresentation")
    print("="*70)
    current = api_request('GetCurrentPresentation')
    
    # Teste 3: Tentar com ID de versículo (formato: LLCCCVVV)
    # João 3:16 = Livro 43, Capítulo 003, Versículo 016 = 43003016
    print("\n" + "="*70)
    print("TESTE 3: ShowVerse com ID - João 3:16 (43003016)")
    print("="*70)
    show_id = api_request('ShowVerse', {
        'input': {
            'id': '43003016',
            'version': 'pt_nvi'
        }
    })
    
    # Teste 4: Gênesis 1 completo
    print("\n" + "="*70)
    print("TESTE 4: ShowVerse - Gênesis 1 (completo)")
    print("="*70)
    genesis = api_request('ShowVerse', {
        'input': {
            'references': 'Gênesis 1',
            'version': 'pt_nvi'
        }
    })
    
    # Salvar resultados
    results = {
        'show_verse': show,
        'current_presentation': current,
        'show_verse_id': show_id,
        'genesis_1': genesis
    }
    
    with open('holyrics_verses.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*70)
    print("✓ Resultados salvos em: holyrics_verses.json")
    print("="*70)

if __name__ == "__main__":
    main()
