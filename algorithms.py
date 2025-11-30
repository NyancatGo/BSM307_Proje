import networkx as nx
import random
import math
import numpy as np

# --- A. MATEMATİKSEL MOTOR (QoS HESAPLAMA) ---

def yol_detaylarini_hesapla(Ag, yol, agirlik_gecikme=0.33, agirlik_guven=0.33, agirlik_kaynak=0.34):
    """
    Verilen bir yolun (path) kalitesini hesaplar.
    Hem 'Skor' (Maliyet) üretir hem de Web arayüzü için detaylı rapor verir.
    """
    if not yol or len(yol) < 2:
        return {'skor': float('inf'), 'gecerli_mi': False}

    toplam_gecikme = 0
    toplam_guven_log = 0
    gercek_guvenilirlik = 1.0
    toplam_kaynak_maliyeti = 0
    min_bant_genisligi = float('inf')

    try:
        for i in range(len(yol) - 1):
            u, v = yol[i], yol[i+1]
            if not Ag.has_edge(u, v): 
                return {'skor': float('inf'), 'gecerli_mi': False}

            baglanti = Ag[u][v]
            dugum = Ag.nodes[u]

            # 1. Gecikme
            toplam_gecikme += baglanti.get('delay', 0) + dugum.get('processing_delay', 0)

            # 2. Güvenilirlik
            r_link = baglanti.get('reliability', 0.99)
            r_node = dugum.get('reliability', 0.99)
            if r_link > 0: toplam_guven_log += -math.log(r_link)
            if r_node > 0: toplam_guven_log += -math.log(r_node)
            gercek_guvenilirlik *= (r_link * r_node)

            # 3. Kaynak (Bant Genişliği)
            bw = baglanti.get('bandwidth', 100)
            min_bant_genisligi = min(min_bant_genisligi, bw)
            if bw > 0: toplam_kaynak_maliyeti += (1000.0 / bw)

        final_skor = (agirlik_gecikme * toplam_gecikme) + \
                     (agirlik_guven * toplam_guven_log) + \
                     (agirlik_kaynak * toplam_kaynak_maliyeti)

        return {
            'skor': final_skor,
            'toplam_gecikme': toplam_gecikme,
            'guvenilirlik': gercek_guvenilirlik,
            'min_bant_genisligi': min_bant_genisligi,
            'gecerli_mi': True
        }
    except Exception as hata:
        return {'skor': float('inf'), 'gecerli_mi': False}

def yol_maliyetini_hesapla(Ag, yol):
    detaylar = yol_detaylarini_hesapla(Ag, yol)
    return detaylar['skor']

# --- B. YAPAY ZEKA ALGORİTMALARI (FİNAL AYARLAR) ---

# 1. KARINCA KOLONİSİ (ACO)
def karinca_kolonisi_algoritmasi(Ag, kaynak, hedef, karinca_sayisi=30, tur_sayisi=30):
    en_iyi_yol = None
    en_iyi_skor = float('inf')

    for tur in range(tur_sayisi):
        for k in range(karinca_sayisi):
            curr = kaynak
            yol = [kaynak]
            ziyaret = {kaynak}
            adim = 0
            
            # Karınca maksimum 100 adım atabilir (Sonsuz döngü koruması)
            while curr != hedef and adim < 100:
                komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
                if not komsular: break
                curr = random.choice(komsular)
                yol.append(curr)
                ziyaret.add(curr)
                adim += 1
            
            if curr == hedef:
                skor = yol_maliyetini_hesapla(Ag, yol)
                if skor < en_iyi_skor:
                    en_iyi_skor = skor
                    en_iyi_yol = list(yol)

    return en_iyi_yol, en_iyi_skor

# 2. GENETİK ALGORİTMA (GA) - [Performans Artırıldı]
def genetik_algoritma(Ag, kaynak, hedef, populasyon_buyuklugu=50, nesil_sayisi=50):
    
    # Akıllı Rastgele Yol Bulucu
    def rastgele_yol_bul():
        curr = kaynak
        yol = [kaynak]
        ziyaret = {kaynak}
        adim = 0
        while curr != hedef and adim < 150: # Adım limitini biraz artırdık
            komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
            if not komsular: return None
            curr = random.choice(komsular)
            yol.append(curr)
            ziyaret.add(curr)
            adim += 1
        return yol if curr == hedef else None

    # 1. Popülasyonu Doldur
    populasyon = []
    deneme_sayisi = 0
    while len(populasyon) < populasyon_buyuklugu and deneme_sayisi < populasyon_buyuklugu * 5:
        p = rastgele_yol_bul()
        if p: populasyon.append(p)
        deneme_sayisi += 1
    
    if not populasyon: return None, float('inf')

    en_iyi_yol = None
    en_iyi_skor = float('inf')

    # 2. Evrim
    for _ in range(nesil_sayisi):
        # Puanla ve Sırala
        puanli_pop = []
        for p in populasyon:
            s = yol_maliyetini_hesapla(Ag, p)
            puanli_pop.append((s, p))
            if s < en_iyi_skor:
                en_iyi_skor = s
                en_iyi_yol = list(p)
        
        puanli_pop.sort(key=lambda x: x[0])
        
        # Elitizm: En iyi %40 direkt kalsın
        elit_sayisi = int(len(populasyon) * 0.4)
        yeni_nesil = [p for s, p in puanli_pop[:elit_sayisi]]
        
        # Eksikleri tamamla (Basit çoğaltma)
        while len(yeni_nesil) < populasyon_buyuklugu:
            yeni_nesil.append(random.choice(yeni_nesil))
            
        populasyon = yeni_nesil

    return en_iyi_yol, en_iyi_skor

