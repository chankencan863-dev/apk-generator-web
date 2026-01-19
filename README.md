# APK Generator Web

Aplikasi berbasis web untuk mengonversi website atau file HTML menjadi aplikasi Android APK.

## Fitur Utama

- **Konversi Website ke APK**: Ubah URL website menjadi aplikasi Android
- **File Assets ke APK**: Unggah file HTML, CSS, JS untuk dibuatkan APK
- **Kustomisasi Lengkap**:
  - Package name (com.nama.aplikasi)
  - Nama aplikasi
  - Izin Android (permissions)
  - Versi aplikasi
  - Icon aplikasi
- **Generate Instan**: Proses generate hanya beberapa menit
- **Download Langsung**: Download APK hasil generate

## Persyaratan Sistem

1. **Server**:
   - Node.js 14+
   - Git
   - Java JDK 11+ (untuk build APK)
   - Android SDK (optional, jika ingin build lebih lengkap)

2. **Client**:
   - Browser modern (Chrome, Firefox, Edge)
   - Koneksi internet untuk generate dari URL

## Instalasi

### 1. Clone Repository
```bash
git clone https://github.com/username/apk-generator-web.git
cd apk-generator-web
