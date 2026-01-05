Tabii! Aşağıda, mevcut Node.js tabanlı sosyal medya projeniz için Flutter ile bir frontend (mobil uygulama) geliştirmek isteyen bir ekip veya geliştiriciye yönelik **kapsamlı bir dökümantasyon** bulacaksınız. Bu dökümantasyon, hem genel mimariyi hem de Flutter tarafında yapılması gerekenleri, API entegrasyonunu, önerilen ekranları ve dikkat edilmesi gereken noktaları içerir.

---

# Flutter Frontend Geliştirme Dökümantasyonu

## 1. Proje Hakkında Genel Bilgi

Bu proje, motorcu topluluğu için geliştirilmiş bir sosyal medya platformudur. Backend Node.js/Express, MongoDB ve Socket.IO ile yazılmıştır. Kullanıcılar; profil oluşturabilir, gönderi ve hikaye paylaşabilir, grup sohbetlerine katılabilir, rota ve etkinlik paylaşabilir, gerçek zamanlı bildirim ve mesajlaşma alabilirler.

## 2. Flutter Frontend Hedefleri

- Modern, hızlı ve kullanıcı dostu bir mobil uygulama
- Tüm temel sosyal medya fonksiyonlarının mobilde erişilebilir olması
- Gerçek zamanlı bildirimler ve sohbet (Socket.IO ile)
- Google Maps entegrasyonu (rota, konum paylaşımı, yakındaki yerler)
- Güvenli kimlik doğrulama ve oturum yönetimi (JWT)
- Dosya yükleme (fotoğraf, profil resmi, hikaye, vb.)

---

## 3. Temel Ekranlar ve Akışlar

### 3.1. Giriş/Kayıt Akışı
- **Giriş:** E-posta/şifre ile JWT token alınır.
- **Kayıt:** Kullanıcı adı, e-posta, şifre, profil bilgileri.
- **Şifre Sıfırlama:** (Varsa) e-posta ile sıfırlama.

### 3.2. Ana Akış (Feed)
- Gönderi listesi (paylaşımlar, fotoğraflar, beğeniler, yorumlar)
- Hikayeler (story) üstte yatay kaydırmalı
- Yeni gönderi oluşturma (fotoğraf/video yükleme, açıklama, etiket)

### 3.3. Profil
- Kendi profilini ve başkalarının profilini görüntüleme
- Profil düzenleme (fotoğraf, biyografi, motosiklet bilgileri)
- Takipçi/takip edilen listesi

### 3.4. Grup Sohbetleri
- Grup sohbetleri listesi
- Yeni grup oluşturma, gruba katılma/ayrılma
- Mesajlaşma (metin, konum, fotoğraf)
- Gerçek zamanlı mesajlaşma (Socket.IO)

### 3.5. Bildirimler
- Gerçek zamanlı ve geçmiş bildirimler
- Bildirim okundu/okunmadı durumu

### 3.6. Rotalar ve Etkinlikler
- Rota paylaşımı, rota detayları (Google Maps ile)
- Etkinlik oluşturma, katılma, detaylar

### 3.7. Harita ve Konum
- Google Maps ile rota görüntüleme
- Konum paylaşımı (sohbet içinde ve profil)
- Yakındaki yerler (benzinlik, kafe, servis vb.)

---

## 4. API Entegrasyonu

### 4.1. Kimlik Doğrulama
- **POST /api/auth/login** → JWT token al
- **POST /api/auth/register** → Yeni kullanıcı oluştur
- **Header:** `Authorization: Bearer <token>`

### 4.2. Kullanıcı İşlemleri
- **GET /api/users/me** → Kendi profilini getir
- **PUT /api/users/:id** → Profil güncelle
- **GET /api/users/:id** → Başka kullanıcı profili
- **POST /api/users/:id/follow** / **DELETE** → Takip/Çıkar

### 4.3. Gönderiler
- **GET /api/posts** → Gönderi listesi
- **POST /api/posts** → Yeni gönderi (multipart/form-data)
- **PUT /api/posts/:id** / **DELETE** → Güncelle/Sil
- **POST /api/posts/:id/like** → Beğen
- **POST /api/posts/:id/comment** → Yorum yap

### 4.4. Hikayeler
- **GET /api/stories** → Hikaye listesi
- **POST /api/stories** → Yeni hikaye

### 4.5. Grup Sohbetleri
- **GET /api/group-chats** → Grup listesi
- **POST /api/group-chats** → Grup oluştur
- **GET /api/group-chats/:id/messages** → Mesajlar
- **POST /api/group-chats/:id/messages** → Mesaj gönder

### 4.6. Bildirimler
- **GET /api/notifications** → Bildirim listesi
- **PUT /api/notifications/:id/read** → Okundu işaretle

### 4.7. Rota ve Etkinlikler
- **GET /api/routes** / **POST /api/routes**
- **GET /api/events** / **POST /api/events**

