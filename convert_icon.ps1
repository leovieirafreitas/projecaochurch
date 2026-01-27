
Add-Type -AssemblyName System.Drawing

$sourcePath = "src-tauri\icons\ICONENOVO.png"
$destPath = "src-tauri\icons\icon.ico"

# Carregar imagem
$img = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = New-Object System.Drawing.Bitmap($img)

# Criar stream para salvar (ICO format is complex, but let's try a simple resize/save approch or use a proper header)
# Na verdade, System.Drawing.Icon.FromHandle pode funcionar melhor para criar ICO a partir de Bitmap
$iconHandle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)

# Salvar
$fileStream = New-Object System.IO.FileStream($destPath, [System.IO.FileMode]::Create)
$icon.Save($fileStream)
$fileStream.Close()

# Limpar
[System.Runtime.InteropServices.Marshal]::DestroyIcon($iconHandle) | Out-Null
$bitmap.Dispose()
$img.Dispose()

Write-Host "Ícone convertido com sucesso!"
