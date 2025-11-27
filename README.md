# 🌐 QoS Odaklı Çok Amaçlı Rotalama Projesi
**Ders:** BSM307 - Bilgisayar Ağları (Güz 2025)

---

## 1. Proje Nedir? (Özet)
Bu proje, 250 bilgisayardan (düğümden) oluşan karmaşık bir ağda, veriyi A noktasından B noktasına götüren **"en mükemmel yolu"** bulan bir simülasyondur.

Normal navigasyonlar sadece "en kısa yolu" arar. Ancak bu projede geliştirdiğimiz sistem, **3 farklı kurala** aynı anda uymaya çalışır:
1.  **Hız:** Veri çok beklememeli (Düşük Gecikme).
2.  **Sağlamlık:** Yol üzerindeki cihazlar bozulmamalı (Yüksek Güvenilirlik).
3.  **Genişlik:** Yol tıkanık olmamalı (Yüksek Bant Genişliği).

Bu problem bilgisayar bilimlerinde **NP-Hard** (Çözülmesi Çok Zor) olarak bilinir. Bu yüzden klasik yöntemler yerine "Yapay Zeka" benzeri akıllı algoritmalar kullanılmıştır.

---

## 2. Nasıl Puanlıyoruz? (Matematiksel Mantık)
Sistem, bulduğu her yola bir **"Karne Puanı"** (Total Cost) verir. Bu puan ne kadar düşükse, yol o kadar iyidir.

Puanlama formülü şu şekildedir:
> **Puan = (Gecikme Puanı) + (Güvensizlik Puanı) + (Darboğaz Puanı)**

Kullanıcı arayüzden bu kriterlerin önem derecesini (Ağırlıklarını) değiştirebilir. Örneğin; *"Hız benim için %80 önemli, güvenlik %20 önemli"* diyebilir.

---

## 3. Ağın Özellikleri
Projede oluşturulan sanal ağ, gerçek bir veri merkezini taklit eder:
* **Düğüm Sayısı:** 250 adet.
* **Bağlantı Tipi:** Rastgele (Erdős-Rényi Modeli).
* **Değişkenler:** Her kablonun hızı ve her cihazın bozulma ihtimali birbirinden farklıdır ve rastgele atanır.

---

## 4. Kullanılan Akıllı Algoritmalar
Milyarlarca yol ihtimalini tek tek denemek yıllar süreceği için, doğadan ilham alan iki yöntem kullandık:

### 🐜 A. Karınca Kolonisi (ACO)
Gerçek karıncaların yiyecek ararken feromon (koku) bırakması taklit edilir.
* Sanal karıncalar haritaya salınır.
* Hedefe hızlı ve güvenli varan karınca, geçtiği yola yüksek puan (feromon) bırakır.
* Diğer karıncalar kokusu (puanı) yüksek yolu takip eder.

### 🧬 B. Genetik Algoritma (GA)
Evrim teorisi taklit edilir.
* Rastgele 20 farklı yol oluşturulur.
* Bu yollar "çaprazlanır" (birinin başı ile diğerinin sonu birleşir).
* Kötü yollar elenir, iyi yollar hayatta kalır ve "en iyi yol" evrimleşerek ortaya çıkar.

---

## 5. Kurulum ve Çalıştırma

Projeyi kendi bilgisayarınızda çalıştırmak için:

1.  **Projeyi İndirin:**
    ```bash
    git clone [https://github.com/KULLANICI_ADI/REPO_ADI.git](https://github.com/KULLANICI_ADI/REPO_ADI.git)
    ```

2.  **Gerekli Kütüphaneleri Kurun:**
    ```bash
    pip install networkx matplotlib numpy
    ```

3.  **Başlatın:**
    ```bash
    python main.py
    ```



