import network_generator
import algorithms
import time
import os

def ekrani_temizle():
    os.system('cls' if os.name == 'nt' else 'clear')

def main():
    ekrani_temizle()
    print("\n" + "="*75)
    print("🚀 BSM307 - QOS ROTALAMA PROJESİ (FİNAL SUNUM MODU)")
    print("="*75)
    
    print("\n[1/3] Ağ Topolojisi Hazırlanıyor (250 Düğüm)...")
    Ag = network_generator.create_network()
    
    baslangic, bitis = 0, 249
    
    if not algorithms.nx.has_path(Ag, baslangic, bitis):
        print("❌ HATA: Yol yok! Yeniden başlatın.")
        return

    print(f"\n[2/3] Algoritmalar Yarışıyor (Hedef: {baslangic} -> {bitis})")
    print("      Lütfen bekleyiniz, yapay zeka en iyi yolu hesaplıyor...\n")
    
    print("-" * 80)
    print(f"{'ALGORİTMA':<25} | {'SKOR (Maliyet)':<15} | {'SÜRE (sn)':<12} | {'ADIM'}")
    print("-" * 80)

    # 1. KARINCA KOLONİSİ (ACO)
    # 30 Karınca, 30 Tur (Yeterince iyi sonuç için ideal)
    basla = time.time()
    yol, skor = algorithms.karinca_kolonisi_algoritmasi(Ag, baslangic, bitis, karinca_sayisi=30, tur_sayisi=30)
    sure = time.time() - basla
    print(f"{'1. ACO (Karınca)':<25} | {skor:<15.4f} | {sure:<12.4f} | {len(yol) if yol else 0}")

    # 2. GENETİK ALGORİTMA (GA)
    # 50 Popülasyon, 50 Nesil (Artık çok daha akıllı!)
    basla = time.time()
    yol, skor = algorithms.genetik_algoritma(Ag, baslangic, bitis, populasyon_buyuklugu=50, nesil_sayisi=50)
    sure = time.time() - basla
    print(f"{'2. GA (Genetik)':<25} | {skor:<15.4f} | {sure:<12.4f} | {len(yol) if yol else 0}")

    # 3. Q-LEARNING
    # 200 Bölüm (Öğrenmesi için yeterli süre)
    basla = time.time()
    yol, skor = algorithms.q_ogrenme_algoritmasi(Ag, baslangic, bitis, bolum_sayisi=200)
    sure = time.time() - basla
    print(f"{'3. Q-Learning':<25} | {skor:<15.4f} | {sure:<12.4f} | {len(yol) if yol else 0}")

    # 4. YAPAY ARI KOLONİSİ (ABC)
    # 30 Arı, 30 Tur
    basla = time.time()
    yol, skor = algorithms.yapay_ari_kolonisi(Ag, baslangic, bitis, koloni_boyutu=30, tur_sayisi=30)
    sure = time.time() - basla
    print(f"{'4. ABC (Arı)':<25} | {skor:<15.4f} | {sure:<12.4f} | {len(yol) if yol else 0}")

    print("-" * 80)
    print("✅ HESAPLAMA TAMAMLANDI! Sonuçlar sunuma hazırdır.")

if __name__ == "__main__":
    main()