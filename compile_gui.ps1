$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    Write-Error "C# Derleyici (csc.exe) bulunamadı! .NET Framework 4.5 veya üzeri kurulu olmalıdır."
    Exit 1
}

Write-Host "Mevcut GoodbyeDPIGUI.exe süreçleri kapatılıyor..." -ForegroundColor Yellow
Get-Process -Name "GoodbyeDPIGUI" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Write-Host "Modüler C# dosyaları derleniyor..." -ForegroundColor Cyan

# Compile all .cs files in the src directory referencing WPF and WinForms DLLs.
$compileCmd = "& '$cscPath' /target:winexe /win32manifest:src\app.manifest /out:GoodbyeDPIGUI.exe /lib:C:\Windows\Microsoft.NET\Framework64\v4.0.30319,C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.ServiceProcess.dll /reference:System.Core.dll /reference:System.Net.Http.dll /reference:System.Xaml.dll /reference:WindowsBase.dll /reference:PresentationCore.dll /reference:PresentationFramework.dll src\*.cs"

Invoke-Expression $compileCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "Derleme BAŞARILI! GoodbyeDPIGUI.exe başarıyla oluşturuldu." -ForegroundColor Green
} else {
    Write-Error "Derleme sırasında HATA oluştu!"
    Exit 1
}
