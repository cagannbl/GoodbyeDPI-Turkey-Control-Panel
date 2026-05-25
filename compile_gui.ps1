Write-Host "Mevcut GoodbyeDPIGUI.exe süreçleri kapatılıyor..." -ForegroundColor Yellow
Get-Process -Name "GoodbyeDPIGUI" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Write-Host "Modern C# ve WPF projesi derleniyor..." -ForegroundColor Cyan

# Run dotnet build targeting Release configuration
dotnet build src/GoodbyeDPIGUI.csproj -c Release --output src/build_out

if ($LASTEXITCODE -eq 0) {
    Write-Host "Derleme BAŞARILI! Çıktılar kopyalanıyor..." -ForegroundColor Green
    
    # Copy build binaries and config to the root folder for direct execution
    Copy-Item -Path src/build_out/* -Destination . -Force -Recurse
    
    # Remove temporary build output folder inside src
    Remove-Item -Path src/build_out -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "GoodbyeDPIGUI.exe başarıyla güncellendi." -ForegroundColor Green
} else {
    Write-Error "Derleme sırasında HATA oluştu!"
    Exit 1
}
