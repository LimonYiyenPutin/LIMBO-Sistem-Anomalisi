# L.I.M.B.O. // SİSTEM_ANOMALİSİ

Retro FPS / psikolojik korku deneyimi. 15 katman, ULTRAKILL tarzı hızlı hareket,
gerçek masaüstü pencereleri, Backrooms şematik haritası ve yalnızca
`LIMBO_SANDBOX` içinde çalışan dosya bulmacaları.

> Bu oyun meta-kurgu öğeleri kullanır: harici pencereler, sahte çekirdek paniği,
> fare ele geçirme sahneleri ve isteğe bağlı masaüstü anomalileri. İlk kez
> oynuyorsan **Ayarlar → Meta Etkiler** bölümünü kontrol et.

## Windows

Windows 10/11 (64-bit) için kurulum ve taşınabilir sürüm üretmek:

```bat
build-win.bat
```

veya:

```bat
npm install
npm run build:win
```

Çıktılar `dist\` klasöründe:

- `LIMBO-Sistem-Anomalisi-Setup-1.0.0.exe` — kurulum sihirbazı (masaüstü ve başlat menüsü kısayolu)
- `LIMBO-Sistem-Anomalisi-1.0.0-portable.exe` — kurulum gerektirmeyen taşınabilir sürüm

Kaynak ağacından çalıştırmak için `start.bat` dosyasına çift tıkla veya:

```bat
npm install
npm start
```

Windows'ta harici pencereler, dosya gezgini, sandbox ve `SIFIRLA.txt` akışı
yerel Windows yollarını kullanır. Duvar kağıdı anomalisi Windows'ta gerçek
masaüstünü değiştirmez; oyun içi görsel simülasyon olarak çalışır.

> Yapı imzasız olduğu için SmartScreen ilk çalıştırmada uyarı gösterebilir:
> **Daha fazla bilgi → Yine de çalıştır**.

> Windows'ta ilk build sırasında `winCodeSign` için "Cannot create symbolic
> link" hatası alırsan Windows **Geliştirici Modu**'nu aç veya terminali yönetici
> olarak çalıştır. Hazır kurulum/portable dosyaları bu adımı gerektirmez.

## Çalıştırma

### Tek dosya (önerilen)

```bash
./dist/LIMBO-Sistem-Anomalisi-1.0.0.AppImage
```

AppImage; Electron, oyun kodu, yazı tipleri ve tüm prosedürel varlıkları tek
dosyada taşır. Hedef sistemde Node.js veya Electron kurulu olması gerekmez.
FUSE bulunmayan sistemlerde:

```bash
./dist/LIMBO-Sistem-Anomalisi-1.0.0.AppImage --appimage-extract-and-run
```

Kısıtlı Linux ortamlarında (unprivileged user namespace kapalıysa) doğrudan
terminalden başlatırken `--no-sandbox` gerekebilir:

```bash
./dist/LIMBO-Sistem-Anomalisi-1.0.0.AppImage --no-sandbox
```

### Geliştirme / kaynak ağacından

Proje, taşınabilir Electron ile birlikte gelir:

```bash
./start.sh
```

Doğrudan çalıştırmak için:

```bash
./.tools/electron/electron . --no-sandbox
```

Linux'ta `--no-sandbox` gerekebilir. Sistemde Electron kuruluysa `npm start` da
kullanılabilir.

## Kontroller

| Tuş | İşlev |
| --- | --- |
| `W A S D` | Hareket |
| `Fare` | Bakış (pointer-lock nişan modu) |
| `T` | Fare modu: yerel imleç + harici pencerelerle etkileşim. Tekrar `T` ile nişan moduna dön |
| `Sol tık` | Ateş |
| `Space` | Zıpla |
| `C` | Eğil (crouch) |
| `Shift` | Atılma (dash) |
| `Ctrl` | Kayma (slide) |
| `V` | 1. şahıs / 3. şahıs kamera geçişi |
| `TAB` | Backrooms şematik haritasını aç/kapat |
| `+ / -` veya tekerlek | Haritada yakınlaştır / uzaklaştır |
| `Ok tuşları` / `WASD` | Haritada kaydır |
| `1 / 2 / 3` | Veri Bıçağı / Sektör Tüfeği / Çekirdek Makinesi |
| `E` | Terminal / çıkışla etkileşime gir |
| `I` | Envanteri aç/kapat |
| `F` | Açık harici pencereyi kapat; pencere yoksa feneri aç/kapat |
| `F2` | `LIMBO_SANDBOX` dosya gezginini aç |
| `F3` | Hitbox / çarpışma kutusu katmanını aç/kapat |
| `F4` | Oyun içi dosya konsolu (dosya bulmacası olan katmanlarda) |
| `Q` | Mutlak Sıfır donma protokolü (12. katman) |
| `Esc` | Duraklat / panelden çık |
| `Shift + R` | Katmanı yeniden başlat |

`T` fare modundayken oyun girdileri durur; böylece harici pencereler gerçekten
tıklanabilir. Popup/terminal kapandığında ana pencere yeniden odaklanır.

### Zamanlı puzzle'lar

Dosya konsolu veya terminal tuş takımı açıldığında görünür bir **60 saniyelik**
sayaç başlar. Panel açık kaldığı sürece WASD ile hareket etmeye devam edebilirsin;
fare nişanı panelden çıkmak için serbest kalır. Panel kendi kendine kapanmaz.
Süre dolduğunda sahte bir mavi ekran (BSOD) gösterilir, ilerleme kaydedilir ve
uygulama kapanır. Doğru dosya token'ı veya terminal kodu girildiğinde sayaç durur.

### 3B nişan

Silahlar artık ekranın tam merkezindeki nişan doğrultusunda ateş eder. Yukarı veya
aşağı baktığında merminin yüksekliği de değişir; yürüyüş salınımı ve zıplama
yüksekliği de nişan çizgisine dahil edilir. Düşmanın gövde kutusuna denk gelmeyen
atışlar hasar vermez. Çekirdek makinesinin enerji küresi de aynı eğimle ilerler ve
patlama mesafesi üç boyutlu hesaplanır.

## Akış

- Menüden **OTURUMU BAŞLAT** ile ilerleyebilir veya **BÖLÜM ARŞİVİ** ile 15
  katmanın tamamına erişebilirsin.
- 05. katmanda sahte bir çıkış, 08. katmanda QTE stabilizasyonu, 09. katmanda
  terminal şifresi, 12. katmanda zaman yavaşlatma/donma, 13. katmanda dalga
  arenası bulunur.
- Mekânlar katmanla değişir: 05 terk edilmiş otopark/banliyö, 06 yüzen boşluk,
  07 açık mezarlık, 11 ayna meydanı, 13 konteyner sahası, 14-15 kırmızı boşluk
  arenaları. Açık alanlarda prosedürel gökyüzü ve katman başına artan glitch
  bozulması kullanılır.
- 04, 10 ve 14. katmanlardaki yöneticiler ekrana gerçek, her zaman üstte kalan
  pencereler açar. Bu pencereler kalkan görevi görür; `F` ile (veya fare modunda
  tıklayarak) kapatılmadan yöneticiye hasar verilemez.
- 3, 8 ve 15. katmanlarda kısa "kontrol sisteme devredildi" sinematiği çalışır.
  Bu sırada imleç kendiliğinden hareket eder ve metin yazılır; `T` ile kesebilirsin.
- 07. katmanda `GHOST_*.ghost` dosyalarını kendi dosya gezgininle silmelisin.
- Her katmanın farklı bir düşman varyantı ve çevresel tehdidi vardır. Tehdit
  göstergesi HUD'da ve haritada canlı olarak görünür.

### Harita

`TAB` ile açılan şematik harita dolaştığın odaları açar. Keşfedilmemiş alanlar
karanlık kalır; canlı düşmanlar kırmızı, yöneticiler pembe, çıkışlar yeşil
noktalarla işaretlenir. Harita açıkken oyun ağır çekime alınır.

### Kamera

`V` ile 3. şahsa geçebilirsin. Kamera duvara sıkıştığında karakter gövdesi
otomatik olarak saydamlaşır; böylece dar Backrooms koridorlarında görüş kapanmaz.

## Kök dosya, kalıcı kapanma ve kurtarma dosyası

15. katmanın finalinde `root_anomaly.bin` oluşturulur. Bu dosyayı **kendin**
dosya gezgininden silmelisin. Oyun dosyanın silinmesini bekler; silinene kadar
nag mesajları, bildirimler ve harici pencereler devam eder.

Dosya konumu:

- Kaynak ağacından çalışırken: proje kökü (`./root_anomaly.bin`)
- Paketlenmiş AppImage ile çalışırken:
  `~/.config/limbo-sistem-anomalisi/root_anomaly.bin`
- Paketlenmiş Windows sürümüyle çalışırken:
  `%APPDATA%\limbo-sistem-anomalisi\root_anomaly.bin`

Oyun final ekranında bu yolun tamamını gösterir. Dosya silindiği anda oturum
kalıcı olarak kapatılır ve normal şekilde yeniden başlatma engellenir.

### Sıfırlama dosyası (`SIFIRLA.txt`)

Kalıcı kapanmadan sonra oyunu geri yüklemek için oyunun kök klasöründeki
görünür `SIFIRLA.txt` dosyasını aç. Dosyadaki `# LIMBO_RESET_0x0009` satırının
başındaki `# ` işaretini sil ve dosyayı kaydet. Etkin satır
`LIMBO_RESET_0x0009` olmalı.

