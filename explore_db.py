#!/usr/bin/env python3
"""
Explorador de banco de dados SQLite do Holyrics
"""

import sqlite3
import json

def explore_database(db_path):
    """Explora o banco de dados SQLite"""
    print(f"\n{'='*70}")
    print(f"Explorando: {db_path}")
    print(f"{'='*70}\n")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Listar todas as tabelas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"Tabelas encontradas: {len(tables)}\n")
        
        for table in tables:
            table_name = table[0]
            print(f"\n{'='*70}")
            print(f"Tabela: {table_name}")
            print(f"{'='*70}")
            
            # Obter estrutura da tabela
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            
            print("\nColunas:")
            for col in columns:
                print(f"  - {col[1]} ({col[2]})")
            
            # Contar registros
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"\nTotal de registros: {count}")
            
            # Mostrar primeiros 3 registros
            if count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
                rows = cursor.fetchall()
                
                print("\nPrimeiros registros:")
                for i, row in enumerate(rows, 1):
                    print(f"\n  Registro {i}:")
                    for j, col in enumerate(columns):
                        value = row[j]
                        if isinstance(value, bytes):
                            value = f"<bytes: {len(value)} bytes>"
                        elif isinstance(value, str) and len(value) > 100:
                            value = value[:100] + "..."
                        print(f"    {col[1]}: {value}")
        
        conn.close()
        
    except Exception as e:
        print(f"Erro: {e}")

def main():
    db_path = r"C:\Holyrics\Holyrics\files\database.db"
    explore_database(db_path)

if __name__ == "__main__":
    main()
