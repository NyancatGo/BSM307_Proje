import network_generator
import algorithms
import time

def main():
    print("\n=== BSM307 PROJE SİMÜLASYONU BAŞLATILIYOR ===\n")
    
    # 1. Ağı Oluştur
    my_network = network_generator.create_network()
    
    # Başlangıç ve Bitiş Noktalarını Seç
    source_node = 0
    target_node = 249
    
    print(f"\nRotamız: Düğüm {source_node} ---> Düğüm {target_node}")
    print("-" * 50)
    
    # 2. Algoritmayı Çalıştır ve Süre Tut
    start_time = time.time()
    
    best_path, best_score = algorithms.ant_colony_optimization(
        my_network, 
        source=source_node, 
        target=target_node,
        num_ants=30,     # 30 Karınca
        iterations=50    # 50 Tur
    )
    
    end_time = time.time()
    
    # 3. Sonuçları Ekrana Bas
    print("-" * 50)
    if best_path:
        print(f"✅ SONUÇ BAŞARILI!")
        print(f"📍 Bulunan Yol: {best_path}")
        print(f"⭐ Toplam Skor (Maliyet): {best_score:.4f}")
        print(f"⏱️ Hesaplama Süresi: {end_time - start_time:.4f} saniye")
    else:
        print("❌ Yol Bulunamadı! (Graf kopuk olabilir, tekrar deneyin)")

if __name__ == "__main__":
    main()