"""
BSM307 - Bilgisayar Ağları Projesi
Grup Üyeleri:
1. [Ad Soyad] - [Numara]
2. [Ad Soyad] - [Numara]
...
"""
import network_generator
import algorithms
import time
import os
import pandas as pd  # Excel/CSV kaydı için gerekli

def ekrani_temizle():
    # İşletim sistemine göre terminali temizler (Windows/Mac/Linux uyumlu)
    os.system('cls' if os.name == 'nt' else 'clear')

def main():
    ekrani_temizle()
    print("\n" + "="*75)
    print("🚀 BSM307 - QOS ROTALAMA PROJESİ (FİNAL SUNUM MODU)")
    print("="*75)
    
    print("\n[1/3] Ağ Topolojisi Hazırlanıyor (250 Düğüm)...")
    
    # [GÜNCELLEME 1] SEED=42 ile haritayı sabitliyoruz.
    # Her çalıştırdığında aynı harita gelir, böylece "Dün çalışıyordu bugün bozuldu" demezsin.
    Ag = network_generator.create_network(seed=42)
    
    baslangic, bitis = 0, 249
    
    # [GÜNCELLEME 2] Varsayılan Ağırlık Ayarları ve Kısıtlar
    # (İleride burası kullanıcıdan input ile alınabilir)
    ayarlar = {
        'w_gecikme': 0.33,
        'w_guven': 0.33,
        'w_kaynak': 0.34,
        'min_bant': 0  # 0 Mbps (Kısıt yok), 500 yaparsan dar yolları eler.
    }

    # Yol kontrolü: Eğer şans eseri yol yoksa uyar.
    if not algorithms.nx.has_path(Ag, baslangic, bitis):
        print("❌ HATA: Kaynak ve Hedef arasında yol yok! Seed değerini değiştirin.")
        return

    print(f"\n[2/3] Algoritmalar Yarışıyor (Hedef: {baslangic} -> {bitis})")
    print("      Lütfen bekleyiniz, yapay zeka en iyi yolu hesaplıyor...\n")
    
    print("-" * 80)
    print(f"{'ALGORİTMA':<25} | {'SKOR (Maliyet)':<15} | {'SÜRE (sn)':<12} | {'ADIM'}")
    print("-" * 80)

    # Sonuçları Excel'e aktarmak için hafızada tutuyoruz
    veriler = []

    # 1. KARINCA KOLONİSİ (ACO)
    # 30 Karınca, 30 Tur (İdeal denge)
    basla = time.time()
    yol, skor = algorithms.karinca_kolonisi_algoritmasi(
        Ag, baslangic, bitis, karinca_sayisi=30, tur_sayisi=30, ayarlar=ayarlar
    )
    sure = time.time() - basla
    adim = len(yol) if yol else 0
    print(f"{'1. ACO (Karınca)':<25} | {skor:<15.4f} | {sure:<12.4f} | {adim}")
    
    # Listeye ekle
    veriler.append({'Algoritma': 'Karınca (ACO)', 'Skor': skor, 'Sure_sn': sure, 'Adim_Sayisi': adim})

    # 2. GENETİK ALGORİTMA (GA)
    # 50 Popülasyon, 50 Nesil (Optimum zeka için)
    basla = time.time()
    yol, skor = algorithms.genetik_algoritma(
        Ag, baslangic, bitis, populasyon_buyuklugu=50, nesil_sayisi=50, ayarlar=ayarlar
    )
    sure = time.time() - basla
    adim = len(yol) if yol else 0
    print(f"{'2. GA (Genetik)':<25} | {skor:<15.4f} | {sure:<12.4f} | {adim}")
    
    veriler.append({'Algoritma': 'Genetik (GA)', 'Skor': skor, 'Sure_sn': sure, 'Adim_Sayisi': adim})

    # 3. Q-LEARNING (Pekiştirmeli Öğrenme)
    # 200 Bölüm (Öğrenmesi için yeterli tekrar)
    basla = time.time()
    yol, skor = algorithms.q_ogrenme_algoritmasi(
        Ag, baslangic, bitis, bolum_sayisi=200, ayarlar=ayarlar
    )
    sure = time.time() - basla
    adim = len(yol) if yol else 0
    print(f"{'3. Q-Learning':<25} | {skor:<15.4f} | {sure:<12.4f} | {adim}")
    
    veriler.append({'Algoritma': 'Q-Learning', 'Skor': skor, 'Sure_sn': sure, 'Adim_Sayisi': adim})

    # 4. YAPAY ARI KOLONİSİ (ABC)
    # 30 Arı, 30 Tur (Hız şampiyonu)
    basla = time.time()
    yol, skor = algorithms.yapay_ari_kolonisi(
        Ag, baslangic, bitis, koloni_boyutu=30, tur_sayisi=30, limit=5, ayarlar=ayarlar
    )
    sure = time.time() - basla
    adim = len(yol) if yol else 0
    print(f"{'4. ABC (Arı)':<25} | {skor:<15.4f} | {sure:<12.4f} | {adim}")
    
    veriler.append({'Algoritma': 'Arı (ABC)', 'Skor': skor, 'Sure_sn': sure, 'Adim_Sayisi': adim})

    print("-" * 80)
    
    # [3/3] SONUÇLARI KAYDETME (DİREKT EXCEL .xlsx)
    try:
        df = pd.DataFrame(veriler)
        
        # Dosya adını .xlsx yapıyoruz (Gerçek Excel)
        dosya_adi = "proje_sonuclari.xlsx"
        
        # Excel formatında kaydet (Her çalışmada üzerine yazar, temiz sayfa açar)
        df.to_excel(dosya_adi, index=False)
        
        print(f"✅ HESAPLAMA TAMAMLANDI! Sonuçlar '{dosya_adi}' dosyasına kaydedildi.")
        print("📊 Not: Bu dosyayı Excel ile açıp grafiklerinizi çizebilirsiniz.")

    except Exception as e:
        print(f"⚠️ Kayıt Uyarısı: {e} (Dosya açık olabilir veya openpyxl yüklü değil)")

if __name__ == "__main__":
    main()