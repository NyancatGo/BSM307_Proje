# 🌐 QoS Odaklı Akıllı Rotalama ve Web Simülasyonu (BSM307)

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=flat&logo=python)
![Flask](https://img.shields.io/badge/Web-Flask-green?style=flat&logo=flask)
![License](https://img.shields.io/badge/Course-BSM307-orange)
![Status](https://img.shields.io/badge/Status-Completed-success)

**Ders:** BSM307 - Bilgisayar Ağları (Güz 2025)  
**Proje Konusu:** QoS Odaklı Çok Amaçlı Rotalama için Meta-Sezgisel ve Pekiştirmeli Öğrenme Yaklaşımları

---

## 📖 1. Proje Özeti
Bu proje, modern veri merkezi ve bulut ağlarında (Cloud/Data Center) karşılaşılan **Rotalama (Routing)** problemini çözmek için geliştirilmiş yapay zeka tabanlı bir simülasyondur. 

250 düğümlü (veya ölçeklenebilir 1000+ düğümlü) karmaşık ve stokastik bir ağ üzerinde, veriyi **A noktasından B noktasına** götürecek en optimum yolu bulur. Klasik algoritmaların yetersiz kaldığı çok değişkenli senaryolarda, 4 farklı yapay zeka algoritmasını yarıştırır.

### 🎯 Optimizasyon Hedefleri (QoS Metrikleri)
Sistem, bir yol seçerken şu 3 çelişen metriği aynı anda optimize eder (Multi-Objective Optimization):
1.  **⚡ Gecikme (Delay):** Verinin iletim süresini minimize eder (Minimizasyon).
2.  **🛡️ Güvenilirlik (Reliability):** Yolun kopma ihtimalini en aza indirir (Maksimizasyon).
3.  **🛣️ Kaynak Kullanımı (Resource):** Bant genişliği darboğazlarını engeller (Minimizasyon).

---

## 🧠 2. Kullanılan Yapay Zeka Algoritmaları
Proje kapsamında, problemin çözümü için **4 farklı modern yaklaşım** geliştirilmiş ve performansları kıyaslanmıştır:

| Algoritma | Tür | Açıklama |
|-----------|-----|----------|
| **🐜 Karınca Kolonisi (ACO)** | Meta-Sezgisel | Doğadaki karıncaların feromon izi bırakarak en kısa yolu bulma davranışını simüle eder. |
| **🐝 Yapay Arı Kolonisi (ABC)** | Meta-Sezgisel | Arıların nektar kaynaklarını (yolları) arama, dans ile haberleşme ve keşfetme zekasını kullanır. |
| **🧬 Genetik Algoritma (GA)** | Meta-Sezgisel | Evrim teorisindeki "Doğal Seçilim", "Çaprazlama" ve "Mutasyon" yöntemleriyle en iyi rotayı nesiller içinde geliştirir. |
| **🤖 Q-Learning (RL)** | Pekiştirmeli Öğrenme | Bir ajanın çevreyle etkileşime girerek (deneme-yanılma) ödül/ceza mekanizmasıyla doğru yolu öğrenmesini sağlar. |

---

## ⚙️ 3. Teknik Mimari ve Matematiksel Model
Proje, **Python (Backend)** hesaplama motoru ve **HTML/JS (Frontend)** görselleştirme arayüzünü birleştiren modüler bir yapıdadır.

### Matematiksel Maliyet Fonksiyonu (Fitness Function)
Bir yolun kalitesi ($TotalCost$), aşağıdaki ağırlıklı toplam formülü ile hesaplanır:

$$Skor = (W_{1} \times Gecikme) + (W_{2} \times GüvenilirlikMaliyeti) + (W_{3} \times KaynakMaliyeti)$$

* **Güvenilirlik:** Çarpımsal olduğu için `-log(Reliability)` alınarak toplamsal maliyete dönüştürülmüştür.
* **Kaynak:** `1000 / Bant Genişliği` formülü ile darboğaz yaratan yollara ceza puanı verilir.

### Proje Dosya Yapısı
```text
/BSM307_Proje
  ├── app.py               # Flask Web Sunucusu (Web Arayüzü Başlatıcı)
  ├── main.py              # Terminal Üzerinden Performans Testi (Benchmark)
  ├── algorithms.py        # 4 Yapay Zeka Algoritmasının Motoru (ACO, ABC, GA, QL)
  ├── network_generator.py # Gelişmiş Ağ Oluşturucu (Seed & JSON Desteği)
  ├── /templates
  │     └── index.html     # Web Arayüz Tasarımı (HTML)
  ├── /static
  │     ├── style.css      # Stil Dosyası
  │     └── script.js      # Harita Çizimi (Vis.js / Cytoscape)
  └── requirements.txt     # Gerekli kütüphaneler
  ```

## 🚀 5. Kurulum ve Çalıştırma

Projeyi çalıştırmak için aşağıdaki adımları izleyin:

1.  **Depoyu İndirin:**
    ```bash
    git clone [https://github.com/NyancatGo/BSM307_Proje.git](https://github.com/NyancatGo/BSM307_Proje.git)
    cd BSM307_Proje
    ```

2.  **Kütüphaneleri Yükleyin:**
    ```bash
    pip install networkx matplotlib numpy flask pandas
    ```

3.  **Uygulamayı Başlatın:**
    ```bash
    python app.py
    ```


---

## 📅 Önemli Tarihler
* **Kod Teslimi:** 31 Aralık 2025
* **Video Teslimi:** 31 Aralık 2025
* **Final Raporu:** 7 Ocak 2026

---
*BSM307 Güz Dönemi Projesi - Tüm Hakları Saklıdır.*
