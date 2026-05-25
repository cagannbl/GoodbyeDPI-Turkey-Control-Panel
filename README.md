# 🛡️ GoodbyeDPI Türkiye Kontrol Paneli v5.0
> **Türkiye İSS'leri İçin Optimize Edilmiş, Güvenlik ve Performans Odaklı Modern WPF Arayüzü & Ağ Yönetim Motoru**

[![GitHub Actions Build](https://img.shields.io/github/actions/workflow/status/cagannbl/GoodbyeDPI-Turkey-Control-Panel/build.yml?branch=main&style=flat-square&logo=github&label=Build%20%26%20CI)](https://github.com/cagannbl/GoodbyeDPI-Turkey-Control-Panel/actions)
[![Platform](https://img.shields.io/badge/Platform-Windows%207%20%2F%208%20%2F%2010%20%2F%2011-0078d7.svg?style=flat-square&logo=windows)](https://dotnet.microsoft.com/)
[![Framework](https://img.shields.io/badge/.NET%20Framework-4.5%20%2F%204.8-512bd4.svg?style=flat-square&logo=.net)](https://dotnet.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

GoodbyeDPI Türkiye Kontrol Paneli, Türkiye'deki internet servis sağlayıcılarının (Türk Telekom, Superonline, Vodafone vb.) uyguladığı DPI (Derin Paket İnceleme) engellemelerini ve DNS sansürlerini aşmak amacıyla tasarlanmış, kurumsal kalitede **v5.0 stabilite ve güvenlik mimarisine sahip** modern bir arayüz ve ağ tünelleme uygulamasıdır.

---

## ✨ Öne Çıkan Gelişmiş Özellikler

### 🎨 1. Modern Flat Dark Arayüz & Görsel Geri Bildirim
*   **Flat Dark Teması**: WPF standart ComboBox kontrast ve beyaz metin çakışması hatalarını tamamen çözen programatik XAML ControlTemplate yaması.
*   **GPU Tabanlı Animasyonlu LED**: Gerçek zamanlı bypass durumunu gösteren, GPU render gücünü kullanan ve sızıntısız breathing (nefes alma) animasyonuna sahip durum göstergesi.
*   **Dinamik Yönetici Ayrıcalığı Sidebar Göstergesi**: Uygulamanın yetkisini anlık olarak sol menüde (`[Yönetici] 🛡️` turkuaz veya `[Sınırlı Yetki] ⚠️` kırmızı) gösteren görsel bildirim sistemi.

### ⚙️ 2. Gelişmiş Bypass & Sezgisel Auto-Tune Motoru
*   **Türkiye İSS Özel Presetleri**: Superonline, Türk Telekom, Vodafone ve diğer servis sağlayıcılar için ince ayarlanmış bypass profilleri (Alternatif 1-6).
*   **Heuristic Auto-Tune (Bağlantı Analizi)**: Discord, YouTube ve Wikipedia gibi kritik adreslere yönelik gecikme (latency) ve erişilebilirlik testlerini otomatik gerçekleştirerek ağınız için en stabil ve hızlı bypass yöntemini saniyeler içinde belirleyen sezgisel arama motoru.

### 🌐 3. Mobil Paylaşım, Dinamik PAC & SOCKS5 Proxy
*   **Yerel SOCKS5 / HTTP Proxy (Port 8085)**: Sunucu, RFC 1928 SOCKS5 standardına ve Discord ses kanalları ile YouTube QUIC protokolü için çift yönlü asenkron `CopyStreamAsync` / `Task.WhenAny` UDP Associate tünelleme yeteneklerine sahiptir.
*   **Dinamik PAC (Proxy Auto-Config) Sunucusu**: `custom_blacklist.txt` dosyasındaki yasaklı siteleri satır satır dinamik olarak okuyup tarayıcılara sunulan `proxy.pac` dosyasına enjekte eder. Mobil cihazlar (iOS/Android) veya diğer uygulamalar, bilgisayarı proxy olarak kullanarak sansürleri zahmetsizce aşabilir.

### 🔒 4. Ağ Güvenliği & Sızıntı Koruması
*   **IPv6 DNS Sızıntı Koruması**: Aktif ağ adaptörlerindeki IPv6 DNS adreslerini loopback `::1` adresine bağlayarak İSS düzeyindeki DNS sızıntılarını ve takibini engeller.
*   **DoH (DNS over HTTPS) Fallback Resolver**: DNS sorgularını Cloudflare, Google, AdGuard ve Quad9 üzerinden DoH protokolü ile yedekli (fallback) olarak şifreli çözen motor.
*   **Yerel DNS Sunucusu (Port 53)**: Mobil cihazların proxy kurmadan sadece DNS değiştirerek yararlanabilmesi için Cloudflare/Google DoH destekli hafif UDP DNS sunucusu.

### 🛠️ 5. Yüksek Kararlılık & İşletim Sistemi Entegrasyonu
*   **Native UAC (Yönetici) Manifest**: Derlenen EXE içerisine gömülü `app.manifest` sayesinde sağ tıklamaya gerek kalmadan çift tıklamayla doğrudan yönetici ayrıcalıkları (UAC yetkisi) ile açılma.
*   **Dosya Kilitlenme Koruması**: Geliştirme ve derleme sırasında arka planda çalışan ve kilitlenme hatasına (`CS0016`) sebep olan zombi süreçleri otomatik temizleyen `compile_gui.ps1` entegrasyonu.

---

## 🚀 Hızlı Başlangıç

### Derleme (Compile)
Uygulamayı sıfırdan derlemek için Windows PowerShell üzerinde proje ana dizinine gidip aşağıdaki komutu çalıştırmanız yeterlidir. Betik süreç kilitlerini temizleyecek, manifestoyu gömecek ve `csc.exe` (C# 5) derleyicisiyle hatasız olarak EXE dosyasını oluşturacaktır:

```powershell
powershell.exe -ExecutionPolicy Bypass -File compile_gui.ps1
```

### Çalıştırma
Oluşturulan `GoodbyeDPIGUI.exe` dosyasına çift tıklayarak uygulamayı başlatabilirsiniz. 

1.  Açılan ekranda **Bypass Preseti** menüsünden ağınıza en uygun yöntemi seçin.
2.  Eğer en iyi yöntemi bilmiyorsanız, **Otomatik Ayarla (Bağlantı Analizi)** butonuna basarak ağınız için en kararlı profili otomatik olarak tespit edebilirsiniz.
3.  **Bypass'ı Başlat** butonuna basarak bypass motorunu aktif hale getirin.

---

## 📂 Dosya Yapısı

*   `src/` - Arayüz ve ağ yönetim motorunun asıl C# kaynak kodları (`MainWindow.cs`, `ProcessManager.cs`, `ProxyServer.cs` vb.).
*   `GoodbyeDPI.Core/` - v5.0 kurumsal ağ ve güvenlik çekirdek kütüphanesi.
*   `x86/` & `x86_64/` - 32-bit ve 64-bit platformlar için optimize edilmiş native `goodbyedpi.exe` motoru ve `WinDivert` sürücü kütüphaneleri.
*   `compile_gui.ps1` - Tek tıkla süreç temizliği ve güvenlik manifestosu gömülü derleme otomasyon betiği.
*   `custom_blacklist.txt` - Bypass işlemlerinin ve dinamik PAC dosyasının temel alacağı kişiselleştirilmiş engelli siteler listesi.

---

## 💖 Teşekkürler & Krediler (Credits)
Bu proje, açık kaynak dünyasının gücü ve topluluk paylaşımları sayesinde geliştirilmiştir. Projenin temelini oluşturan ve ilham veren orijinal çalışmalara teşekkür ederiz:

*   **[ValdikSS/GoodbyeDPI](https://github.com/ValdikSS/GoodbyeDPI)** - Sansürleri aşmamızı sağlayan çekirdek bypass motorunun (`goodbyedpi.exe`) asıl mucidi ve geliştiricisi.
*   **[cagritaskn/GoodbyeDPI-Turkey](https://github.com/cagritaskn/GoodbyeDPI-Turkey)** - Orijinal C# WPF kontrol arayüzünün ilk sürümünü tasarlayan ve bu projenin temelini atan geliştirici.
