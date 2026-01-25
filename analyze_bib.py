#!/usr/bin/env python3
"""
Analisador de arquivos .bib do Holyrics
Este script tenta fazer engenharia reversa do formato binário
"""

import struct
import json
import sys
from pathlib import Path

def analyze_binary_structure(filepath, num_bytes=500):
    """Analisa os primeiros bytes do arquivo para identificar padrões"""
    print(f"\n{'='*60}")
    print(f"Analisando: {filepath}")
    print(f"{'='*60}\n")
    
    with open(filepath, 'rb') as f:
        data = f.read(num_bytes)
        
        # Mostrar bytes em hexadecimal
        print("Primeiros bytes (hex):")
        for i in range(0, min(len(data), 200), 16):
            hex_str = ' '.join(f'{b:02x}' for b in data[i:i+16])
            ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in data[i:i+16])
            print(f"{i:04x}: {hex_str:<48} {ascii_str}")
        
        print("\n" + "="*60)
        
        # Procurar por strings legíveis
        print("\nStrings encontradas (>= 4 caracteres):")
        current_string = []
        strings_found = []
        
        for byte in data:
            if 32 <= byte < 127:  # Caractere ASCII imprimível
                current_string.append(chr(byte))
            else:
                if len(current_string) >= 4:
                    s = ''.join(current_string)
                    strings_found.append(s)
                    print(f"  - {s}")
                current_string = []
        
        return data, strings_found

def try_parse_bib_file(filepath):
    """Tenta fazer parse do arquivo .bib"""
    print(f"\n{'='*60}")
    print("Tentando fazer parse do arquivo...")
    print(f"{'='*60}\n")
    
    with open(filepath, 'rb') as f:
        # Ler header
        header = f.read(100)
        
        # Tentar identificar formato
        # Muitos formatos binários começam com um "magic number"
        magic = header[:4]
        print(f"Magic bytes: {' '.join(f'{b:02x}' for b in magic)}")
        
        # Verificar se há um padrão de tamanho
        if len(header) >= 8:
            # Tentar ler como inteiro de 32 bits (little-endian)
            try:
                size1 = struct.unpack('<I', header[4:8])[0]
                print(f"Possível tamanho/offset em bytes 4-8: {size1}")
            except:
                pass
            
            # Tentar ler como inteiro de 32 bits (big-endian)
            try:
                size2 = struct.unpack('>I', header[4:8])[0]
                print(f"Possível tamanho/offset em bytes 4-8 (big-endian): {size2}")
            except:
                pass
        
        # Voltar ao início e ler todo o arquivo
        f.seek(0)
        all_data = f.read()
        
        print(f"\nTamanho total do arquivo: {len(all_data)} bytes")
        
        # Procurar por padrões que possam indicar nomes de livros
        bible_books_pt = [
            b'Genesis', b'G\xc3\xaanesis', b'Genesis',
            b'Exodo', b'\xc3\x8axodo', b'Exodus',
            b'Mateus', b'Matheus', b'Matthew',
            b'Joao', b'Jo\xc3\xa3o', b'John',
            b'Apocalipse', b'Revelation'
        ]
        
        print("\nProcurando por nomes de livros bíblicos...")
        for book in bible_books_pt:
            pos = all_data.find(book)
            if pos != -1:
                print(f"  ✓ Encontrado '{book.decode('utf-8', errors='ignore')}' na posição {pos}")
                # Mostrar contexto
                start = max(0, pos - 20)
                end = min(len(all_data), pos + len(book) + 20)
                context = all_data[start:end]
                print(f"    Contexto: {context[:50]}")

def extract_text_chunks(filepath, min_length=10):
    """Extrai todos os chunks de texto do arquivo"""
    print(f"\n{'='*60}")
    print("Extraindo chunks de texto...")
    print(f"{'='*60}\n")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    chunks = []
    current_chunk = []
    
    for i, byte in enumerate(data):
        if 32 <= byte < 127 or byte in [10, 13]:  # ASCII imprimível ou newline
            current_chunk.append(byte)
        else:
            if len(current_chunk) >= min_length:
                text = bytes(current_chunk).decode('utf-8', errors='ignore')
                chunks.append({
                    'position': i - len(current_chunk),
                    'length': len(current_chunk),
                    'text': text
                })
            current_chunk = []
    
    # Mostrar os primeiros chunks
    print(f"Total de chunks encontrados: {len(chunks)}\n")
    print("Primeiros 20 chunks:")
    for i, chunk in enumerate(chunks[:20]):
        preview = chunk['text'][:80].replace('\n', '\\n').replace('\r', '\\r')
        print(f"{i+1}. Pos {chunk['position']:6d}, Len {chunk['length']:4d}: {preview}")
    
    return chunks

def main():
    # Arquivo para analisar
    bib_file = r"c:\Holyrics\Holyrics\files\Bible LG\pt_nvi.bib"
    
    if not Path(bib_file).exists():
        print(f"Arquivo não encontrado: {bib_file}")
        return
    
    # Análise 1: Estrutura binária
    data, strings = analyze_binary_structure(bib_file)
    
    # Análise 2: Tentar parse
    try_parse_bib_file(bib_file)
    
    # Análise 3: Extrair texto
    chunks = extract_text_chunks(bib_file)
    
    # Salvar chunks em JSON para análise
    output_file = "bible_chunks.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(chunks[:100], f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print(f"Análise completa! Chunks salvos em: {output_file}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
