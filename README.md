# Görev Defteri

Europa Universalis IV havasında, kişisel bir Android yapılacaklar uygulaması.

- Ana ekran içinde bulunulan haftayı gösterir: pazartesiden pazara 7 gün alt alta, her günün altında o günün görevleri. Yana kaydırınca önceki ve sonraki haftalara geçilir.
- Görev bitince tiklenir ve üstü çizilir. Yapılmayan geçmiş görevler kırmızıyla "Gecikti" olarak işaretlenir. Basılı tutulan görev "Başarısız" olur; bunlar yalnızca o gün yapılabilen görevler içindir.
- **Ferman:** seçilen günlere 1–2 hafta ya da 1–3 ay boyunca tekrarlayan görev ekler.
- Her sabah 09:00'da o günün görevleriyle sessiz bir özet bildirimi gelir. Saatli görevler için 30 dakika önce sesli ve titreşimli hatırlatma gelir.
- Veriler Google girişiyle Firebase'e (Firestore) yedeklenir ve çevrimdışı da çalışır.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `mobile/` | Uygulama: Expo SDK 58, React Native, TypeScript, Expo Router |
| `designs/` | Tasarım aşamasındaki HTML denemeleri; seçilen tasarım `final.html` |
| `sounds-lab/` | Arayüz seslerini sıfırdan üreten betik (`synth.py`) ve dinleme sayfası |
| `icon-lab/` | Uygulama ikonu denemeleri |

## Çalıştırma

```bash
cd mobile
npm install
npx expo start        # geliştirme
npx jest              # testler
npx tsc --noEmit      # tip kontrolü
```

APK EAS Build ile alınır (`npx eas-cli build --profile preview --platform android`). Kod değişiklikleri telefona EAS Update ile gönderilir.

## Depoda olmayan dosyalar

Bu dosyalar bilerek depoya konmadı. Projeyi kendin derleyeceksen kendi dosyalarını şu yollara koymalısın:

- **`mobile/google-services.json`:** kendi Firebase projenin ayar dosyası. Nasıl alınacağı `mobile/docs/FIREBASE_KURULUM.md` dosyasında anlatılıyor. Güvenlik kuralları `mobile/firestore.rules` dosyasında.
- **`mobile/assets/sounds/done.mp3`, `ferman.mp3`, `hatirlatma.mp3`:** sırasıyla görev bitince, ferman ilan edilince ve hatırlatma bildiriminde çalan sesler. Bunlar bu projede üretilmedi, o yüzden paylaşılmıyor. Kısa herhangi bir ses dosyası olabilir.

`mobile/.easignore`, bu dosyaların git'te olmasa da EAS derlemesine gönderilmesini sağlar.

Diğer arayüz sesleri (`*.wav`) `sounds-lab/synth.py` ile sıfırdan sentezlendi.
