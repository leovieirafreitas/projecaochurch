
import requests
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

def get_versions():
    url = "https://www.bible.com/api/bible/versions?language_tag=pt"
    try:
        r = requests.get(url, headers=headers)
        data = r.json()
        versions = data.get('response', {}).get('data', {}).get('versions', [])
        for v in versions:
            if 'NBV' in v['abbreviation'].upper() or 'NOVA BÍBLIA VIVA' in v['local_title'].upper():
                print(f"FOUND NBV: {v['id']} - {v['abbreviation']} - {v['local_title']}")
                return v['id']
        print("NBV not found in list")
        return None
    except Exception as e:
        print(f"Error listing versions: {e}")
        return None

def get_chapter(version_id):
    # Genesis 1
    # NBV-P might use different book IDs? Usually GEN.
    url = f"https://www.bible.com/bible/{version_id}/GEN.1"
    print(f"Fetching: {url}")
    try:
        r = requests.get(url, headers=headers)
        print(f"Status Code: {r.status_code}")
        
        # Save HTML for analysis
        with open("debug_gen1_nbv.html", "w", encoding="utf-8") as f:
            f.write(r.text)
        print("Saved debug_gen1_nbv.html")
        
        # Quick peek at structure
        if "data-usfm" in r.text:
            print("Contains data-usfm attributes!")
        else:
            print("WARNING: NO data-usfm attributes found.")
            
        if "verse-number" in r.text or "label" in r.text:
            print("Contains standard verse classes.")
        else:
            print("WARNING: NO standard verse classes found.")
            
    except Exception as e:
        print(f"Error fetching chapter: {e}")

vid = get_versions()
if vid:
    get_chapter(vid)
else:
    # Fallback to NVI id 129 just to test
    print("Testing NVI (129)...")
    get_chapter('129')
