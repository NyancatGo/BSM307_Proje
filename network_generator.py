import networkx as nx
import random

# Varsayılan Proje Ayarları (PDF'e Uygun)
DEFAULT_NODES = 250         # Standart Düğüm Sayısı
DEFAULT_PROB = 0.4          # Bağlantı Olasılığı

def create_network(node_count=DEFAULT_NODES, conn_prob=DEFAULT_PROB, seed=None):
    """
    Gelişmiş Ağ Oluşturucu (Backend Odaklı)
    
    Parametreler:
    - node_count: Düğüm sayısı (Varsayılan 250, Ek puan için 1000 yapılabilir)
    - conn_prob: Bağlantı yoğunluğu
    - seed: Tekrarlanabilirlik için kilit sayı (None ise her seferinde rastgele)
    """
    
    # 1. Tekrarlanabilirlik Ayarı (Seed)
    # Bu sayede aynı seed'i verirsen her seferinde birebir aynı harita oluşur.
    if seed is not None:
        random.seed(seed)
    
    print(f"--- Ağ Oluşturuluyor (N={node_count}, P={conn_prob}, Seed={seed}) ---")
    
    # 2. Topolojiyi Oluştur (Erdos-Renyi Modeli)
    # directed=True: Trafik tek yönlü akabilir (Gerçekçi ağ)
    G = nx.erdos_renyi_graph(n=node_count, p=conn_prob, directed=True, seed=seed)
    
    # 3. Düğüm (Router) Özelliklerini Ata
    for node in G.nodes():
        # İşlem Gecikmesi: 0.5 - 2.0 ms
        G.nodes[node]['processing_delay'] = random.uniform(0.5, 2.0)
        # Donanım Güvenilirliği: %95 - %99.9
        G.nodes[node]['reliability'] = random.uniform(0.95, 0.999)

    # 4. Bağlantı (Kablo) Özelliklerini Ata
    for u, v in G.edges():
        # Bant Genişliği: 100 - 1000 Mbps (Tamsayı)
        G.edges[u, v]['bandwidth'] = random.randint(100, 1000)
        # İletim Gecikmesi: 3 - 15 ms
        G.edges[u, v]['delay'] = random.uniform(3, 15)
        # Hat Güvenilirliği: %95 - %99.9
        G.edges[u, v]['reliability'] = random.uniform(0.95, 0.999)

    # 5. Bağlılık Kontrolü (Bilgi Amaçlı)
    if nx.is_strongly_connected(G):
        status = "Tam Bağlı (Her yerden her yere gidilebilir)"
    else:
        status = "Parçalı (Bazı düğümler arası yol olmayabilir)"

    print(f"✅ Ağ Hazır! Durum: {status}")
    print(f"📊 İstatistik: {G.number_of_nodes()} Düğüm, {G.number_of_edges()} Bağlantı")
    
    return G