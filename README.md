# 🌐 QoS Odaklı Akıllı Rotalama ve Web Simülasyonu (BSM307)

![Python](https://img.shields.io/badge/Python-3.8%2B-blue?style=flat&logo=python)
![Flask](https://img.shields.io/badge/Web-Flask-green?style=flat&logo=flask)
![License](https://img.shields.io/badge/Course-BSM307-orange)
![Status](https://img.shields.io/badge/Status-Development-red)

**Ders:** BSM307 - Bilgisayar Ağları (Güz 2025)  
**Proje Konusu:** QoS Odaklı Çok Amaçlı Rotalama için Meta-Sezgisel ve Pekiştirmeli Öğrenme Yaklaşımları

---

## 📖 1. Proje Özeti
Bu proje, modern veri merkezi ve bulut ağlarında karşılaşılan **Rotalama (Routing)** problemini çözmek için geliştirilmiş web tabanlı bir simülasyondur. 250 düğümlü (veya opsiyonel 1000 düğümlü) karmaşık bir ağ üzerinde, veriyi **A noktasından B noktasına** götürecek en optimum yolu bulur.

Sistem, klasik "en kısa yol" algoritmalarının aksine, **Hizmet Kalitesi (QoS)** gereksinimlerini sağlamak için şu 3 metriği aynı anda optimize eder:
1.  **⚡ Gecikme (Delay):** Verinin iletim süresini minimize eder.
2.  **🛡️ Güvenilirlik (Reliability):** Yolun kopma ihtimalini minimize eder (Maksimizasyon).
3.  **🛣️ Kaynak Kullanımı (Resource):** Bant genişliği yüksek olan yolları tercih eder.

---

## 🧠 2. Kullanılan Algoritmalar (4 Yaklaşım)
Projede, problemin çözümü için 4 farklı algoritma geliştirilmiş ve birbirleriyle kıyaslanmıştır:

| Algoritma | Tür | Açıklama |
|-----------|-----|----------|
| **🐜 Karınca Kolonisi (ACO)** | Meta-Sezgisel | Doğadaki karıncaların feromon izi bırakarak en kısa yolu bulma davranışını taklit eder. |
| **🧬 Genetik Algoritma (GA)** | Meta-Sezgisel | Evrim teorisindeki "Doğal Seçilim", "Çaprazlama" ve "Mutasyon" yöntemlerini kullanır. |
| **🤖 Q-Learning (RL)** | Pekiştirmeli Öğrenme | Bir ajanın çevreyle etkileşime girerek ödül/ceza mekanizmasıyla doğru yolu öğrenmesini sağlar. |
| **📍 Dijkstra** | Klasik (Deterministik) | Kıyaslama (Benchmark) amacıyla kullanılan, en kısa yolu matematiksel kesinlikle bulan referans algoritmadır. |

---

## ⚙️ 3. Teknik Mimari ve Matematiksel Model
Proje, **Python (Backend)** ve **HTML/JS (Frontend)** teknolojilerini birleştiren hibrit bir yapıdadır.

### Matematiksel Maliyet Fonksiyonu (Fitness Function)
Bir yolun kalitesi ($TotalCost$), aşağıdaki ağırlıklı toplam formülü ile hesaplanır:

> **Skor = (W1 × Gecikme) + (W2 × Güvenilirlik_Maliyeti) + (W3 × Kaynak_Maliyeti)**

* **Güvenilirlik:** Çarpımsal olduğu için `-log(Reliability)` alınarak toplamsal maliyete dönüştürülmüştür.
* **Kaynak:** `1000 / Bant Genişliği` formülü ile darboğaz yaratan yollara ceza puanı verilir.

### Proje Dosya Yapısı
```text
/BSM307_Proje
  ├── app.py               # Flask Web Sunucusu (Ana Başlatıcı)
  ├── algorithms.py        # 4 Algoritmanın kodları (ACO, GA, Q-Learning, Dijkstra)
  ├── network_generator.py # 250 Düğümlü Ağ Oluşturucu Modül
  ├── utils.py             # Matematiksel hesaplama araçları
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
