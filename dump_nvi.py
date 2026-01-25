
import requests
import json

APP_KEY = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7"
headers = {"x-yvp-app-key": APP_KEY, "Accept": "application/json"}

def dump_nvi():
    r = requests.get("https://api.youversion.com/v1/bibles?language_ranges[]=por", headers=headers)
    data = r.json().get('data', [])
    
    for b in data:
        if b['abbreviation'] == 'NVI':
            print(json.dumps(b, indent=2))
            # Se tiver audio_bibles, pega o ID de lá
            if 'audio_bibles' in b:
                return b['audio_bibles']

dump_nvi()
