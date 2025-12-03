import networkx as nx
import random
import math
import numpy as np

# --- A. MATEMATİKSEL MOTOR (QoS ve KISITLAR) ---

def yol_detaylarini_hesapla(Ag, yol, ayarlar=None):
    """
    Yolun maliyetini ve geçerliliğini hesaplar.
    ayarlar: {'w_gecikme': 0.33, 'w_guven': 0.33, 'w_kaynak': 0.34, 'min_bant': 0}
    """
    # Varsayılan ayarlar
    if ayarlar is None:
        ayarlar = {'w_gecikme': 0.33, 'w_guven': 0.33, 'w_kaynak': 0.34, 'min_bant': 0}
    
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

            # Metrikleri Topla
            toplam_gecikme += baglanti.get('delay', 0) + dugum.get('processing_delay', 0)

            r_link = baglanti.get('reliability', 0.99)
            r_node = dugum.get('reliability', 0.99)
            if r_link > 0: toplam_guven_log += -math.log(r_link)
            if r_node > 0: toplam_guven_log += -math.log(r_node)
            gercek_guvenilirlik *= (r_link * r_node)

            bw = baglanti.get('bandwidth', 100)
            min_bant_genisligi = min(min_bant_genisligi, bw)
            if bw > 0: toplam_kaynak_maliyeti += (1000.0 / bw)

        # [GÜNCELLEME 1] Bant Genişliği Kısıtı Kontrolü
        if min_bant_genisligi < ayarlar.get('min_bant', 0):
            return {'skor': float('inf'), 'gecerli_mi': False}

        # Skor Hesaplama
        final_skor = (ayarlar['w_gecikme'] * toplam_gecikme) + \
                     (ayarlar['w_guven'] * toplam_guven_log) + \
                     (ayarlar['w_kaynak'] * toplam_kaynak_maliyeti)

        return {
            'skor': final_skor,
            'toplam_gecikme': toplam_gecikme,
            'guvenilirlik': gercek_guvenilirlik,
            'min_bant_genisligi': min_bant_genisligi,
            'gecerli_mi': True
        }
    except Exception as hata:
        return {'skor': float('inf'), 'gecerli_mi': False}

def yol_maliyetini_hesapla(Ag, yol, ayarlar=None):
    return yol_detaylarini_hesapla(Ag, yol, ayarlar)['skor']

# --- B. GELİŞMİŞ YAPAY ZEKA ALGORİTMALARI ---

# 1. KARINCA KOLONİSİ (ACO) - [GÜNCELLEME 2: Feromon Eklendi]
def karinca_kolonisi_algoritmasi(Ag, kaynak, hedef, karinca_sayisi=30, tur_sayisi=30, ayarlar=None):
    en_iyi_yol = None
    en_iyi_skor = float('inf')
    
    # Feromon Matrisi (Başlangıçta her yolda azıcık koku var)
    feromonlar = {}
    for u, v in Ag.edges():
        feromonlar[(u, v)] = 1.0 # Başlangıç değeri
        feromonlar[(v, u)] = 1.0 # Çift yönlü

    alpha = 1.0 # Feromon önemi
    rho = 0.5   # Buharlaşma oranı (Her tur koku azalır)

    for tur in range(tur_sayisi):
        turun_yollari = [] # Bu tur bulunan yollar

        for k in range(karinca_sayisi):
            curr = kaynak
            yol = [kaynak]
            ziyaret = {kaynak}
            adim = 0
            
            while curr != hedef and adim < 100:
                komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
                if not komsular: break
                
                # Olasılıklı Seçim (Rulet Tekerleği)
                # Feromonu çok olan yolun seçilme şansı artar
                olasiliklar = []
                for n in komsular:
                    koku = feromonlar.get((curr, n), 1.0)
                    olasiliklar.append(koku ** alpha)
                
                if sum(olasiliklar) == 0:
                    curr = random.choice(komsular)
                else:
                    # Python'un ağırlıklı seçim fonksiyonu
                    curr = random.choices(komsular, weights=olasiliklar, k=1)[0]

                yol.append(curr)
                ziyaret.add(curr)
                adim += 1
            
            if curr == hedef:
                skor = yol_maliyetini_hesapla(Ag, yol, ayarlar)
                if skor != float('inf'):
                    turun_yollari.append((yol, skor))
                    if skor < en_iyi_skor:
                        en_iyi_skor = skor
                        en_iyi_yol = list(yol)

        # Feromon Güncelleme (Buharlaşma + Yeni Koku)
        # 1. Buharlaşma
        for k in feromonlar:
            feromonlar[k] *= (1 - rho)
        
        # 2. Yeni Koku Ekleme (İyi yollara daha çok koku)
        for yol, skor in turun_yollari:
            koku_miktari = 100.0 / (skor + 1) # Skor düşükse koku çok olur
            for i in range(len(yol) - 1):
                u, v = yol[i], yol[i+1]
                if (u, v) in feromonlar:
                    feromonlar[(u, v)] += koku_miktari
                if (v, u) in feromonlar: # Ters yönü de güncelle
                    feromonlar[(v, u)] += koku_miktari

    return en_iyi_yol, en_iyi_skor

