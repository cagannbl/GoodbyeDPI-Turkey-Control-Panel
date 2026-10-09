# WebCraft

Tarayıcıda çalışan, tamamen **HTML5 + WebGL2 + saf JavaScript** ile sıfırdan yazılmış Minecraft tarzı blok oyunu.
Hiçbir kütüphane, derleme adımı veya harici görsel/ses dosyası yoktur — tüm dokular ve sesler kodla üretilir.

## Çalıştırma

`index.html` dosyasını tarayıcıda açman yeterli. (İstersen yerel sunucu: `python3 -m http.server` → `http://localhost:8000`)

## Özellikler

- Sonsuz, tohum tabanlı prosedürel dünya: ova, orman, çöl, karlı tundra, dağlar, sahil ve okyanus biyomları
- Mağaralar, yer altı lav gölleri, kömür / demir / altın / kızıltaş / elmas / zümrüt cevherleri
- Meşe, huş ve ladin ağaçları, kaktüsler, çiçekler, uzun çimen, balkabakları
- 185 blok türü (durumlar dahil) + 100'den fazla eşya, kodla üretilmiş keskin piksel-art dokular
- **Nether**: kızıl ve çarpık ormanlar, ruh kumu vadileri, lav denizi, ışıktaşı, kuvars, kadim kalıntı (netherit)
- **End**: End adası, obsidyen sütunlar, çıkış geçidi, ejderha yumurtası, koro bitkili dış adalar
- Obsidyen çerçeve + çakmak ile Nether geçidi; 12 gözlü çerçeve ile End geçidi
- Minecraft tarzı envanter: 2x2 üretim, çalışma masasında 3x3 üretim, tarif kitabı, fırın, sandık, sekmeli yaratıcı envanter
- Tahta, taş, demir, altın, elmas ve netherit kazma/balta/kürek/kılıç (dayanıklılık, kazma hızı, hasar)
- Kovalar (su + lav = obsidyen), ender incisi, yiyecekler, canlı ganimetleri
- **Açlık barı**: yemek, doygunluk ve yorgunluk (koşmak, zıplamak, savaşmak); tokken can yenilenir, açken can azalır
- **Tarım**: çapa ile tarla, tohum, 8 evreli buğday, suya yakın ıslak tarla, ekmek, kemik tozu, fidan dikip ağaç büyütme
- **Zırh**: deri, altın, demir, elmas ve netherit miğfer/göğüslük/pantolon/botlar (Minecraft koruma formülü, dayanıklılık)
- **Yatak**: gece uyuyup sabaha geç, doğma noktası ayarla (Nether ve End'de patlar)
- **Yay ve ok**: gerdikçe güçlenen atış, yerdeki okları geri toplama
- **Akan su ve lav**: kaynak/akan/düşen sıvı, en yakın çukura yönelen akış, sonsuz su kaynağı, akıntının itmesi,
  su + lav = obsidyen / kırıktaş / taş
- **Şekilli bloklar**: yarım bloklar (birleşince tam blok), basamaklar, açılır kapı, tuzak kapı, çit ve çit kapısı,
  cam panel, tırmanma merdiveni; alçak bloklara kendiliğinden çıkma
- **Ender Ejderhası**: uçan, dalış yapan, çıkış geçidine konan boss; sütunlardaki End kristalleri onu iyileştirir,
  yenilince çıkış geçidi açılır ve ejderha yumurtası belirir
- Güneş ışığı + blok ışığı (meşale, ışıktaşı, lav, fener balkabağı) yayılımı, yumuşak aydınlatma ve ambient occlusion
- Gece-gündüz döngüsü, kare güneş ve ay, yıldızlar, gün batımı, hareketli bulutlar, sis, animasyonlu su ve lav
- **Hayatta Kalma** modu: sağlık, düşme hasarı, boğulma, lav, kırma süresi, envanter ve tarifler (üretim)
- **Yaratıcı** mod: sınırsız blok, anında kırma, uçma (Boşluk tuşuna iki kez bas)
- Canlılar: domuz, inek, koyun, tavuk, zombi ve ok atan iskelet (gün ışığında yanarlar), duvara tırmanan örümcek,
  patlayan creeper, Enderman ve zombi piglin
- Ateşlenebilir TNT ve zincirleme patlamalar, düşen kum/çakıl
- Sentezlenmiş ses efektleri ve üretken ambiyans müziği
- Dünyalar tarayıcıya otomatik kaydedilir (birden fazla dünya)
- Dokunmatik ekran desteği (joystick + butonlar)

## Kontroller

| Tuş | İşlev |
| --- | --- |
| W A S D | Hareket |
| Boşluk | Zıpla / yüz (Yaratıcı'da iki kez: uç) |
| Shift | Eğil / alçal |
| R, Ctrl veya W W | Koş |
| Sol tık | Kır / saldır |
| Sağ tık | Koy / kullan / masa, fırın, sandık, yatak |
| Sağ tık (basılı) | Yemek ye / yayı ger |
| Orta tık | Bloğu seç |
| 1-9, tekerlek | Eşya seç |
| E | Envanter ve tarifler |
| Q | Seçili eşyayı at |
| F1 / F2 / F3 | Arayüzü gizle / ekran görüntüsü / hata ayıklama |
| Esc | Duraklat |

## Kod yapısı

| Dosya | İçerik |
| --- | --- |
| `js/util.js` | Gürültü (simplex), rastgele sayı, matris yardımcıları |
| `js/blocks.js` | Blok tanımları, prosedürel dokular, ikonlar |
| `js/items.js` | Eşyalar, aletler, tarifler, fırın tarifleri, kazma kuralları |
| `js/shapes.js` | Yarım blok, basamak, kapı, çit vb. kutu modelleri (çizim + çarpışma) |
| `js/fluids.js` | Su ve lav akış simülasyonu |
| `js/dragon.js` | Ender Ejderhası ve End kristalleri |
| `js/world.js` | Parçalar, arazi/biyom/mağara/ağaç üretimi |
| `js/mesher.js` | Işık yayılımı ve mesh üretimi |
| `js/renderer.js` | WebGL2 çizici ve shader'lar |
| `js/player.js` | Fizik, çarpışma, ışın izleme, oyuncu |
| `js/entities.js` | Canlılar, yapay zekâ, parçacıklar |
| `js/audio.js` | Ses efektleri ve müzik |
| `js/ui.js` | Menüler, HUD, envanter, dokunmatik kontroller |
| `js/main.js` | Oyun döngüsü, etkileşim, kayıt |
