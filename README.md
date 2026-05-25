# GoodbyeDPI Turkey Control Panel v5.0
> **A Security and Performance Oriented Modern WPF GUI & Network Tunneling Engine Optimized for Turkish ISPs**

[English](#english) | [Türkçe](#türkçe)

---

<a name="english"></a>
# English Description

[![GitHub Actions Build](https://img.shields.io/github/actions/workflow/status/cagannbl/GoodbyeDPI-Turkey-Control-Panel/build.yml?branch=main&style=flat-square&logo=github&label=Build%20%26%20CI)](https://github.com/cagannbl/GoodbyeDPI-Turkey-Control-Panel/actions)
[![Platform](https://img.shields.io/badge/Platform-Windows%207%20%2F%208%20%2F%2010%20%2F%2011-0078d7.svg?style=flat-square&logo=windows)](https://dotnet.microsoft.com/)
[![Framework](https://img.shields.io/badge/.NET%20Framework-4.5%20%2F%204.8-512bd4.svg?style=flat-square&logo=.net)](https://dotnet.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

GoodbyeDPI Turkey Control Panel is an enterprise-grade GUI and network tunneling wrapper designed to circumvent Deep Packet Inspection (DPI) blocks and DNS censorship applied by Turkish ISPs (Turk Telekom, Superonline, Vodafone, etc.). Built on a high-stability v5.0 architecture, it provides a seamless and robust anti-censorship experience on Windows.

> [!NOTE]
> This application is **not a VPN**. It will not cause any slowdown in your general internet speed or gaming performance. It works by bypassing DPI inspection, not by routing your traffic through a remote server.

> [!IMPORTANT]
> The application must be run as **Administrator** on Windows 7, 8, 8.1, 10, and 11. The embedded UAC manifest handles this automatically — simply double-click `GoodbyeDPIGUI.exe`.

---

## Advanced Features

### 1. Modern Flat Dark UI & Visual Feedback
*   **Flat Dark Theme**: Custom programmatically loaded WPF `ControlTemplate` styles resolving all dark-mode ComboBox contrast and white text visibility issues.
*   **GPU-Accelerated breathing LED**: Fluid, zero-leak visual LED reflecting real-time bypass status (Active/Passive) rendered entirely on the GPU.
*   **Dynamic Administrative Privilege Badge**: Real-time sidebar indicator showing the current privilege status (`[Administrator]` in turquoise or `[Limited User]` in red).

### 2. High-Performance Bypass & Heuristic Auto-Tune
*   **ISP-Specific Presets**: Finely tuned bypass profiles pre-configured for Superonline, Turk Telekom, Vodafone, and more (Alternative 1-6).
*   **Heuristic Auto-Tune (Connection Analyzer)**: Automatically probes latency and connection stability for critical hosts (Discord, YouTube, Wikipedia, etc.), choosing the most optimal bypass profile for your network in seconds.

### 3. Mobile Hotspot, Dynamic PAC & SOCKS5 Proxy
*   **Local SOCKS5 / HTTP Proxy (Port 8085)**: Full RFC 1928 compliance. Features a bidirectional asynchronous `CopyStreamAsync` / `Task.WhenAny` pipeline supporting SOCKS5 UDP Associate tunneling for Discord voice channels and YouTube QUIC protocols.
*   **Dynamic PAC (Proxy Auto-Config) Server**: Dynamically reads `custom_blacklist.txt` and updates the PAC script array on the fly. Allows mobile devices (iOS/Android) or other applications to bypass DPI using your computer as a proxy.

### 4. Robust Security & Leak Protection
*   **IPv6 DNS Leak Protection**: Automatically locks IPv6 DNS addresses on active network adapters to loopback `::1`, preventing ISP-level DNS leakage and tracking.
*   **DoH (DNS over HTTPS) Fallback Resolver**: Securely resolves DNS queries using sharded, fallback-enabled DoH protocols over Cloudflare, Google, AdGuard, and Quad9.
*   **Local DNS Server (Port 53)**: Local UDP DNS server enabling mobile hotspot devices to bypass censorship simply by changing their DNS settings.

### 5. OS Integration & Build Stability
*   **Native UAC Manifest Integration**: Embedded `app.manifest` requesting administrative privileges on click — no need to manually right-click and select "Run as Administrator".
*   **Process Lock Prevention**: Compilation script `compile_gui.ps1` forcefully stops running instances before recompiling to prevent file lock errors (`CS0016`).

---

## Safety & Antivirus

### WinDivert False Positives

> [!WARNING]
> Some antivirus programs may flag `WinDivert.dll` or `WinDivert64.sys` as suspicious. This is a **false positive**. WinDivert is a well-known, open-source Windows packet capture library. The source code is fully public and auditable. If you encounter this, add the application folder to your antivirus exclusions.

### Kaspersky Antivirus

> [!CAUTION]
> **Kaspersky Antivirus blocks WinDivert's kernel-level drivers** due to its agreement with the Russian government. If Kaspersky is installed on your system — even if disabled — the bypass will most likely **not work**. Adding the folder to exclusions or disabling Kaspersky temporarily is **not sufficient**. You must completely remove Kaspersky from your system and use an alternative such as Windows Defender. As of 2025, Windows Defender provides excellent protection against malware and malicious websites.

---

## Quick Start

### Running
Double-click `GoodbyeDPIGUI.exe` to run.

1.  Select a pre-configured **Bypass Preset** matching your ISP.
2.  If you are unsure, click **Auto-Tune (Connection Analysis)** to automatically select the most optimal bypass profile.
3.  Click **Start Bypass** to activate the bypass engine.

### Compiling from Source
To compile the launcher from scratch, open Windows PowerShell in the project directory and run:
```powershell
powershell.exe -ExecutionPolicy Bypass -File compile_gui.ps1
```

> [!NOTE]
> The compile script automatically terminates any running instances before recompiling to prevent file lock errors, and embeds the UAC manifest into the final executable.

---

## File Structure

*   `src/` - Core C# source files (`MainWindow.cs`, `ProcessManager.cs`, `ProxyServer.cs`, etc.).
*   `GoodbyeDPI.Core/` - v5.0 enterprise network and security library.
*   `x86/` & `x86_64/` - Architecture-optimized native `goodbyedpi.exe` and `WinDivert` libraries.
*   `compile_gui.ps1` - Automated process cleanup and compilation script.
*   `custom_blacklist.txt` - Custom blacklist containing blocked domains for the proxy.

---

## Legal Notice

> [!IMPORTANT]
> All legal responsibility arising from the use of this application belongs to the user. This application has been written and edited solely for educational and research purposes. Whether to use this application under these terms is entirely the user's own choice.

---

<a name="türkçe"></a>
# Türkçe Açıklama

GoodbyeDPI Türkiye Kontrol Paneli, Türkiye'deki internet servis sağlayıcılarının (Türk Telekom, Superonline, Vodafone vb.) uyguladığı DPI (Derin Paket İnceleme) engellemelerini ve DNS sansürlerini aşmak amacıyla tasarlanmış, kurumsal kalitede **v5.0 stabilite ve güvenlik mimarisine sahip** modern bir arayüz ve ağ tünelleme uygulamasıdır.

> [!NOTE]
> Bu uygulama kesinlikle **bir VPN değildir** ve oyunlarda/genel internet kullanımında herhangi bir hız değişikliğine sebep olmayacaktır. Trafiğinizi uzak bir sunucuya yönlendirmek yerine DPI denetimini atlatarak çalışır.

> [!IMPORTANT]
> Uygulama, Windows 7, 8, 8.1, 10 ve 11 işletim sistemlerinde **yönetici olarak çalıştırılmalıdır.** Gömülü UAC manifestosu bunu otomatik olarak yönetir — `GoodbyeDPIGUI.exe` dosyasına çift tıklamanız yeterlidir.

---

## Öne Çıkan Gelişmiş Özellikler

### 1. Modern Flat Dark Arayüz & Görsel Geri Bildirim
*   **Flat Dark Teması**: WPF standart ComboBox kontrast ve beyaz metin çakışması hatalarını tamamen çözen programatik XAML ControlTemplate yaması.
*   **GPU Tabanlı Animasyonlu LED**: Gerçek zamanlı bypass durumunu gösteren, GPU render gücünü kullanan ve sızıntısız breathing (nefes alma) animasyonuna sahip durum göstergesi.
*   **Dinamik Yönetici Ayrıcalığı Sidebar Göstergesi**: Uygulamanın yetkisini anlık olarak sol menüde (`[Yönetici]` turkuaz veya `[Sınırlı Yetki]` kırmızı) gösteren görsel bildirim sistemi.

### 2. Gelişmiş Bypass & Sezgisel Auto-Tune Motoru
*   **Türkiye İSS Özel Presetleri**: Superonline, Türk Telekom, Vodafone ve diğer servis sağlayıcılar için ince ayarlanmış bypass profilleri (Alternatif 1-6).
*   **Heuristic Auto-Tune (Bağlantı Analizi)**: Discord, YouTube ve Wikipedia gibi kritik adreslere yönelik gecikme (latency) ve erişilebilirlik testlerini otomatik gerçekleştirerek ağınız için en stabil ve hızlı bypass yöntemini saniyeler içinde belirleyen sezgisel arama motoru.

### 3. Mobil Paylaşım, Dinamik PAC & SOCKS5 Proxy
*   **Yerel SOCKS5 / HTTP Proxy (Port 8085)**: Sunucu, RFC 1928 SOCKS5 standardına ve Discord ses kanalları ile YouTube QUIC protokolü için çift yönlü asenkron `CopyStreamAsync` / `Task.WhenAny` UDP Associate tünelleme yeteneklerine sahiptir.
*   **Dinamik PAC (Proxy Auto-Config) Sunucusu**: `custom_blacklist.txt` dosyasındaki yasaklı siteleri satır satır dinamik olarak okuyup tarayıcılara sunulan `proxy.pac` dosyasına enjekte eder. Mobil cihazlar (iOS/Android) veya diğer uygulamalar, bilgisayarı proxy olarak kullanarak sansürleri zahmetsizce aşabilir.

### 4. Ağ Güvenliği & Sızıntı Koruması
*   **IPv6 DNS Sızıntı Koruması**: Aktif ağ adaptörlerindeki IPv6 DNS adreslerini loopback `::1` adresine bağlayarak İSS düzeyindeki DNS sızıntılarını ve takibini engeller.
*   **DoH (DNS over HTTPS) Fallback Resolver**: DNS sorgularını Cloudflare, Google, AdGuard ve Quad9 üzerinden DoH protokolü ile yedekli (fallback) olarak şifreli çözen motor.
*   **Yerel DNS Sunucusu (Port 53)**: Mobil cihazların proxy kurmadan sadece DNS değiştirerek yararlanabilmesi için Cloudflare/Google DoH destekli hafif UDP DNS sunucusu.

### 5. Yüksek Kararlılık & İşletim Sistemi Entegrasyonu
*   **Native UAC (Yönetici) Manifest**: Derlenen EXE içerisine gömülü `app.manifest` sayesinde sağ tıklamaya gerek kalmadan çift tıklamayla doğrudan yönetici ayrıcalıkları (UAC yetkisi) ile açılma.
*   **Dosya Kilitlenme Koruması**: Geliştirme ve derleme sırasında arka planda çalışan ve kilitlenme hatasına (`CS0016`) sebep olan zombi süreçleri otomatik temizleyen `compile_gui.ps1` entegrasyonu.

---

## Güvenlik & Antivirüs

### WinDivert Hatalı Virüs Uyarısı (False-Positive)

> [!WARNING]
> Bazı antivirüs programları `WinDivert.dll` veya `WinDivert64.sys` dosyalarını şüpheli olarak işaretleyebilir. Bu **hatalı bir uyarıdır (false-positive)**. WinDivert, iyi bilinen ve açık kaynak kodlu bir Windows paket yakalama kütüphanesidir. Tüm kaynak kodu herkese açık ve incelenebilirdir. Bu sorunla karşılaşırsanız uygulama klasörünü antivirüs dışlamalarına ekleyin.

### Kaspersky Antivirüs Engeli

> [!CAUTION]
> **Kaspersky antivirüs yazılımı, Rus hükümetiyle olan anlaşması nedeniyle WinDivert'in çekirdek (kernel) seviyesi sürücülerini engeller.** Kaspersky bilgisayarınızda yüklüyse — pasif olsa dahi — bypass büyük ihtimalle **çalışmayacaktır.** Klasörü dışlamalara eklemek veya Kaspersky'yi geçici olarak devre dışı bırakmak **yeterli değildir.** Kaspersky'yi sisteminizden tamamen kaldırmanız ve Windows Defender gibi alternatif bir antivirüs kullanmanız gerekmektedir. 2025 yılı itibarıyla Windows Defender, kötü amaçlı yazılım ve sitelere karşı son derece yeterli koruma sağlamaktadır.

---

## Hızlı Başlangıç

### Çalıştırma
Oluşturulan `GoodbyeDPIGUI.exe` dosyasına çift tıklayarak uygulamayı başlatabilirsiniz.

1.  Açılan ekranda **Bypass Preseti** menüsünden ağınıza en uygun yöntemi seçin.
2.  Eğer en iyi yöntemi bilmiyorsanız, **Otomatik Ayarla (Bağlantı Analizi)** butonuna basarak ağınız için en kararlı profili otomatik olarak tespit edebilirsiniz.
3.  **Bypass'ı Başlat** butonuna basarak bypass motorunu aktif hale getirin.

### Kaynak Koddan Derleme
Uygulamayı sıfırdan derlemek için Windows PowerShell üzerinde proje ana dizinine gidip aşağıdaki komutu çalıştırmanız yeterlidir:

```powershell
powershell.exe -ExecutionPolicy Bypass -File compile_gui.ps1
```

> [!NOTE]
> Derleme betiği, dosya kilitleme hatalarını önlemek için yeniden derleme öncesinde çalışan tüm örnekleri otomatik olarak sonlandırır ve UAC manifestosunu son yürütülebilir dosyaya gömer.

---

## Dosya Yapısı

*   `src/` - Arayüz ve ağ yönetim motorunun asıl C# kaynak kodları (`MainWindow.cs`, `ProcessManager.cs`, `ProxyServer.cs` vb.).
*   `GoodbyeDPI.Core/` - v5.0 kurumsal ağ ve güvenlik çekirdek kütüphanesi.
*   `x86/` & `x86_64/` - 32-bit ve 64-bit platformlar için optimize edilmiş native `goodbyedpi.exe` motoru ve `WinDivert` sürücü kütüphaneleri.
*   `compile_gui.ps1` - Tek tıkla süreç temizliği ve güvenlik manifestosu gömülü derleme otomasyon betiği.
*   `custom_blacklist.txt` - Bypass işlemlerinin ve dinamik PAC dosyasının temel alacağı kişiselleştirilmiş engelli siteler listesi.

---

## Yasal Uyarı

> [!IMPORTANT]
> Bu uygulamanın kullanımından doğan her türlü yasal sorumluluk kullanan kişiye aittir. Uygulama yalnızca eğitim ve araştırma amaçları ile yazılmış ve düzenlenmiş olup; bu uygulamayı bu şartlar altında kullanmak ya da kullanmamak kullanıcının kendi seçimidir.

---

## Teşekkürler & Krediler (Credits)
Bu proje, açık kaynak dünyasının gücü ve topluluk paylaşımları sayesinde geliştirilmiştir. Projenin temelini oluşturan ve ilham veren orijinal çalışmalara teşekkür ederiz:

*   **[ValdikSS/GoodbyeDPI](https://github.com/ValdikSS/GoodbyeDPI)** - Sansürleri aşmamızı sağlayan çekirdek bypass motorunun (`goodbyedpi.exe`) asıl mucidi ve geliştiricisi.
*   **[cagritaskn/GoodbyeDPI-Turkey](https://github.com/cagritaskn/GoodbyeDPI-Turkey)** - Orijinal C# WPF kontrol arayüzünün ilk sürümünü tasarlayan ve bu projenin temelini atan geliştirici.
