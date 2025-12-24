# 🌐 QoS Odaklı Akıllı Rotalama ve 3D Web Simülasyonu (BSM307)

![React](https://img.shields.io/badge/Frontend-React-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?style=flat&logo=typescript)
![Three.js](https://img.shields.io/badge/3D-Three.js-white?style=flat&logo=three.js)
![Vite](https://img.shields.io/badge/Build-Vite-purple?style=flat&logo=vite)
![Status](https://img.shields.io/badge/Status-Active-success)

**Ders:** BSM307 - Bilgisayar Ağları (Güz 2025)  
**Proje Konusu:** QoS Odaklı Çok Amaçlı Rotalama için Meta-Sezgisel ve Pekiştirmeli Öğrenme Yaklaşımları

---

## 📖 1. Proje Özeti
Bu proje, modern ağlarda (Cloud/Data Center) karşılaşılan **Rotalama (Routing)** problemini çözmek için geliştirilmiş, **React ve Three.js** tabanlı etkileşimli bir simülasyondur.

Üç boyutlu bir dünya haritası üzerinde görselleştirilen 250+ düğümlü karmaşık ağ yapısında, veriyi **A noktasından B noktasına** götürecek en optimum yolu bulur. Klasik algoritmaların (Dijkstra gibi) yetersiz kalabildiği çok değişkenli (Gecikme, Güvenilirlik, Maliyet) senaryolarda, 4 farklı yapay zeka algoritmasını yarıştırır.

### � Temel Özellikler
*   **🌍 3D İnteraktif Görselleştirme:** Dünya küresi üzerinde düğümler, bağlantılar ve aktif rotayı "X-Ray" teknolojisiyle (dünyanın arkasından bile) görüntüleme.
*   **⚡ Gerçek Zamanlı Simülasyon:** Algoritmaların çalışma süreçlerini ve sonuçlarını anlık izleme.
*   **� Detaylı Analiz Modülü:** Başarı oranı, ortalama maliyet, çalışma süresi gibi metriklerle algoritmaları kıyaslayan "Deney Yürütücü".
*   **�️ Esnek Ayarlar:** Gecikme, güvenilirlik ve maliyet ağırlıklarını (QoS) kaydırıcılarla dinamik olarak değiştirme.

---

## 🧠 2. Kullanılan Yapay Zeka Algoritmaları
Proje kapsamında, problemin çözümü için **4 farklı modern yaklaşım** TypeScript ile sıfırdan implemente edilmiştir:

| Algoritma | Tür | Açıklama |
|-----------|-----|----------|
| **🐜 Karınca Kolonisi (ACO)** | Meta-Sezgisel | Doğadaki karıncaların feromon izi bırakarak en kısa yolu bulma davranışını simüle eder. |
| **🐝 Yapay Arı Kolonisi (ABC)** | Meta-Sezgisel | Arıların nektar kaynaklarını (yolları) arama, dans ile haberleşme ve keşfetme zekasını kullanır. |
| **🧬 Genetik Algoritma (GA)** | Meta-Sezgisel | Evrim teorisindeki "Doğal Seçilim", "Çaprazlama" ve "Mutasyon" yöntemleriyle en iyi rotayı nesiller içinde geliştirir. |
| **🤖 Q-Learning (RL)** | Pekiştirmeli Öğrenme | Bir ajanın çevreyle etkileşime girerek (deneme-yanılma) ödül/ceza mekanizmasıyla doğru yolu öğrenmesini sağlar. |

---

## ⚙️ 3. Teknik Mimari
Proje, tamamen modern web teknolojileri kullanılarak geliştirilmiştir.

### Teknoloji Yığını
*   **Dil:** TypeScript (Tip güvenliği için)
*   **Framework:** React 18
*   **Derleyici:** Vite (Hızlı geliştirme için)
*   **Görselleştirme:** `react-force-graph-3d` (Three.js tabanlı)
*   **Grafikler:** Recharts (İstatistiksel analiz için)
*   **Stil:** TailwindCSS, Glassmorphism UI

### Matematiksel Maliyet Fonksiyonu (QoS)
Bir yolun toplam maliyeti ($TotalCost$), aşağıdaki ağırlıklı toplam formülü ile hesaplanır:

$$Skor = (W_{1} \times Gecikme) + (W_{2} \times GüvenilirlikMaliyeti) + (W_{3} \times KaynakMaliyeti)$$

* **Güvenilirlik:** `-log(Reliability)` dönüşümü ile toplamsal hale getirilir.
* **Kaynak:** `1 / Bant Genişliği` etkisi ile darboğazlar cezalandırılır.

### Dosya Yapısı (`project/src`)
```text
/src
  ├── components/
  │     ├── DunyaHaritasi.tsx  # 3D Dünya ve Ağ Görselleştirmesi
  │     └── DeneyYurutucu.tsx  # Test ve İstatistik Modülü
  ├── services/
  │     ├── algoritmalar.ts    # GA, ACO, ABC, Q-Learning Mantığı
  │     └── api.ts             # Backend Bağlantısı (Opsiyonel)
  ├── tipler.ts                # TypeScript Arayüzleri (Interface)
  └── App.tsx                  # Ana Uygulama ve UI Yönetimi
```

---

## 🚀 4. Kurulum ve Çalıştırma

Projeyi yerel makinenizde çalıştırmak için Node.js yüklü olmalıdır.

1.  **Depoyu Klonlayın:**
    ```bash
    git clone https://github.com/NyancatGo/BSM307_Proje.git
    cd BSM307_Proje
    ```

2.  **Proje Klasörüne Girin:**
    ```bash
    cd project
    ```

3.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

4.  **Uygulamayı Başlatın:**
    ```bash
    npm run dev
    ```
    Tarayıcınızda `http://localhost:5173` adresine giderek uygulamayı kullanabilirsiniz.

---

## 📅 Takvim ve Durum
* **Geliştirme:** Tamamlandı ✅
* **Testler:** Tamamlandı ✅
* **Dokümantasyon:** Güncel

---
*BSM307 Güz Dönemi Projesi*