Dosya konumu:

- Kaynak ağacından çalışırken: proje kökü (`./SIFIRLA.txt`)
- Paketlenmiş AppImage ile çalışırken:
  `~/.config/limbo-sistem-anomalisi/SIFIRLA.txt`
- Paketlenmiş Windows sürümüyle çalışırken:
  `%APPDATA%\limbo-sistem-anomalisi\SIFIRLA.txt`

Final ekranındaki **SIFIRLA.TXT KONUMUNU AÇ** düğmesi dosyayı dosya
yöneticisinde gösterir. Kapanma ekranı açıkken satır her ~1.3 saniyede kontrol
edilir; oyun kapalıyken bir sonraki açılışta otomatik uygulanır. Sıfırlama;
kapanma işaretini, kullanılan `SIFIRLA.txt`/token dosyasını, kök dosyayı ve
oyunun bıraktığı `.limbo_*` masaüstü dosyalarını temizler. İşlemden sonra `SIFIRLA.txt` yeniden oluşturulur
ve etkin satır tekrar yorumlanır.

Aranan klasörler: oyun/AppImage klasörü, kullanıcı veri klasörü
(`~/.config/limbo-sistem-anomalisi` veya Windows'ta
`%APPDATA%\limbo-sistem-anomalisi`), `LIMBO_SANDBOX`, ev dizini, Masaüstü,
Belgeler ve İndirilenler. Eski `.limbo_reset.token` dosyası geriye dönük uyumluluk
için hâlâ okunur.

