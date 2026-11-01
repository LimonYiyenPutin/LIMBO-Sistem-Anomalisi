# LIMBO – Müzik Kataloğu

Bu klasör, oyunun dosya tabanlı müzik katmanını ve lisans kayıtlarını içerir.
Tüm parçalar **Nihonichi Free BGM** kütüphanesinden indirilmiştir.

## Lisans

- **Kaynak:** Nihonichi Free BGM — https://nihonichi-bgm.com/
- **Lisans:** Nihonichi Free BGM Commercial Use License
- **Lisans metni:** https://nihonichi-bgm.com/en/commercial-music-license/
- **Doğrulama tarihi:** 2026-11-01
- **Özet:** Ticari projelerde, oyunlarda ve uygulamalarda ücretsiz kullanım; kayıt
  gerekmez; atıf zorunlu değildir. Ses dosyalarının tek başına yeniden dağıtımı
  veya satışı yasaktır. Parçalar AI tarafından üretilmiştir.
- **Önerilen (zorunlu olmayan) atıf:** `Music: Nihonichi Free BGM`

Bu oyundaki MP3 dosyaları oyunun bir parçası olarak paketlenmiştir. Oyunun
kurulumundan çıkarılıp ayrı bir müzik arşivi olarak dağıtılmamalıdır.

## Kategoriler ve parçalar

| Kategori | Parça | Süre | BPM | Dosya |
|---|---|---:|---:|---|
| Main Menu | The Empty Corridor | 2:30 | – | `menu/the-empty-corridor.mp3` |
| Main Menu | Before the Last Door | 2:30 | – | `menu/before-the-last-door.mp3` |
| Exploration | Broken Hallway | 2:15 | 62 | `exploration/broken-hallway.mp3` |
| Exploration | Moth Hall | 2:48 | 64 | `exploration/moth-hall.mp3` |
| Exploration | No Way Back | 2:00 | – | `exploration/no-way-back.mp3` |
| Facility | Haunted Glass Hall | 2:43 | 118 | `facility/haunted-glass-hall.mp3` |
| Facility | Glass House Pulse | 2:14 | 62 | `facility/glass-house-pulse.mp3` |
| Mystery | Basement Door | 2:24 | 60 | `mystery/basement-door.mp3` |
| Mystery | Haunted Hallway Tape | 2:29 | 107 | `mystery/haunted-hallway-tape.mp3` |
| Suspense | Footsteps Approaching | 2:48 | – | `suspense/footsteps-approaching.mp3` |
| Suspense | Sensing Something Behind You | 3:13 | – | `suspense/sensing-something-behind-you.mp3` |
| Suspense | Cornered with No Way Out | 3:24 | – | `suspense/cornered-with-no-way-out.mp3` |
| Chase | Run and Don't Look Back | 1:05 | – | `chase/run-and-dont-look-back.mp3` |
| Chase | The Footsteps Behind | 1:28 | – | `chase/the-footsteps-behind.mp3` |
| Chase | Clip Run | 2:17 | 142 | `chase/clip-run.mp3` |
| Timed Puzzle | Koto Circuit | 2:42 | 136 | `timed/koto-circuit.mp3` |
| Timed Puzzle | Neon Afterimage | 3:04 | 127 | `timed/neon-afterimage.mp3` |
| Boss / Major Event | Scarlet Dominion | 3:00 | 148 | `boss/scarlet-dominion.mp3` |
| Boss / Major Event | Voidbreaker | 2:07 | 150 | `boss/voidbreaker.mp3` |
| Boss / Major Event | Ashfall Tyrant | 2:39 | 152 | `boss/ashfall-tyrant.mp3` |
| Ending / Credits | First Light Promise | 1:59 | 76 | `ending/first-light-promise.mp3` |
| Ending / Credits | Last Goodbye | 2:35 | 67 | `ending/last-goodbye.mp3` |

Toplam: **22 parça**, yaklaşık **73 MB**.

## Manifest

`manifest.json` her parça için şunları içerir:

- dosya yolu ve boyutu
- SHA-256 özeti
- parça adı (İngilizce ve orijinal Japonca)
- kaynak sayfası ve doğrudan indirme URL'si
- sanatçı/kaynak ve lisans
- indirme tarihi
- süre, BPM, etiketler ve enstrümantal bilgisi

Yeni bir parça eklenirken `manifest.json` güncellenmeli ve dosyanın gerçekten
indirildiği doğrulanmalıdır. Lisansı belirsiz dosyalar kataloğa eklenmemelidir.

## Teknik notlar

- Müzik dosyaları `js/audio.js` içindeki çift `HTMLAudioElement` katmanıyla
  çalınır. Kategori geçişleri ve parça değişimleri çapraz soluklaşma ile yapılır.
- Aynı anda yalnızca bir ana müzik aktif olur; geçiş sırasında iki katman kısa
  süre birlikte duyulur, geçiş bitince eski katman durdurulur.
- Oyun duraklatıldığında müzik kısa bir fade ile durdurulur ve kaldığı yerden
  devam eder. Ana ses, müzik, ortam ve efekt seviyeleri ayrıdır.
- Prosedürel ses motoru SFX ve ortam katmanı için korunmuştur. Dosya müziği
  aktifken prosedürel ana müzik devre dışı bırakılır.