# 3. Q-LEARNING
def q_ogrenme_algoritmasi(Ag, kaynak, hedef, bolum_sayisi=200, ogrenme_orani=0.1, gama=0.9, kesif_orani=0.1):
    Q_Tablosu = {}
    def q_al(s, a): return Q_Tablosu.get((s, a), 0.0)
    
    en_iyi_yol, en_iyi_skor = None, float('inf')

    for _ in range(bolum_sayisi):
        curr = kaynak
        yol = [kaynak]
        ziyaret = {kaynak}
        adim = 0
        
        while curr != hedef and adim < 100:
            komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
            if not komsular: break
            
            if random.random() < kesif_orani:
                sonraki = random.choice(komsular)
            else:
                q_lar = [q_al(curr, n) for n in komsular]
                max_q = max(q_lar) if q_lar else 0
                adaylar = [n for n in komsular if q_al(curr, n) == max_q]
                sonraki = random.choice(adaylar)
            
            yol.append(sonraki)
            ziyaret.add(sonraki)
            adim += 1
            
            odul = 0
            if sonraki == hedef:
                maliyet = yol_maliyetini_hesapla(Ag, yol)
                odul = 1000.0 / (maliyet + 1)
                if maliyet < en_iyi_skor:
                    en_iyi_skor = maliyet
                    en_iyi_yol = list(yol)
            
            max_gelecek = 0
            if sonraki != hedef:
                nn = list(Ag.neighbors(sonraki))
                if nn: max_gelecek = max([q_al(sonraki, n) for n in nn])
            
            yeni_q = q_al(curr, sonraki) + ogrenme_orani * (odul + (gama * max_gelecek) - q_al(curr, sonraki))
            Q_Tablosu[(curr, sonraki)] = yeni_q
            curr = sonraki

    return en_iyi_yol, en_iyi_skor

# 4. YAPAY ARI KOLONİSİ (ABC)
def yapay_ari_kolonisi(Ag, kaynak, hedef, koloni_boyutu=30, tur_sayisi=30, limit=5):
    
    def rastgele_yol_getir():
        curr = kaynak
        yol = [kaynak]
        ziyaret = {kaynak}
        adim = 0
        while curr != hedef and adim < 100:
            komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
            if not komsular: return None
            curr = random.choice(komsular)
            yol.append(curr)
            ziyaret.add(curr)
            adim += 1
        return yol

    def komsu_uret(yol):
        if len(yol) < 3: return list(yol)
        try:
            idx = random.randint(1, len(yol)-2)
            kopma = yol[idx]
            tamir = nx.shortest_path(Ag, kopma, hedef)
            yeni = yol[:idx] + tamir
            if len(yeni) == len(set(yeni)): return yeni
        except: pass
        return list(yol)

    kaynaklar = []
    deneme = 0
    while len(kaynaklar) < koloni_boyutu // 2 and deneme < koloni_boyutu * 5:
        p = rastgele_yol_getir()
        if p:
            s = yol_maliyetini_hesapla(Ag, p)
            kaynaklar.append({'yol': p, 'skor': s, 'deneme': 0})
        deneme += 1
    
    if not kaynaklar: return None, float('inf')

    en_iyi_yol = None
    en_iyi_skor = float('inf')

    for _ in range(tur_sayisi):
        # İşçi ve Gözcü Arılar
        for i in range(len(kaynaklar)):
            mevcut = kaynaklar[i]
            yeni_yol = komsu_uret(mevcut['yol'])
            yeni_skor = yol_maliyetini_hesapla(Ag, yeni_yol)
            
            if yeni_skor < mevcut['skor']:
                mevcut['yol'] = yeni_yol
                mevcut['skor'] = yeni_skor
                mevcut['deneme'] = 0
            else:
                mevcut['deneme'] += 1

        # Kaşif Arılar
        for i in range(len(kaynaklar)):
            if kaynaklar[i]['deneme'] > limit:
                yeni = rastgele_yol_getir()
                if yeni:
                    kaynaklar[i] = {'yol': yeni, 'skor': yol_maliyetini_hesapla(Ag, yeni), 'deneme': 0}

        kaynaklar.sort(key=lambda x: x['skor'])
        if kaynaklar[0]['skor'] < en_iyi_skor:
            en_iyi_skor = kaynaklar[0]['skor']
            en_iyi_yol = list(kaynaklar[0]['yol'])

    return en_iyi_yol, en_iyi_skor