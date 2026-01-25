#!/usr/bin/env python3
"""
Teste direto da API YouVersion com diagnóstico completo.
"""
import requests
import json

# NOVA CHAVE
APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
BASE_URL = "https://api.youversion.com/v1"

headers = {
    "x-yvp-app-key": APP_KEY,
    "Accept": "application/json",
    "User-Agent": "PostmanRuntime/7.26.8" # Simular client real
}

def test_passage(version_id, passage_id):
    print("\n" + "="*70)
    print(f"TESTANDO: Versão {version_id} | Passagem {passage_id}")
    print("="*70)
    
    url = f"{BASE_URL}/bibles/{version_id}/passages/{passage_id}"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print("Headers Relevantes:")
        for k, v in response.headers.items():
            if 'limit' in k or 'remaining' in k or 'content-type' in k.lower():
                print(f"  {k}: {v}")
                
        try:
            data = response.json()
            
            if response.status_code == 200:
                content = data.get('data', {}).get('content', '')
                if content:
                    print("\n✅ CONTEÚDO ENCONTRADO!")
                    print("-" * 30)
                    print(content[:300] + "..." if len(content) > 300 else content)
                    print("-" * 30)
                    return True
                else:
                    print("\n⚠️  RESPOSTA 200 MAS SEM CONTEÚDO (Campo 'content' vazio ou null)")
                    print("Dump parcial:", json.dumps(data, indent=2)[:500])
                    return False
            else:
                print("\n❌ ERRO NA RESPOSTA:")
                print(json.dumps(data, indent=2))
                return False
                
        except json.JSONDecodeError:
            print("\n❌ RESPOSTA NÃO É JSON:")
            print(response.text[:500])
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEÇÃO: {e}")
        return False

def main():
    print(f"Usando Key: {APP_KEY[:5]}...{APP_KEY[-5:]}")
    
    # 1. Testar NVI (129) - Que está falhando no site
    test_passage("129", "GEN.1")
    
    # 2. Testar NVI com ID numérico simples
    test_passage("129", "1")
    
    # 3. Testar KJA (1697) - King James Atualizada (Geralmente mais aberta)
    # Ou NTLH (211)
    test_passage("211", "GEN.1") # NTLH
    
    # 4. Testar ASV (12) - American Standard (Domínio Público, deve funcionar)
    test_passage("12", "GEN.1") 

if __name__ == "__main__":
    main()
