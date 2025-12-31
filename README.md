# 🌐 QoS Odaklı Akıllı Rotalama ve 3D Web Simülasyonu (BSM307)

<div align="center">

![React](https://img.shields.io/badge/Frontend-React_18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-blue?style=for-the-badge&logo=typescript)
![Three.js](https://img.shields.io/badge/3D_Engine-Three.js-white?style=for-the-badge&logo=three.js)
![Vite](https://img.shields.io/badge/Build-Vite-purple?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/Style-TailwindCSS-38bdf8?style=for-the-badge&logo=tailwindcss)
![Status](https://img.shields.io/badge/Project-COMPLETED-success?style=for-the-badge)

<br />

<h1>🚀 Yeni Nesil Ağ Simülasyonu ve Yapay Zeka Laboratuvarı</h1>

<p align="center">
  <strong>Modern Veri Merkezleri ve Uydu Ağları için QoS Tabanlı Rotalama Simülatörü</strong>
</p>

<p align="center">
  <a href="#-proje-hakkında">Proje Hakkında</a> •
  <a href="#-kurulum">Kurulum</a> •
  <a href="#-özellikler">Özellikler</a> •
  <a href="#-yapay-zeka-algoritmaları">Algoritmalar</a> •
  <a href="#-deney-laboratuvarı">Deney Laboratuvarı</a>
</p>

</div>

---

## 📖 Proje Hakkında

**BSM307 Bilgisayar Ağları** dersi kapsamında geliştirilen bu proje, geleneksel rotalama algoritmalarının (Dijkstra, Bellman-Ford) yetersiz kaldığı **çok kriterli (Multi-Objective)** optimizasyon problemlerine çözüm arar.

Proje, **250'den fazla düğüm** içeren kompleks bir ağ üzerinde; Gecikme, Güvenilirlik, Bant Genişliği ve Maliyet gibi çelişen hedefleri aynı anda optimize eden 4 farklı yapay zeka algoritmasını simüle eder ve sonuçları **3D Dünya Küresi** üzerinde görselleştirir.

> **Temel Farkımız:** Sadece "en kısa" yolu değil; "en güvenilir", "en hızlı" ve "en az maliyetli" yolu aynı anda bulabilen, ağırlıkları dinamik olarak değiştirilebilir hibrit bir yapı sunmasıdır.

---

## 💻 Özellikler

### 🌍 1. İleri Seviye 3D Görselleştirme
*   **X-Ray Modu:** Dünya küresinin arkasındaki düğümleri görebilme.
*   **Uydu Görünümü:** Gerçekçi dünya haritası üzerinde düğüm yerleşimi.
*   **Dinamik Etkileşim:** Düğümlere tıklayarak kaynak/hedef seçimi, rotayı anlık izleme.

### 🧠 2. Dört Farklı "Solver" Motoru
Aynı problem üzerinde 4 farklı yaklaşımı yarıştırın:
*   **Genetic Algorithm (GA)** - Evrimsel hesaplama.
*   **Ant Colony Optimization (ACO)** - Sürü zekası.
*   **Artificial Bee Colony (ABC)** - Kolektif zeka.
*   **Q-Learning (RL)** - Pekiştirmeli öğrenme (Reinforcement Learning).

### � 3. Bilimsel Deney Modülü (V2.0)
*   **Otomatik Stres Testi:** Rastgele üretilen binlerce senaryoyu arka arkaya çalıştırın.
*   **CSV Entegrasyonu:** `BSM307...DemandData.csv` dosyasındaki tanımlı senaryoları tek tıkla yükleyin.
*   **Seed (Tohum) Takibi:** Her deneyin tekrarlanabilir olması için kriptografik seed takibi.
*   **Excel/CSV Raporlama:** Min/Max Süre, Std. Sapma, Başarı Oranı ve Maliyet analizi içeren akademik çıktı.

---

## 🧠 Yapay Zeka Algoritmaları

Tüm algoritmalar **TypeScript** ile `src/services/algoritmalar.ts` altında sıfırdan implemente edilmiştir.

| Algoritma | Kategori | Nasıl Çalışır? |
|-----------|----------|----------------|
| **Karınca Kolonisi (ACO)** | Meta-Sezgisel | Sanal karıncalar ağ üzerinde dolaşır ve iyi yollara "feromon" bırakır. Sonraki karıncalar feromonu yoğun yolları tercih eder. |
| **Genetik Algoritma (GA)** | Meta-Sezgisel | Rastgele rotalardan oluşan bir popülasyon yaratılır. En iyiler seçilir, çaprazlanır ve mutasyona uğratılarak "süper birey" aranır. |
| **Yapay Arı Kolonisi (ABC)** | Meta-Sezgisel | İşçi arılar mevcut yolları iyileştirir, gözcü arılar en iyi kaynaklara yönelir, kaşif arılar tıkandığında rastgele yeni yollar arar. |
| **Q-Learning** | RL (Yapay Zeka) | Bir ajan her adımda ödül/ceza alarak hangi düğümden hangisine gitmenin "karlı" olduğunu öğrenir (Q-Table Update). |

---

## ⚙️ Teknik Mimari ve Matematik

### 📐 Maliyet Fonksiyonu (Weighted Cost)
Sistem, bir yolun kalitesini hesaplarken kullanıcı tarafından belirlenen ağırlıkları ($W$) dikkate alır.

$$WeightedCost = (W_{Gecikme} \times Gecikme) + (W_{Güven} \times -log(Güvenilirlik)) + (W_{Kaynak} \times \frac{1}{BantGenişliği}) + (HopCezası)$$

### 📁 Proje Yapısı
```bash
/src
├── components/
│   ├── DunyaHaritasi.tsx  # 🌀 Three.js Render Mantığı
│   ├── DeneyYurutucu.tsx  # 📊 Test Otomasyonu & İstatistik
│   └── KontrolPaneli.tsx  # 🎛️ UI Kontrolleri
├── services/
│   ├── algoritmalar.ts    # 🧠 AI Çekirdeği (GA, ACO, ABC, QL)
│   └── hesaplama.worker.ts # ⚡ Paralel Hesaplama (Web Worker)
├── models/
│   └── Graph.ts           # 🕸️ Çizge Veri Yapısı
└── App.tsx                # � Ana Uygulama
```

---

## 🧪 Deney Laboratuvarı

**Nasıl Kullanılır?**
1.  **Mod Seçimi:** Sağ üstteki butondan "Hazır Senaryoları Test Et" veya "Rastgele Başlat" seçeneğini kullanın.
2.  **İlerleme:** Sistem senaryoları işlerken anlık durumu (Başarılı/Başarısız) ve kullanılan **Seed** değerini gösterir.
3.  **Raporlama:** İşlem bitince "CSV İndir" butonu aktif olur.

**Örnek CSV Çıktısı:**
```csv
Senaryo,Algoritma,Durum,Başarı(%),Ort.Süre,Seed Listesi
1,GA,BAŞARILI,100,45.2ms,88123;11234;...
1,ACO,BAŞARILI,100,120.5ms,99123;55123;...
```

---

## 🚀 Kurulum

1.  **Repoyu Klonla:**
    ```bash
    git clone https://github.com/NyancatGo/BSM307_Proje.git
    cd project
    ```

2.  **Paketleri Yükle:**
    ```bash
    npm install
    ```

3.  **Başlat:**
    ```bash
    npm run dev
    ```

---

<div align="center">

**Bartın Üniversitesi - BTBS**  
*BSM307 Güz Dönemi Projesi - 2025*

</div>
