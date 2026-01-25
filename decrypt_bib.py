#!/usr/bin/env python3
"""
Tentativa avançada de descriptografar arquivos .bib do Holyrics
"""

import struct
import os
from pathlib import Path

def try_xor_decrypt(data, key_byte):
    """Tenta descriptografar com XOR"""
    return bytes([b ^ key_byte for b in data])

def try_multi_byte_xor(data, key):
    """XOR com chave de múltiplos bytes"""
    key_len = len(key)
    return bytes([data[i] ^ key[i % key_len] for i in range(len(data))])

def analyze_frequency(data):
    """Analisa frequência de bytes"""
    freq = {}
    for byte in data[:10000]:  # Primeiros 10KB
        freq[byte] = freq.get(byte, 0) + 1
    
    # Ordenar por frequência
    sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return sorted_freq[:10]

def find_patterns(data, min_length=4):
    """Procura por padrões repetidos"""
    patterns = {}
    data_len = len(data)
    
    for length in range(min_length, 20):
        for i in range(min(1000, data_len - length)):
            pattern = data[i:i+length]
            if pattern in patterns:
                patterns[pattern] += 1
            else:
                patterns[pattern] = 1
    
    # Retornar padrões mais comuns
    common = sorted(patterns.items(), key=lambda x: x[1], reverse=True)
    return common[:5]

def try_decrypt_bib(filepath):
    """Tenta descriptografar arquivo .bib"""
    print(f"\n{'='*70}")
    print(f"Analisando: {Path(filepath).name}")
    print(f"{'='*70}\n")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Tamanho: {len(data):,} bytes")
    
    # Análise do header
    header = data[:100]
    print(f"\nHeader (primeiros 32 bytes):")
    print("  Hex:", ' '.join(f'{b:02x}' for b in header[:32]))
    print("  Dec:", ' '.join(f'{b:3d}' for b in header[:16]))
    
    # Análise de frequência
    print("\n" + "="*70)
    print("Análise de Frequência (top 10 bytes):")
    print("="*70)
    freq = analyze_frequency(data)
    for byte_val, count in freq:
        char = chr(byte_val) if 32 <= byte_val < 127 else '.'
        print(f"  0x{byte_val:02x} ({byte_val:3d}) '{char}': {count:6d} vezes")
    
    # Procurar padrões
    print("\n" + "="*70)
    print("Padrões Repetidos:")
    print("="*70)
    patterns = find_patterns(data)
    for pattern, count in patterns:
        if count > 2:
            hex_pattern = ' '.join(f'{b:02x}' for b in pattern[:10])
            print(f"  {hex_pattern}: {count} vezes")
    
    # Tentar XOR com bytes mais frequentes
    print("\n" + "="*70)
    print("Tentando XOR com bytes mais frequentes:")
    print("="*70)
    
    most_common_byte = freq[0][0]
    
    # Assumir que o byte mais comum pode ser espaço (0x20) ou null (0x00)
    possible_keys = [
        most_common_byte ^ 0x20,  # Assumindo espaço
        most_common_byte ^ 0x00,  # Assumindo null
        most_common_byte ^ ord('a'),  # Assumindo 'a'
        most_common_byte ^ ord('e'),  # Assumindo 'e'
        0x07,  # Do magic byte
        most_common_byte,
    ]
    
    for key in possible_keys:
        decrypted = try_xor_decrypt(data[:1000], key)
        
        # Contar caracteres legíveis
        readable = sum(1 for b in decrypted if 32 <= b < 127 or b in [10, 13])
        percentage = (readable / len(decrypted)) * 100
        
        print(f"\n  XOR com 0x{key:02x}: {percentage:.1f}% legível")
        
        if percentage > 30:
            preview = decrypted[:200].decode('utf-8', errors='ignore')
            print(f"    Preview: {preview[:100]}")
            
            # Salvar resultado promissor
            if percentage > 50:
                output_file = f"decrypted_xor_{key:02x}.txt"
                with open(output_file, 'wb') as f:
                    f.write(try_xor_decrypt(data, key))
                print(f"    ✓ Salvo em: {output_file}")
    
    # Tentar XOR com chave de múltiplos bytes baseada no magic
    print("\n" + "="*70)
    print("Tentando XOR com chave multi-byte:")
    print("="*70)
    
    magic = header[:4]
    multi_keys = [
        magic,
        magic + magic,
        bytes([0x07, 0x07, 0x07, 0x01]),
        bytes([0x01, 0x02, 0x03, 0x04]),
    ]
    
    for key in multi_keys:
        decrypted = try_multi_byte_xor(data[:1000], key)
        readable = sum(1 for b in decrypted if 32 <= b < 127 or b in [10, 13])
        percentage = (readable / len(decrypted)) * 100
        
        key_hex = ' '.join(f'{b:02x}' for b in key)
        print(f"\n  Chave [{key_hex}]: {percentage:.1f}% legível")
        
        if percentage > 30:
            preview = decrypted[:200].decode('utf-8', errors='ignore')
            print(f"    Preview: {preview[:100]}")
    
    # Procurar por strings conhecidas após XOR
    print("\n" + "="*70)
    print("Procurando strings bíblicas conhecidas:")
    print("="*70)
    
    known_strings = [
        "No princípio",
        "Deus criou",
        "Gênesis",
        "Mateus",
        "Jesus",
        "In the beginning",
        "God created",
    ]
    
    # Tentar XOR de 0 a 255
    for xor_key in range(256):
        decrypted = try_xor_decrypt(data[:5000], xor_key)
        text = decrypted.decode('utf-8', errors='ignore').lower()
        
        for known in known_strings:
            if known.lower() in text:
                print(f"\n  ✓ ENCONTRADO '{known}' com XOR 0x{xor_key:02x}!")
                
                # Salvar arquivo completo
                output_file = f"FOUND_xor_{xor_key:02x}.txt"
                with open(output_file, 'wb') as f:
                    f.write(try_xor_decrypt(data, xor_key))
                
                print(f"    Arquivo completo salvo em: {output_file}")
                
                # Mostrar preview
                preview = decrypted[:500].decode('utf-8', errors='ignore')
                print(f"\n    Preview:\n{preview}")
                return True
    
    print("\n  ✗ Nenhuma string conhecida encontrada")
    return False

def main():
    bib_file = r"C:\Holyrics\Holyrics\files\Bible LG\pt_nvi.bib"
    
    if not Path(bib_file).exists():
        print(f"Arquivo não encontrado: {bib_file}")
        return
    
    success = try_decrypt_bib(bib_file)
    
    if success:
        print("\n" + "="*70)
        print("✓ DESCRIPTOGRAFIA BEM-SUCEDIDA!")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("✗ Não foi possível descriptografar automaticamente")
        print("="*70)
        print("\nO formato pode usar:")
        print("  - Criptografia mais complexa (AES, DES, etc)")
        print("  - Compressão customizada")
        print("  - Ofuscação proprietária")
        print("\nRecomendação: Usar API pública para obter os textos")

if __name__ == "__main__":
    main()
