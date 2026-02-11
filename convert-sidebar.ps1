
Add-Type -AssemblyName System.Drawing

$sourcePath = "src-tauri\icons\PROJECTIONCHURCH_LATERAL_EXE.png"
$destPath = "src-tauri\icons\sidebar.bmp"

Write-Host "🎨 Convertendo imagem para formato BMP compatível com NSIS..."

try {
    # Carrega a imagem original
    $originalImage = [System.Drawing.Image]::FromFile($sourcePath)

    # Dimensões padrão do sidebar do NSIS (aproximadamente 164x314)
    $width = 164
    $height = 314

    # Cria um novo bitmap vazio com fundo branco
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.Clear([System.Drawing.Color]::White)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Calcula proporções para centralizar o logo sem distorcer
    # Vamos fazer o logo ocupar 80% da largura (aprox 130px)
    $logoWidth = 130
    $scaleFactor = $logoWidth / $originalImage.Width
    $logoHeight = $originalImage.Height * $scaleFactor
    
    # Centraliza
    $x = ($width - $logoWidth) / 2
    $y = ($height - $logoHeight) / 2 # Centralizado verticalmente
    # Ou se preferir no topo: $y = 20 

    # Desenha o logo no bitmap
    $graph.DrawImage($originalImage, $x, $y, $logoWidth, $logoHeight)

    # Salva como BMP
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

    # Limpeza
    $originalImage.Dispose()
    $bmp.Dispose()
    $graph.Dispose()

    Write-Host "✅ Imagem convertida com sucesso: $destPath"
}
catch {
    Write-Host "❌ Erro na conversão: $_"
    exit 1
}
