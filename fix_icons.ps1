
Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\FELIPE BARROSO\.gemini\antigravity\brain\5fc9cd4f-fddc-4ee1-9b1c-94d5a2fffc3f\uploaded_media_0_1769482681008.png"
$destIco = "C:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\src-tauri\icons\icon.ico"
$destPng = "C:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\src-tauri\icons\icon.png"

# Copiar PNG
Copy-Item $sourcePath -Destination $destPng -Force

# Converter para ICO
try {
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bitmap = New-Object System.Drawing.Bitmap($img)
    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    
    $fileStream = New-Object System.IO.FileStream($destIco, [System.IO.FileMode]::Create)
    $icon.Save($fileStream)
    $fileStream.Close()
    
    [System.Runtime.InteropServices.Marshal]::DestroyIcon($iconHandle) | Out-Null
    $bitmap.Dispose()
    $img.Dispose()
    Write-Host "SUCESSO"
}
catch {
    Write-Host "ERRO: $_"
}