# 2. GENETİK ALGORİTMA (GA) - [GÜNCELLEME 3: Çaprazlama Eklendi]
def genetik_algoritma(Ag, kaynak, hedef, populasyon_buyuklugu=50, nesil_sayisi=50, ayarlar=None):
    
    def rastgele_yol_bul():
        curr = kaynak
        yol = [kaynak]
        ziyaret = {kaynak}
        adim = 0
        while curr != hedef and adim < 150:
            komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
            if not komsular: return None
            curr = random.choice(komsular)
            yol.append(curr)
            ziyaret.add(curr)
            adim += 1
        return yol if curr == hedef else None

    # Çaprazlama (Crossover) Fonksiyonu
    def caprazlama(yol1, yol2):
        # İki yolun ortak düğümlerini bul (Başlangıç ve Bitiş hariç)
        ortak_noktalar = [n for n in yol1 if n in yol2 and n != kaynak and n != hedef]
        if not ortak_noktalar:
            return yol1 # Ortak nokta yoksa çaprazlama yapamaz, anneyi döndür
        
        # Rastgele bir ortak noktadan kesip birleştir
        kesim_noktasi = random.choice(ortak_noktalar)
        idx1 = yol1.index(kesim_noktasi)
        idx2 = yol2.index(kesim_noktasi)
        
        # Yeni Çocuk: Yol1'in Başı + Yol2'nin Sonu
        yeni_yol = yol1[:idx1] + yol2[idx2:]
        
        # Döngü kontrolü (Yol kendine dönmesin)
        if len(yeni_yol) == len(set(yeni_yol)):
            return yeni_yol
        return yol1

    # Başlangıç Popülasyonu
    populasyon = []
    deneme = 0
    while len(populasyon) < populasyon_buyuklugu and deneme < populasyon_buyuklugu * 5:
        p = rastgele_yol_bul()
        if p: populasyon.append(p)
        deneme += 1
    
    if not populasyon: return None, float('inf')

    en_iyi_yol = None
    en_iyi_skor = float('inf')

    for _ in range(nesil_sayisi):
        puanli_pop = []
        for p in populasyon:
            s = yol_maliyetini_hesapla(Ag, p, ayarlar)
            puanli_pop.append((s, p))
            if s < en_iyi_skor:
                en_iyi_skor = s
                en_iyi_yol = list(p)
        
        puanli_pop.sort(key=lambda x: x[0])
        
        # Doğal Seçilim (En iyiler)
        elitler = [p for s, p in puanli_pop[:int(len(populasyon)*0.5)]]
        
        # Yeni Nesil Üretimi (Çaprazlama ile)
        yeni_nesil = elitler[:]
        while len(yeni_nesil) < populasyon_buyuklugu:
            # Rastgele iki ebeveyn seç
            ebeveyn1 = random.choice(elitler)
            ebeveyn2 = random.choice(elitler)
            # Çaprazla
            cocuk = caprazlama(ebeveyn1, ebeveyn2)
            yeni_nesil.append(cocuk)
            
        populasyon = yeni_nesil

    return en_iyi_yol, en_iyi_skor