## Meta etkiler ve güvenlik

Ayarlar menüsündeki **Meta Etkiler** bölümü:

| Ayar | Varsayılan | Etki |
| --- | --- | --- |
| Sinematik ele geçirme | Açık | 3/8/15. katmanlarda imleç/yazı sinematiği |
| Masaüstü dosya sızıntısı | Kapalı | Masaüstü/Belgeler'e en fazla 6 gizli `.limbo_*` dosyası bırakır |
| Duvar kağıdı anomalisi | Kapalı | GNOME'da ekran görüntüsünü geçici duvar kağıdı yapar; sonra geri yükler |

Güvenlik sınırları:

- Oynanış dosya işlemleri yalnızca `LIMBO_SANDBOX` içinde çalışır. `..`,
  mutlak yollar ve sembolik bağlantılar reddedilir.
- Masaüstü/Belgeler işlemleri yalnızca `.limbo_*` desenli, izlenen dosyaları
  oluşturur ve siler. Manifest `limbo_meta/spill-manifest.json` içindedir.
- Duvar kağıdı değişikliği öncesi orijinal ayarlar yedeklenir; zamanlayıcı,
  uygulama kapanışı veya bir sonraki açılışta geri yüklenir.
- Sistem klasörlerine, kayıt defterine veya oyun dışı kullanıcı dosyalarına
  yazılmaz.

## Paketleme

### Windows

Kurulum sihirbazı + taşınabilir sürüm:

```bat
build-win.bat
```

Çıktılar:

- `dist\LIMBO-Sistem-Anomalisi-Setup-1.0.0.exe`
- `dist\LIMBO-Sistem-Anomalisi-1.0.0-portable.exe`

### Linux

Tek dosyalık AppImage üretmek için:

```bash
./build-single.sh
```

Çıktı: `dist/LIMBO-Sistem-Anomalisi-1.0.0.AppImage`.

