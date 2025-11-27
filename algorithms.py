import networkx as nx
import random
import math

# --- MALİYET HESAPLAMA (FITNESS FUNCTION) ---
def calculate_path_cost(G, path, w_delay=0.33, w_rel=0.33, w_res=0.34):
    """
    Bir yolun toplam maliyetini hesaplar.
    Formüller PDF Madde 3.1, 3.2, 3.3'e göre hazırlanmıştır.
    """
    total_delay = 0
    total_reliability_cost = 0
    total_resource_cost = 0

    # Yol üzerindeki her adımı incele
    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        edge_data = G[u][v]
        node_data = G.nodes[u]

        # [cite_start]1. Gecikme: Link Gecikmesi + Düğüm İşleme Süresi [cite: 41]
        total_delay += edge_data['delay'] + node_data['processing_delay']

        # [cite_start]2. Güvenilirlik Maliyeti: -log(R_link) + -log(R_node) [cite: 52]
        # Logaritma kullanarak çarpma işlemini toplamaya çeviriyoruz.
        if edge_data['reliability'] > 0:
            total_reliability_cost += -math.log(edge_data['reliability'])
        if node_data['reliability'] > 0:
            total_reliability_cost += -math.log(node_data['reliability'])

        # [cite_start]3. Kaynak Maliyeti: 1000 / Bant Genişliği [cite: 57]
        # Bant genişliği düşükse maliyet artar.
        if edge_data['bandwidth'] > 0:
            total_resource_cost += (1000.0 / edge_data['bandwidth'])

    # [cite_start]Ağırlıklı Toplam (Weighted Sum) [cite: 66]
    final_score = (w_delay * total_delay) + \
                  (w_rel * total_reliability_cost) + \
                  (w_res * total_resource_cost)
    
    return final_score

# --- KARINCA KOLONİSİ ALGORİTMASI (ACO) ---
def ant_colony_optimization(G, source, target, num_ants=20, iterations=10):
    print(f"🐜 ACO Başladı: {source} -> {target} (Ajan: {num_ants}, Tur: {iterations})")
    
    best_path = None
    best_score = float('inf') # Sonsuz (Başlangıç değeri)

    for it in range(iterations):
        for ant in range(num_ants):
            current = source
            path = [source]
            visited = set([source])
            
            # Karınca hedefe gidene kadar yürüyor
            while current != target:
                neighbors = list(G.neighbors(current))
                # Daha önce gitmediği komşuları bul
                valid_neighbors = [n for n in neighbors if n not in visited]
                
                if not valid_neighbors:
                    break # Çıkmaz sokak
                
                # Şimdilik rastgele seçiyoruz (İleride feromon eklenecek)
                next_node = random.choice(valid_neighbors)
                path.append(next_node)
                visited.add(next_node)
                current = next_node
            
            # Hedefe ulaştı mı?
            if current == target:
                score = calculate_path_cost(G, path)
                if score < best_score:
                    best_score = score
                    best_path = path
                    print(f"   🎉 Yeni Rekor (Tur {it}): Skor = {best_score:.2f}")

    return best_path, best_score