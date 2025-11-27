import networkx as nx
import random

# PDF'teki Proje Ayarları
NUM_NODES = 250         # Düğüm Sayısı
CONN_PROB = 0.4         # Bağlantı Olasılığı

def create_network():
    print(f"--- Ağ Oluşturuluyor (N={NUM_NODES}, P={CONN_PROB}) ---")
    
    # 1. Adım: Topolojiyi Oluştur (Erdos-Renyi Modeli)
    # directed=True çünkü veri akışı tek yönlü olabilir
    G = nx.erdos_renyi_graph(n=NUM_NODES, p=CONN_PROB, directed=True)
    
    # [cite_start]2. Adım: Düğüm (Node) Özelliklerini Ata [cite: 28-30]
    for node in G.nodes():
        G.nodes[node]['processing_delay'] = random.uniform(0.5, 2.0)  # 0.5 - 2.0 ms
        G.nodes[node]['reliability'] = random.uniform(0.95, 0.999)    # %95 - %99.9

    # [cite_start]3. Adım: Bağlantı (Link) Özelliklerini Ata [cite: 32-35]
    for u, v in G.edges():
        G.edges[u, v]['bandwidth'] = random.randint(100, 1000)      # 100 - 1000 Mbps
        G.edges[u, v]['delay'] = random.uniform(3, 15)              # 3 - 15 ms
        G.edges[u, v]['reliability'] = random.uniform(0.95, 0.999)  # %95 - %99.9

    print(f"✅ Ağ Hazır! Toplam Bağlantı: {G.number_of_edges()}")
    return G