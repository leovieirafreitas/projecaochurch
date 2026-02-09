# Simple line-by-line replacement
with open(r'c:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\components\BibleSearch.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace line 272: change find to filter
for i in range(len(lines)):
    if i >= 271 and i <= 273 and 'const match = bookList.find' in lines[i]:
        lines[i] = '                    const matches = bookList.filter(b => \r\n'
        print(f"✅ Line {i+1}: Changed find to filter")
        break

# Write back
with open(r'c:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\components\BibleSearch.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done! Please check the file.")
