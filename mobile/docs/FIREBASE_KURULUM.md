# Firebase kurulumu (Görev Defteri)

Amaç: görevlerin Google hesabına bağlı olarak buluta yedeklenmesi. Telefon kaybolsa da yeni telefonda aynı hesapla girince görevler geri gelir. İnternet yokken de uygulama çalışır, bağlantı gelince eşitler.

Bu adımları **bir kez** yapman yeterli. Toplam süre ~20 dakika.

---

## 1. Firebase projesi oluştur

1. https://console.firebase.google.com adresine Google hesabınla gir.
2. **Proje oluştur** (Create a project) → bir ad ver (ör. `gorev-defteri`).
3. **Google Analytics** sorulduğunda kapatabilirsin → **Proje oluştur**.

## 2. Google ile girişi aç

1. Sol menü → **Build → Authentication** → **Get started**.
2. **Sign-in method** sekmesi → **Google** → **Enable** (Etkinleştir).
3. **Project support email** alanında kendi e-postanı seç → **Save**.

## 3. Firestore veritabanını oluştur

1. Sol menü → **Build → Firestore Database** → **Create database**.
2. Konum (location) olarak bir **Avrupa** konumu seç (ör. `eur3 (europe)` veya `europe-west3 (Frankfurt)`). **Bu sonradan değiştirilemez.**
3. **Start in production mode** seç → **Create**.
4. Üstteki **Rules** sekmesine geç. Oradaki metnin **tamamını sil**, projedeki `mobile/firestore.rules` dosyasının **tamamını** yapıştır → **Publish**.

## 4. Android uygulamasını ekle ve google-services.json indir

1. Sol üstte ⚙️ → **Project settings** → **General** sekmesi → aşağıda **Your apps** → Android simgesi.
2. **Android package name**: `com.gorevdefteri.app` (birebir aynı yaz).
3. App nickname boş kalabilir. SHA-1 alanını şimdilik boş bırak (6. adımda ekleyeceğiz) → **Register app**.
4. **google-services.json** dosyasını indir ve `mobile/` klasörüne koy (`app.json` ile aynı yere). Dosya adı tam olarak `google-services.json` olmalı.
5. Kalan "SDK ekle" adımlarını **Next / Continue to console** ile geç (bunlar zaten yapıldı).

## 5. Web client ID'yi app.json'a yaz

1. **Authentication → Sign-in method → Google** satırına tıkla.
2. **Web SDK configuration** bölümünü aç → **Web client ID** değerini kopyala (`...apps.googleusercontent.com` ile biter).
3. `mobile/app.json` dosyasında şu satırı bul ve değeri yapıştır:
   ```json
   "extra": {
     "googleWebClientId": "BURAYA_KOPYALADIGIN_ID.apps.googleusercontent.com"
   }
   ```

## 6. SHA-1 / SHA-256 parmak izlerini ekle (Google girişi için zorunlu)

Bu adım yapılmazsa uygulamada *"Google girişi ayarlı değil: … SHA-1 …"* hatası çıkar.

1. `mobile` klasöründe bir terminal aç:
   ```
   npx eas-cli login
   npx eas-cli credentials
   ```
2. Sırasıyla seç: **Android** → build profili (**preview**; geliştirme sürümü de kullanıyorsan sonra **development** için de tekrarla) → **Keystore**.
   - Henüz keystore yoksa **Set up a new keystore** seç; EAS kendisi oluşturur. (İlk `eas build` sırasında da otomatik oluşur.)
3. Ekranda yazan **SHA1 Fingerprint** ve **SHA256 Fingerprint** değerlerini kopyala.
4. Firebase → ⚙️ **Project settings** → **General** → **Your apps** → Android uygulaman → **Add fingerprint** → SHA-1'i yapıştır → **Save**. Aynısını SHA-256 için tekrarla.
   - development ve preview farklı parmak izi gösterirse **hepsini** ekle.
5. Aynı sayfadan **google-services.json**'ı **yeniden indir** ve `mobile/` klasöründeki eskisinin üzerine kaydet.

## 7. Uygulamayı yeniden derle

`google-services.json` veya `app.json` değiştiğinde OTA güncelleme yetmez, yeni bir derleme gerekir:

```
npx eas-cli build --profile preview --platform android
```

Derleme bitince APK'yı telefona kur, **Google ile giriş yap**'a dokun.

---

## Kontrol listesi

- [ ] Authentication → Google **Enabled**
- [ ] Firestore oluşturuldu (Avrupa konumu), **Rules** yapıştırılıp **Publish** edildi
- [ ] Android uygulaması paket adı `com.gorevdefteri.app`
- [ ] SHA-1 **ve** SHA-256 eklendi
- [ ] Parmak izlerinden **sonra** indirilen `google-services.json` → `mobile/` klasöründe
- [ ] `app.json` → `extra.googleWebClientId` gerçek Web client ID
- [ ] Yeni EAS derlemesi kuruldu

## Sık görülen hatalar

| Uygulamadaki mesaj | Çözüm |
| --- | --- |
| "Google girişi ayarlı değil: … SHA-1 … web client ID …" | 5. ve 6. adımları kontrol et, google-services.json'ı yeniden indir, yeniden derle. |
| "İnternet bağlantısı yok" | İlk giriş için internet gerekir; sonrasında uygulama çevrimdışı da çalışır. |
| "Google Play Hizmetleri yok ya da güncel değil" | Telefonda Play Store'dan "Google Play Hizmetleri"ni güncelle. |
| Giriş oldu ama görevler kaydedilmiyor | Firestore **Rules** sekmesine `firestore.rules` içeriğinin yapıştırılıp **Publish** edildiğinden emin ol. |

> Uygulamayı ileride Google Play'e yüklersen: Play Console → **App integrity → App signing** sayfasındaki SHA-1 / SHA-256 değerlerini de Firebase'e eklemen gerekir.
