#!/usr/bin/env python3
"""
Parser avançado para arquivos .bib do Holyrics
Tenta diferentes métodos de descompressão e decodificação
"""

import struct
import zlib
import gzip
import bz2
import lzma
from pathlib import Path

def try_decompress(data, method_name, decompress_func):
    """Tenta descomprimir dados com um método específico"""
    try:
        decompressed = decompress_func(data)
        print(f"✓ {method_name}: Sucesso! ({len(decompressed)} bytes)")
        
        # Mostrar preview
        preview = decompressed[:200].decode('utf-8', errors='ignore')
        print(f"  Preview: {preview[:100]}")
        return decompressed
    except Exception as e:
        print(f"✗ {method_name}: Falhou ({str(e)[:50]})")
        return None

def analyze_bib_advanced(filepath):
    """Análise avançada do arquivo .bib"""
    print(f"\n{'='*70}")
    print(f"Análise Avançada: {Path(filepath).name}")
    print(f"{'='*70}\n")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Tamanho do arquivo: {len(data):,} bytes\n")
    
    # Análise do header
    print("Header (primeiros 32 bytes):")
    header = data[:32]
    print("  Hex:", ' '.join(f'{b:02x}' for b in header))
    print("  Dec:", ' '.join(f'{b:3d}' for b in header[:16]))
    print()
    
    # Magic bytes
    magic = header[:4]
    print(f"Magic bytes: {' '.join(f'{b:02x}' for b in magic)}")
    
    # Verificar se é um formato conhecido
    if magic == b'\x1f\x8b\x08':
        print("  → Parece ser GZIP!")
    elif magic[:2] == b'BZ':
        print("  → Parece ser BZIP2!")
    elif magic == b'\xfd7zXZ':
        print("  → Parece ser LZMA/XZ!")
    elif magic[:2] == b'PK':
        print("  → Parece ser ZIP!")
    else:
        print(f"  → Formato desconhecido (magic: {magic})")
    
    print("\n" + "="*70)
    print("Tentando métodos de descompressão...")
    print("="*70 + "\n")
    
    # Tentar diferentes métodos
    methods = [
        ("ZLIB (raw)", lambda d: zlib.decompress(d)),
        ("ZLIB (com header)", lambda d: zlib.decompress(d, -zlib.MAX_WBITS)),
        ("GZIP", lambda d: gzip.decompress(d)),
        ("BZIP2", lambda d: bz2.decompress(d)),
        ("LZMA", lambda d: lzma.decompress(d)),
    ]
    
    results = []
    for name, func in methods:
        result = try_decompress(data, name, func)
        if result:
            results.append((name, result))
    
    # Tentar pular o header e descomprimir
    print("\nTentando pular header (primeiros N bytes)...")
    for skip in [4, 8, 16, 32, 64, 128]:
        print(f"\nPulando {skip} bytes:")
        skipped_data = data[skip:]
        
        for name, func in methods[:3]:  # Apenas os mais comuns
            result = try_decompress(skipped_data, f"{name} (skip {skip})", func)
            if result:
                results.append((f"{name} (skip {skip})", result))
                break
    
    return results

def search_for_bible_text(data):
    """Procura por texto bíblico conhecido"""
    print(f"\n{'='*70}")
    print("Procurando por texto bíblico conhecido...")
    print("="*70 + "\n")
    
    # Versículos conhecidos em português
    known_verses = [
        b"No princ",  # "No princípio"
        b"Deus criou",
        b"Haja luz",
        b"Jesus",
        b"amor",
        b"vida eterna",
        "Gênesis".encode('utf-8'),
        "Êxodo".encode('utf-8'),
        "Mateus".encode('utf-8'),
    ]
    
    found_any = False
    for verse in known_verses:
        pos = data.find(verse)
        if pos != -1:
            found_any = True
            context_start = max(0, pos - 30)
            context_end = min(len(data), pos + len(verse) + 50)
            context = data[context_start:context_end]
            
            try:
                text = context.decode('utf-8', errors='ignore')
                print(f"✓ Encontrado '{verse.decode('utf-8', errors='ignore')}' na posição {pos}")
                print(f"  Contexto: {text[:80]}")
            except:
                print(f"✓ Encontrado bytes na posição {pos}")
    
    if not found_any:
        print("✗ Nenhum texto bíblico conhecido encontrado")
    
    return found_any

def try_custom_decode(filepath):
    """Tenta decodificação customizada baseada no padrão observado"""
    print(f"\n{'='*70}")
    print("Tentando decodificação customizada...")
    print("="*70 + "\n")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # O padrão 07 07 07 01 pode ser um indicador
    # Vamos tentar XOR com diferentes chaves
    print("Tentando XOR com chaves comuns...")
    
    for key in [0x07, 0x42, 0xFF, 0xAA, 0x55]:
        decoded = bytes([b ^ key for b in data[:1000]])
        
        # Verificar se tem texto legível
        readable = sum(1 for b in decoded if 32 <= b < 127)
        percentage = (readable / len(decoded)) * 100
        
        print(f"  XOR com 0x{key:02x}: {percentage:.1f}% legível")
        
        if percentage > 50:
            preview = decoded[:200].decode('utf-8', errors='ignore')
            print(f"    Preview: {preview[:100]}")

def main():
    bib_file = r"c:\Holyrics\Holyrics\files\Bible LG\pt_nvi.bib"
    
    if not Path(bib_file).exists():
        print(f"Arquivo não encontrado: {bib_file}")
        return
    
    # Análise avançada
    results = analyze_bib_advanced(bib_file)
    
    # Se encontrou algo descomprimido, procurar por texto bíblico
    if results:
        print(f"\n{'='*70}")
        print(f"Encontrados {len(results)} resultados de descompressão!")
        print("="*70)
        
        for name, data in results:
            print(f"\nAnalisando resultado de: {name}")
            search_for_bible_text(data)
            
            # Salvar resultado
            output_file = f"decompressed_{name.replace(' ', '_').replace('(', '').replace(')', '')}.bin"
            with open(output_file, 'wb') as f:
                f.write(data)
            print(f"  Salvo em: {output_file}")
    else:
        # Tentar métodos customizados
        try_custom_decode(bib_file)
        
        # Procurar no arquivo original
        with open(bib_file, 'rb') as f:
            search_for_bible_text(f.read())

if __name__ == "__main__":
    main()
