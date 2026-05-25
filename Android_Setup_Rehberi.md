# GoodbyeDPI - Telefon (Android & iOS) Kurulum & Paylaşım Rehberi

Bu rehber, bilgisayarınızda çalışan GoodbyeDPI'ın internet engelini aşma gücünü telefonunuza (Android ve iPhone) nasıl yansıtacağınızı açıklamaktadır. 

---

## 🚀 En Pratik Yöntem: PAC Sunucu & QR Kod ile Paylaşım (v2.5)

Yeni geliştirdiğimiz arayüzde yer alan **Yerel PAC (Proxy Auto-Config) Sunucusu** ve **QR Kod** sayesinde, telefonunuza hiçbir ek uygulama kurmanıza gerek kalmaz. Üstelik bu yöntemle telefonunuzun **tüm trafiği bilgisayara yönlendirilmez**; sadece engelli sitelerin (Discord, YouTube vb.) trafiği bilgisayardan geçer. Böylece bilgisayar kapansa bile telefonunuzda normal sitelere girmeye devam edebilirsiniz!

### Kurulum Adımları (Wi-Fi Bağlıyken):

1. Bilgisayarınızda **GoodbyeDPIGUI.exe** dosyasını çalıştırın ve bypass'ı başlatın.
2. Sol alttaki **"Mobil Paylaşım (Yerel Ağ PAC & Proxy)"** kutusundaki **"Proxy ve PAC Sunucusunu Aç"** seçeneğini işaretleyin.
3. Sağ tarafta otomatik olarak bir **QR Kod** oluşacak ve altında bir **PAC URL** adresi yazacaktır.
   * Örneğin: `http://192.168.1.50:8085/proxy.pac`

#### Android Cihazlarda Ayarlar:
1. Telefonunuzun **Ayarlar -> Wi-Fi** menüsüne gidin ve bağlı olduğunuz ağın ayarlarına girin.
2. **Proxy** seçeneğini bulun ve **"Otomatik Yapılandırma"** (veya **Proxy Auto-Config / PAC**) olarak seçin.
3. Arayüzde yazan PAC URL'sini girin (Örn: `http://192.168.1.50:8085/proxy.pac`) ya da QR kod okuyucu bir uygulamayla bilgisayar ekranındaki QR kodu taratarak bu adresi kopyalayıp yapıştırın.
4. Ayarları kaydedin.

#### iOS (iPhone / iPad) Cihazlarda Ayarlar:
1. **Ayarlar -> Wi-Fi** bölümüne gidin ve bağlı olduğunuz ağın yanındaki mavi bilgi `(i)` simgesine dokunun.
2. En alttaki **"Proxy'yi Ayarla"** seçeneğine dokunun ve **"Otomatik"** olarak değiştirin.
3. **URL** kısmına bilgisayar ekranında yazan PAC adresini girin.
4. Sağ üstten **Kaydet** butonuna basın.

Artık telefonunuz sadece engelli sitelere girmeye çalıştığında bilgisayarınızın ağını kullanacak, diğer tüm internet trafiğini kendi üzerinden doğrudan gerçekleştirecektir.

> [!TIP]
> Bilgisayarınız kapandığında veya proxy'yi kapattığınızda telefonunuzda internet kesintisi yaşanmaz. Sadece engelli sitelere erişim durur. Eğer bilgisayar tamamen kapalıyken de engelli sitelere girmek isterseniz aşağıdaki 2. Yöntemi uygulayabilirsiniz.

---

## Yöntem 2: Telefona Bağımsız ByeDPI Kurulumu (Android)

Bilgisayarınız açık olmak zorunda kalmadan, doğrudan telefonunuz üzerinden tüm yasakları aşmak için açık kaynaklı **ByeDPI** uygulamasını kullanabilirsiniz.

### Kurulum Adımları:
1. Telefon tarayıcınızdan resmi **ByeDPI Android** GitHub sayfasına gidin:
   👉 [ByeDPI Android Releases](https://github.com/c4as/ByeDPIAndroid/releases)
2. En son sürümdeki `.apk` dosyasını (Örn: `ByeDPIAndroid-v1.x.x.apk`) indirin ve kurun.
3. Uygulamayı açıp Ayarlar (dişli çark) simgesine dokunun ve şu ayarları yapın:
   * **Mode:** `VPN (SOCKS Local)` seçin.
   * **TCP Split (Parçalama):** Aktif edin.
   * **Split Position:** `3` veya `5` yapın (Superonline için `3` önerilir).
   * **QUIC Blocking:** Aktif edin (çalışması için kritiktir).
   * **DNS Settings:** `DNS-over-HTTPS (DoH)` seçin ve `Cloudflare` (1.1.1.1) sağlayıcısını ayarlayın.
4. Ana ekrana dönüp **"Connect"** butonuna basın.