# 3. Q-LEARNING
def q_ogrenme_algoritmasi(Ag, kaynak, hedef, bolum_sayisi=200, ayarlar=None):
    Q_Tablosu = {}
    def q_al(s, a): return Q_Tablosu.get((s, a), 0.0)
    en_iyi_yol, en_iyi_skor = None, float('inf')

    # Hiperparametreler
    alpha, gamma, epsilon = 0.1, 0.9, 0.1

    for _ in range(bolum_sayisi):
        curr = kaynak
        yol = [kaynak]
        ziyaret = {kaynak}
        adim = 0
        
        while curr != hedef and adim < 100:
            komsular = [n for n in Ag.neighbors(curr) if n not in ziyaret]
            if not komsular: break
            
            if random.random() < epsilon:
                sonraki = random.choice(komsular)
            else:
                q_lar = [q_al(curr, n) for n in komsular]
                max_q = max(q_lar) if q_lar else 0
                adaylar = [n for n in komsular if q_al(curr, n) == max_q]
                sonraki = random.choice(adaylar)
            
            yol.append(sonraki)
            ziyaret.add(sonraki)
            adim += 1
            
            # Adım Cezası (Küçük negatif ödül) - Hızlı gitmeyi teşvik eder
            odul = -0.1 
            
            if sonraki == hedef:
                maliyet = yol_maliyetini_hesapla(Ag, yol, ayarlar)
                # Hedef ödülü maliyete ters orantılı
                odul = 1000.0 / (maliyet + 1)
                if maliyet < en_iyi_skor:
                    en_iyi_skor = maliyet
                    en_iyi_yol = list(yol)
            
            max_gelecek = 0
            if sonraki != hedef:
                nn = list(Ag.neighbors(sonraki))
                if nn: max_gelecek = max([q_al(sonraki, n) for n in nn])
            
            yeni_q = q_al(curr, sonraki) + alpha * (odul + (gamma * max_gelecek) - q_al(curr, sonraki))
            Q_Tablosu[(curr, sonraki)] = yeni_q
            curr = sonraki

    return en_iyi_yol, en_iyi_skor

# 4. YAPAY ARI KOLONİSİ (ABC)
def yapay_ari_kolonisi(Ag, kaynak, hedef, koloni_boyutu=30, tur_sayisi=30, limit=5, ayarlar=None):
    
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
            tamir = nx.shortest_path(Ag, kopma, hedef) # Basit tamir
            yeni = yol[:idx] + tamir
            if len(yeni) == len(set(yeni)): return yeni
        except: pass
        return list(yol)

    kaynaklar = []
    deneme = 0
    while len(kaynaklar) < koloni_boyutu // 2 and deneme < koloni_boyutu * 5:
        p = rastgele_yol_getir()
        if p:
            s = yol_maliyetini_hesapla(Ag, p, ayarlar)
            if s != float('inf'): # Geçerli yol ise ekle
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
            yeni_skor = yol_maliyetini_hesapla(Ag, yeni_yol, ayarlar)
            
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
                    s = yol_maliyetini_hesapla(Ag, yeni, ayarlar)
                    if s != float('inf'):
                        kaynaklar[i] = {'yol': yeni, 'skor': s, 'deneme': 0}

        kaynaklar.sort(key=lambda x: x['skor'])
        if kaynaklar[0]['skor'] < en_iyi_skor:
            en_iyi_skor = kaynaklar[0]['skor']
            en_iyi_yol = list(kaynaklar[0]['yol'])

    return en_iyi_yol, en_iyi_skor