`build-single.sh`, yerel `node_modules/.bin/electron-builder` aracını kullanır;
yoksa sistemdeki `electron-builder` veya geliştirme komşu araç zincirini dener.
Gerekli paketler:

```bash
npm install --save-dev electron@33.4.11 electron-builder
```

Build; `main.js`, `preload.js`, popup/terminal dosyaları, `css/`, `js/`, `assets/`,
`README.md` ve `SIFIRLA.txt` şablonunu paketler. `.tools/`, `node_modules/`,
`LIMBO_SANDBOX/`, test çıktıları, `root_anomaly.bin` ve `.limbo_reset.token`
pakete **dahil edilmez**. Etkin `SIFIRLA.txt` çalışma zamanında kullanıcı veri
klasöründe oluşturulur.

## Geliştirme

Sözdizimi kontrolü:

```bash
./.tools/node/bin/node --check main.js
./.tools/node/bin/node --check preload.js
./.tools/node/bin/node --check popup-preload.js
for f in js/*.js; do ./.tools/node/bin/node --check "$f"; done
```

Windows'ta aynı kontrol:

```bat
for %f in (main.js preload.js popup-preload.js js\*.js) do @node --check "%f"
```

Hata ayıklama bayrakları (yalnızca geliştirme):

```bash
# Normal açılış, ancak window.LIMBO_DEBUG kullanılabilir
./.tools/electron/electron . --no-sandbox --dev

# Belirli bir katmanı aç
./.tools/electron/electron . --no-sandbox --level=4

# Ekran görüntüsü al ve kapat
./.tools/electron/electron . --no-sandbox --level=12 \
  --shot=limbo.png --wait=2600

# Tarayıcı konsolunda ifade çalıştır (dev modunda)
./.tools/electron/electron . --no-sandbox --level=1 \
  --call='window.LIMBO_DEBUG.state.player.hp'
```

Windows'ta `start.bat` aynı bayrakları kabul eder:

```bat
start.bat --dev
start.bat --level=4
start.bat --shot=limbo.png --wait=2600
```

`window.LIMBO_DEBUG` yalnızca `?dev=1` / `--dev` / `--level` / `--shot` /
`--call` ile yüklenir. Metotlar: `start`, `menu`, `killAll`, `warp`, `complete`,
`die`, `finale`, `keypad`, `qte`, `freeze`, `cursor`, `map`, `camera`,
`takeover`, `hazard`, `kernel`, `gpu`, `spill`, `wallpaper`, `user`, `hitboxes`,
`meta`, `state`.

## Teknik notlar

- Çözünürlük: dahili `480x270` Canvas 2D raycaster, sahne ölçeğinde büyütülür.
- Tüm dokular, sprite'lar, müzik ve ses efektleri prosedürel olarak üretilir.
  Sürekli fan/disk/statik donanım katmanı ve katman başına müzik stili vardır.
- Yazı tipi yerel `assets/fonts/vt323-*.woff2` dosyalarından gelir; internet
  gerekmez.
- Kayıtlar `limbo_progress_v3`, ayarlar `limbo_settings_v3` anahtarlarında
  saklanır. Eski `limbo_final_v1` anahtarı temizlenir ve artık kullanılmaz.
- Kalıcı kapanma işareti: `limbo_meta/terminated.json` (userData altında).
- Sıfırlama yardımcısı: kaynak ağacında `./SIFIRLA.txt`; paketlenmiş sürümde
  `userData/SIFIRLA.txt`.
- Kaynak ağacında sandbox: `./LIMBO_SANDBOX`; paketlenmiş sürümde
  `userData/LIMBO_SANDBOX`.
- Kök dosya: kaynak ağacında `./root_anomaly.bin`; paketlenmiş sürümde
  `userData/root_anomaly.bin`.

## Geliştirme sırasında sıfırlama

15. katmanın finali kalıcıdır. Test sırasında `SIFIRLA.txt` kullanmadan
sıfırlamak için uygulamayı kapatıp kullanıcı verisini temizleyebilirsin:

```bash
rm -rf ~/.config/limbo-sistem-anomalisi
```

Bu işlem kayıtları, ayarları, sandbox'ı ve kalıcı kapanma durumunu da siler.
Oyun içinden sıfırlamak için `SIFIRLA.txt` dosyasındaki etkin satırı kullan.