### 4.8. Google Maps Servisleri
- **/api/maps/geocode** → Adresten koordinat
- **/api/maps/reverse-geocode** → Koordinattan adres
- **/api/maps/directions** → Rota
- **/api/maps/nearby** → Yakındaki yerler

### 4.9. Gerçek Zamanlı (Socket.IO)
- **Bağlantı:** `ws://<backend-url>`
- **Kimlik Doğrulama:** Bağlantı sırasında JWT token gönder
- **Olaylar:** `joinGroup`, `leaveGroup`, `typing`, `shareLocation`, `userJoined`, `userLeft`, `locationShared`, `userDisconnected`

---

## 5. Flutter'da Kullanılacak Temel Paketler

- `dio` veya `http` (REST API için)
- `provider`, `riverpod` veya `bloc` (durum yönetimi)
- `socket_io_client` (gerçek zamanlı mesajlaşma)
- `google_maps_flutter` (harita)
- `image_picker` (fotoğraf yükleme)
- `jwt_decode` (token işlemleri)
- `shared_preferences` (yerel oturum saklama)
- `flutter_secure_storage` (güvenli token saklama)
- `file_picker` (dosya seçimi)
- `flutter_local_notifications` (bildirimler)

---

## 6. Flutter Proje Mimarisi (Öneri)

- **lib/**
  - **models/**: API modelleri (User, Post, GroupChat, Notification, vb.)
  - **services/**: API servisleri (auth_service, post_service, chat_service, maps_service, vb.)
  - **providers/**: Durum yönetimi (Provider/Bloc)
  - **screens/**: Ekranlar (login, register, feed, profile, chat, map, vb.)
  - **widgets/**: Tekrar kullanılabilir widgetlar
  - **utils/**: Yardımcı fonksiyonlar, sabitler
  - **main.dart**: Giriş noktası

---

## 7. Dikkat Edilmesi Gerekenler

- **JWT Token Yönetimi:** Token'ı güvenli saklayın, süresi dolduğunda otomatik logout yapın.
- **Socket.IO Bağlantısı:** Bağlantı sırasında token gönderin, bağlantı koparsa tekrar bağlanmayı yönetin.
- **Hata Yönetimi:** API ve socket hatalarını kullanıcıya uygun şekilde gösterin.
- **Çoklu Platform:** iOS ve Android için test edin, harita ve bildirim izinlerini unutmayın.
- **Dosya Yükleme:** Fotoğraf/video yüklerken multipart/form-data kullanın.
- **Gerçek Zamanlı Bildirim:** Hem push notification hem de socket ile bildirim desteği ekleyin.
- **Google Maps API Key:** Mobilde harita için ayrı bir API anahtarı gerekebilir.

---

## 8. Geliştirme ve Test

- **Backend ile Entegrasyon:** Geliştirme sırasında backend local veya test sunucusunda çalışmalı.
- **Mock Data:** Backend hazır değilse mock servisler ile geliştirme yapılabilir.
- **Test Kullanıcıları:** Test için örnek kullanıcılar ve JWT tokenlar oluşturun.
- **CI/CD:** Otomatik test ve build süreçleri için Github Actions veya benzeri araçlar kullanılabilir.

---

## 9. Örnek Akış: Giriş ve Ana Akış

1. **Kullanıcı giriş ekranında e-posta/şifre girer.**
2. **POST /api/auth/login** ile token alınır, güvenli şekilde saklanır.
3. **Ana akış ekranında:**  
   - **GET /api/posts** ile gönderiler çekilir.
   - **GET /api/stories** ile hikayeler çekilir.
   - **Socket.IO ile bağlantı kurulur, bildirimler ve mesajlar gerçek zamanlı alınır.**
4. **Kullanıcı yeni gönderi eklerse:**  
   - Fotoğraf seçilir, açıklama girilir.
   - **POST /api/posts** ile gönderi yüklenir.
5. **Bir gruba girilirse:**  
   - **joinGroup** olayı ile socket üzerinden gruba katılım sağlanır.
   - Mesajlar ve konumlar gerçek zamanlı alınır/gönderilir.

---

## 10. Sonuç

Bu dökümantasyon, Flutter ile mobil frontend geliştirmek isteyen ekip için yol haritası ve entegrasyon rehberidir.  
Her API endpoint'i, socket olayı ve ekran için örnekler ve açıklamalar eklenebilir.  
Geliştirme sırasında backend ile sürekli iletişimde olunmalı, API dökümantasyonu ve test ortamı güncel tutulmalıdır.

---

**Ekstra:**  
Dilerseniz, örnek Flutter kodları, ekran tasarımları veya belirli bir ekran için detaylı akış da hazırlayabilirim.  
Herhangi bir ekran veya özellik için daha fazla detay isterseniz belirtmeniz yeterli!
