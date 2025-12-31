# 🌐 QoS Odaklı Akıllı Rotalama ve 3D Web Simülasyonu (BSM307)

<div align="center">

![React](https://img.shields.io/badge/Frontend-React_18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-blue?style=for-the-badge&logo=typescript)
![Three.js](https://img.shields.io/badge/3D_Engine-Three.js-white?style=for-the-badge&logo=three.js)
![Vite](https://img.shields.io/badge/Build-Vite-purple?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/Style-TailwindCSS-38bdf8?style=for-the-badge&logo=tailwindcss)
![Status](https://img.shields.io/badge/Project-COMPLETED-success?style=for-the-badge)

<h3>🚀 Yeni Nesil Ağ Simülasyonu ve Yapay Zeka Laboratuvarı</h3>

<p>
  <strong>Ders:</strong> BSM307 - Bilgisayar Ağları (Güz 2025)<br>
  <strong>Konu:</strong> QoS Odaklı Çok Amaçlı Rotalama için Meta-Sezgisel ve Pekiştirmeli Öğrenme Yaklaşımları
</p>

[Özellikler](#-1-proje-özellikleri) • [Algoritmalar](#-2-yapay-zeka-çekirdeği) • [Deney Laboratuvarı](#-3-deney-laboratuvarı-ve-analiz) • [Kurulum](#-5-kurulum-ve-çalıştırma)

</div>

---

## 📖 1. Proje Hakkında
Bu proje, modern veri merkezleri ve bulut ağlarında karşılaşılan **karmaşık rotalama (routing)** problemlerini çözmek için geliştirilmiş, yüksek performanslı bir simülasyon aracıdır. Standart algoritmaların aksine, bu proje **Gecikme (Latency)**, **Güvenilirlik (Reliability)**, **Bant Genişliği (Bandwidth)** ve **Maliyet (Cost)** gibi çelişen hedefleri aynı anda optimize etmeye çalışır.

### ⭐ Öne Çıkan Özellikler

| Özellik | Açıklama |
|---------|----------|
| **🌍 3D İnteraktif Dünya** | 250+ düğümlü ağı dünya üzerinde X-Ray modu, uydu görüntüleri ve dinamik bağlantılarla görselleştirir. |
| **🧠 4 Farklı Yapay Zeka** | Genetik Algoritma, Karınca Kolonisi, Yapay Arı Kolonisi ve Q-Learning algoritmalarını aynı anda yarıştırır. |
| **🧪 Deney Modülü (V2.0)** | CSV tabanlı hazır senaryoları yükler veya rastgele stres testleri oluşturur. **Seed Takibi** ile %100 tekrarlanabilirlik sağlar. |
| **📊 Detaylı Raporlama** | Her deneyin Min/Max süreleri, Standart Sapması ve Maliyet analizini içeren Excel/CSV formatında profesyonel rapor üretir. |
| **🎛️ Dinamik QoS** | Ağırlık kaydırıcıları ile "Gecikme mi önemli, Güvenilirlik mi?" sorusuna anlık yanıt arar. |

---

## 🧠 2. Yapay Zeka Çekirdeği

Proje, optimum rotayı bulmak için literatürdeki en güçlü meta-sezgisel yöntemleri kullanır.

<details>
<summary><strong>🐜 Karınca Kolonisi Optimizasyonu (ACO)</strong> - <em>Tıklayarak Detayları Gör</em></summary>

*   **Mantık:** Doğadaki karıncaların yiyecek ararken bıraktıkları feromon izlerini takip etmesi prensibine dayanır.
*   **Avantajı:** Dinamik ağlarda çok hızlı adapte olur.
*   **Bu Projedeki Rolü:** Feromon matrisi üzerinden olasılıksal yol seçimi yapar.
</details>

<details>
<summary><strong>🧬 Genetik Algoritma (GA)</strong> - <em>Tıklayarak Detayları Gör</em></summary>

*   **Mantık:** Evrim teorisini taklit eder. Başlangıçta rastgele yollar üretilir, en iyiler seçilir ("Doğal Seçilim"), bunlar çiftleşir ("Çaprazlama") ve mutasyona uğrar.
*   **Avantajı:** Çok geniş arama uzaylarında global optimumu bulma şansı yüksektir.
*   **Bu Projedeki Rolü:** Popülasyon tabanlı rota evrimi gerçekleştirir.
</details>

<details>
<summary><strong>🐝 Yapay Arı Kolonisi (ABC)</strong> - <em>Tıklayarak Detayları Gör</em></summary>

*   **Mantık:** Arıların iş bölümünü (İşçi, Gözcü, Kaşif) modeller. İşçi arılar bilinen kaynakları sömürürken, kaşif arılar yeni yollar arar.
*   **Avantajı:** Lokal tuzaklardan kaçma yeteneği yüksektir (Kaşif arı mekanizması).
*   **Bu Projedeki Rolü:** Komşuluk araştırması ile mevcut rotaları iyileştirir.
</details>

<details>
<summary><strong>🤖 Q-Learning (RL)</strong> - <em>Tıklayarak Detayları Gör</em></summary>

*   **Mantık:** Bir "Ajan" (Agent) çevreyle etkileşime girer. Doğru hareket ödüllendirilir (+Reward), yanlış hareket cezalandırılır (-Penalty).
*   **Avantajı:** Öğrendikçe hızlanır, "akıllı" kararlar almaya başlar.
*   **Bu Projedeki Rolü:** Q-Tablosu (State-Action) üzerinden en karlı sonraki düğümü (Next Hop) seçmeyi öğrenir.
</details>

---

## 🧪 3. Deney Laboratuvarı ve Analiz

Bu modül, projenin **bilimsel yönünü** temsil eder. Tekil hesaplamalar yerine, yüzlerce senaryoyu arka arkaya çalıştırarak istatistiksel veri toplar.

### 📂 Yeni Özellik: Hazır Senaryo Yükleyici (CSV)
Artık `DemandData.csv` dosyasındaki standart test senaryolarını tek tuşla yükleyebilirsiniz.
1.  **"Hazır Senaryoları Test Et"** butonuna basın.
2.  Sistem otomasyonu başlatır ve her senaryoyu 5 kez tekrar eder.
3.  **Seed Takibi:** Her tekrar için benzersiz bir sayısal tohum (Seed) üretilir ve loglanır. Bu sayede deney sonuçları **kanıtlanabilir ve tekrarlanabilir** olur.

### 📋 Rapor Çıktısı (Örnek)
Sistem, deney sonunda aşağıdaki sütunları içeren detaylı bir CSV dosyası oluşturur:

| Senaryo | Algoritma | Durum | Başarı(%) | Ort. Süre | Min/Max Süre | Ort. Maliyet | Std. Sapma | Seed Listesi |
|---------|-----------|-------|-----------|-----------|--------------|--------------|------------|--------------|
| 1 | GA | BAŞARILI | 100 | 45ms | 42ms / 48ms | 12.5 | 0.8 | `1231;5521...`|
| 1 | ACO | BAŞARILI | 100 | 120ms | 115ms / 125ms| 12.4 | 0.2 | `9912;1123...`|

---

## ⚙️ 4. Teknik Mimari ve Matematik

### Maliyet Fonksiyonu
Ağdaki her bağlantının kalitesi, kullanıcı tercihlerine göre ağırlıklandırılmış bir skorla belirlenir:

$$WeightedCost = (W_{Gecikme} \times Gecikme) + (W_{Güven} \times -log(Güvenilirlik)) + (W_{Kaynak} \times \frac{1}{BantGenişliği}) + (HopCezası)$$

### Dosya Ağacı
Proje modüler ve sürdürülebilir bir yapıda tasarlanmıştır:

```text
/src
  ├── components/
  │     ├── DunyaHaritasi.tsx     # 🧊 3D Render Motoru
  │     ├── DeneyYurutucu.tsx     # 📊 İstatistik ve Test Merkezi
  │     └── ...
  ├── services/
  │     ├── algoritmalar.ts       # 🧠 Yapay Zeka Mantığı (Core)
  │     ├── hesaplama.worker.ts   # ⚡ Paralel İşlem Birimi (Web Worker)
  │     └── ...
  └── App.tsx                     # 📱 Ana Kontrol Paneli
```

---

## 🚀 5. Kurulum ve Çalıştırma

Bilgisayarınızda **Node.js** (v16+) yüklü olmalıdır.

1.  **Projeyi İndirin:**
    ```bash
    git clone https://github.com/NyancatGo/BSM307_Proje.git
    cd BSM307_Proje/project
    ```

2.  **Kütüphaneleri Yükleyin:**
    ```bash
    npm install
    ```

3.  **Başlatın:**
    ```bash
    npm run dev
    ```
    
    Terminalde çıkan linke (örn: `http://localhost:5173`) tıklayarak simülasyona başlayın!

---

<div align="center">
  <p>Bartın Üniversitesi - BTBS</p>
</div>
