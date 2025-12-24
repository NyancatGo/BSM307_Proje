// src/services/algoritmalar.ts
import { CizgeVerisi, AlgoritmaParametreleri, YolSonucu, AlgoritmaTipi, Baglanti, Dugum } from '../tipler';

// ============================================================================
// 0. YARDIMCI: SEEDED RNG (Tekrarlanabilirlik İçin Rastgele Sayı Üreteci)
// ============================================================================
class TohumluRNG {
    private tohum: number;

    constructor(tohum: number) {
        this.tohum = tohum;
    }

    // Basit bir LCG (Linear Congruential Generator) algoritması
    // Akademik standartlara uygun deterministik rastgelelik sağlar.
    siradaki(): number {
        this.tohum = (this.tohum * 9301 + 49297) % 233280;
        return this.tohum / 233280;
    }

    // [min, max) aralığında ondalıklı sayı üretir
    siradakiOndalikli(min: number, max: number): number {
        return min + this.siradaki() * (max - min);
    }

    // [min, max) aralığında tam sayı üretir
    siradakiTamSayi(min: number, max: number): number {
        return Math.floor(this.siradakiOndalikli(min, max));
    }

    // Diziden rastgele eleman seçer
    secim<T>(dizi: T[]): T {
        return dizi[this.siradakiTamSayi(0, dizi.length)];
    }
}

// ============================================================================
// 1. ORTAK HESAPLAMA MOTORU (FİZİK & MATEMATİK KATMANI)
// ============================================================================

// --- YARDIMCI FONKSİYONLAR (NORMALİZASYON VE STANDARTLAŞTIRMA) ---

/**
 * Node ID'sini güvenli bir şekilde alır.
 * ForceGraph kütüphanesi bazen node'u obje olarak, bazen primitive ID olarak tutar.
 * Bu fonksiyon bu tutarsızlığı giderir.
 */
export const kimlikGetir = (dugum: any): number => {
    return typeof dugum === 'object' ? dugum.id : dugum;
};

/**
 * İstatistiksel verileri hesaplar (Min, Max, Ortalama, Standart Sapma).
 * Deney sonuçlarını analiz etmek için kullanılır.
 */
export const istatistikHesapla = (degerler: number[]) => {
    if (degerler.length === 0) return { ortalama: 0, stdSapma: 0, min: 0, max: 0 };
    const ortalama = degerler.reduce((a, b) => a + b, 0) / degerler.length;
    // Standart Sapma (Standard Deviation - Population)
    const stdSapma = Math.sqrt(degerler.map(x => Math.pow(x - ortalama, 2)).reduce((a, b) => a + b, 0) / degerler.length);
    return { ortalama, stdSapma, min: Math.min(...degerler), max: Math.max(...degerler) };
};

/**
 * İki düğüm arasındaki bağlantıyı kontrol eder (Breadth First Search - BFS).
 * Grafların bağlantılı olup olmadığını doğrular.
 */
export const baglantiKontrol = (cizge: CizgeVerisi, baslangic: number, bitis: number): boolean => {
    if (baslangic === bitis) return true;
    const ziyaretEdilenler = new Set<number>();
    const kuyruk = [baslangic];
    ziyaretEdilenler.add(baslangic);

    while (kuyruk.length > 0) {
        const u = kuyruk.shift()!;
        if (u === bitis) return true;

        // Komşuları bul
        const komsular = cizge.adjacency.get(u) || [];
        for (const baglanti of komsular) {
            const baglantiKaynak = kimlikGetir(baglanti.source);
            const baglantiHedef = kimlikGetir(baglanti.target);

            // Eğer u, source ise neighbor target'tır; değilse tam tersi (yönsüz varsayımı)
            const komsuId = baglantiKaynak === u ? baglantiHedef : baglantiKaynak;

            if (!ziyaretEdilenler.has(komsuId)) {
                ziyaretEdilenler.add(komsuId);
                kuyruk.push(komsuId);
            }
        }
    }
    return false;
};

/**
 * Bir yolun (path) metriklerini (gecikme, güvenilirlik, maliyet) hesaplar.
 * @param yol Node ID'lerinden oluşan sıralı liste
 * @param cizge Graf verisi
 */
/**
 * Bir yolun (path) metriklerini (gecikme, güvenilirlik, maliyet) hesaplar.
 * @param yol Node ID'lerinden oluşan sıralı liste
 * @param cizge Graf verisi
 * @param baglantiHaritasi Hızlı erişim için link haritası (Opsiyonel, performans için önerilir)
 */
const yolMetrikleriniHesapla = (yol: number[], cizge: CizgeVerisi, baglantiHaritasi?: Map<string, Baglanti>) => {
    let toplamGecikme = 0;
    let toplamLogGuvenilirlik = 0; // Logaritmik Toplam (Çarpım işlemini toplama dönüştürmek için)
    let toplamKaynakMaliyeti = 0;
    let hamGuvenilirlik = 1.0;

    for (let i = 0; i < yol.length - 1; i++) {
        const u = yol[i];
        const v = yol[i + 1];

        // İki düğüm arasındaki bağlantıyı (Link) ve hedef düğümü (Node) buluyoruz
        let baglanti: Baglanti | undefined;

        if (baglantiHaritasi) {
            // O(1) Erişim
            baglanti = baglantiHaritasi.get(`${u}-${v}`) || baglantiHaritasi.get(`${v}-${u}`);
        } else {
            // O(N) Erişim (Fallback)
            baglanti = cizge.links.find(l => (l.source === u && l.target === v) || (l.source === v && l.target === u));
        }

        const hedefDugum = cizge.nodes.find(n => n.id === v);

        if (baglanti && hedefDugum) {
            // A) GECİKME (Delay): Link İletim Süresi + Hedef Düğüm İşlem Süresi
            toplamGecikme += baglanti.propagationDelay + (hedefDugum.processingDelay || 0);

            // A) GECİKME (Delay): Link İletim Süresi + Hedef Düğüm İşlem Süresi
            toplamGecikme += baglanti.propagationDelay + (hedefDugum.processingDelay || 0);

            // B) GÜVENİLİRLİK (Reliability): Logaritmik Dönüşüm
            // Pre-calculation varsayımı: baglanti.logReliability varsa kullan, yoksa hesapla
            const logRel = baglanti.logReliability ?? -Math.log(Math.max(0.0001, baglanti.reliability || 0.99));
            // Node reliability sabit kabul edilebilir veya ihmal edilebilir, ama burada hesaplıyoruz
            const dGuven = Math.max(0.0001, hedefDugum.reliability || 0.99);

            toplamLogGuvenilirlik += logRel + (-Math.log(dGuven));
            hamGuvenilirlik *= ((baglanti.reliability || 0.99) * dGuven);

            // C) KAYNAK KULLANIMI (Resource Cost): Bant Genişliği ile Ters Orantılı
            // Pre-calculation varsa kullan
            toplamKaynakMaliyeti += baglanti.resourceCost ?? (1000 / (baglanti.bandwidth || 100));
        }
    }

    return {
        totalDelay: toplamGecikme,
        totalReliability: hamGuvenilirlik,
        totalLogRel: toplamLogGuvenilirlik,
        resourceCost: toplamKaynakMaliyeti,
        hopCount: yol.length - 1,
        weightedCost: 0
    };
};

// Yardımcı: Hızlı Bağlantı Haritası Oluşturucu (Pre-Calculation Dahil)
const haritaOlustur = (links: Baglanti[]): Map<string, Baglanti> => {
    const map = new Map<string, Baglanti>();
    links.forEach(l => {
        // Pre-calculation (Ön Hesaplama)
        // Bu değerler döngü içinde milyonlarca kez tekrar hesaplanmaz, burada bir kere hesaplanır.
        const logRel = -Math.log(Math.max(0.0001, l.reliability || 0.99));
        const resCost = 1000 / (l.bandwidth || 100);

        const linkWithMets = { ...l, logReliability: logRel, resourceCost: resCost };

        map.set(`${l.source}-${l.target}`, linkWithMets);
        // Yönsüz graf varsayımıyla ters yönü de ekle
        map.set(`${l.target}-${l.source}`, linkWithMets);
    });
    return map;
};

/**
 * Hesaplanan metrikleri kullanıcı ağırlıklarına göre tek bir skor (Weighted Cost) haline getirir.
 */
const agirlikliMaliyetHesapla = (metrikler: any, parametreler: AlgoritmaParametreleri) => {
    const wD = parametreler.wGecikme ?? 0.33;
    const wR = parametreler.wGuvenilirlik ?? 0.33;
    const wK = parametreler.wKaynak ?? 0.33;

    const toplamAgirlik = wD + wR + wK;
    // Eğer hepsi 0 ise eşit kabul et, yoksa orantıla (Normalizasyon)
    const normD = toplamAgirlik === 0 ? 0.33 : wD / toplamAgirlik;
    const normR = toplamAgirlik === 0 ? 0.33 : wR / toplamAgirlik;
    const normK = toplamAgirlik === 0 ? 0.33 : wK / toplamAgirlik;

    return (
        (normD * metrikler.totalDelay) +
        (normR * metrikler.totalLogRel * 100) +
        (normK * metrikler.resourceCost)
    );
};

// Yardımcı: 3D Uzaklık Hesaplama (Öklid Mesafesi)
const mesafeHesapla = (n1: any, n2: any) => {
    return Math.sqrt(
        Math.pow((n1.x || 0) - (n2.x || 0), 2) +
        Math.pow((n1.y || 0) - (n2.y || 0), 2) +
        Math.pow((n1.z || 0) - (n2.z || 0), 2)
    );
};


// ============================================================================
// 2. GENETİK ALGORİTMA (GA)
// ============================================================================
export const genetikAlgoritmayiCalistir = (
    cizge: CizgeVerisi,
    baslangicDugum: number,
    bitisDugum: number,
    parametreler: AlgoritmaParametreleri = { populationSize: 50, iterations: 50 }
): YolSonucu => {
    const baslamaZamani = performance.now();
    const rng = new TohumluRNG(parametreler.seed ?? Math.floor(Math.random() * 99999));
    const baglantiHaritasi = haritaOlustur(cizge.links);

    // Rastgele Yol Üretici
    const rastgeleYolOlustur = (): number[] => {
        let yol = [baslangicDugum];
        let suanki = baslangicDugum;
        let ziyaretEdilen = new Set([baslangicDugum]);
        let deneme = 0;

        while (suanki !== bitisDugum && deneme < 100) {
            const komsular = cizge.links
                .filter(l => l.source === suanki || l.target === suanki)
                .map(l => l.source === suanki ? l.target : l.source);

            const gecerli = komsular.filter(n => !ziyaretEdilen.has(n));

            if (gecerli.length === 0) break; // Çıkmaz sokak

            const sonraki = rng.secim(gecerli);
            yol.push(sonraki);
            ziyaretEdilen.add(sonraki);
            suanki = sonraki;
            deneme++;
        }
        return suanki === bitisDugum ? yol : [];
    };

    // 1. Popülasyon Başlatma
    let populasyon: number[][] = [];
    for (let i = 0; i < (parametreler.populationSize || 50); i++) {
        const p = rastgeleYolOlustur();
        if (p.length > 0) populasyon.push(p);
    }

    let enIyiYol: number[] = [];
    let minimumMaliyet = Infinity;

    // 2. Evrim Döngüsü
    for (let iter = 0; iter < (parametreler.iterations || 50); iter++) {
        // Fitness Hesaplama ve Sıralama
        populasyon.sort((a, b) => {
            const maliyetA = agirlikliMaliyetHesapla(yolMetrikleriniHesapla(a, cizge, baglantiHaritasi), parametreler);
            const maliyetB = agirlikliMaliyetHesapla(yolMetrikleriniHesapla(b, cizge, baglantiHaritasi), parametreler);
            return maliyetA - maliyetB;
        });

        // En İyiyi Kaydet
        if (populasyon.length > 0) {
            const mevcutEnIyi = populasyon[0];
            const mevcutMaliyet = agirlikliMaliyetHesapla(yolMetrikleriniHesapla(mevcutEnIyi, cizge, baglantiHaritasi), parametreler);
            if (mevcutMaliyet < minimumMaliyet) {
                minimumMaliyet = mevcutMaliyet;
                enIyiYol = [...mevcutEnIyi];
            }
        }

        // Yeni Nesil Oluşturma (Elitizm + Çaprazlama + Mutasyon)
        const yeniPopulasyon = populasyon.slice(0, Math.floor((parametreler.populationSize || 50) * 0.2)); // %20 Elitizm

        while (yeniPopulasyon.length < (parametreler.populationSize || 50)) {
            if (populasyon.length < 2) break;

            // Turnuva
            const ebeveyn1 = rng.secim(populasyon.slice(0, 10));
            const ebeveyn2 = rng.secim(populasyon.slice(0, 10));

            // Çaprazlama (Crossover)
            const ortakDugumler = ebeveyn1.filter(n => ebeveyn2.includes(n) && n !== baslangicDugum && n !== bitisDugum);
            if (ortakDugumler.length > 0) {
                const caprazDugum = rng.secim(ortakDugumler);
                const idx1 = ebeveyn1.indexOf(caprazDugum);
                const idx2 = ebeveyn2.indexOf(caprazDugum);
                const cocuk = [...ebeveyn1.slice(0, idx1), ...ebeveyn2.slice(idx2)];

                // Döngü kontrolü
                if (new Set(cocuk).size === cocuk.length) {
                    yeniPopulasyon.push(cocuk);
                }
            } else {
                // Mutasyon
                const p = rastgeleYolOlustur();
                if (p.length > 0) yeniPopulasyon.push(p);
            }
        }
        populasyon = yeniPopulasyon;
    }

    const metrikler = yolMetrikleriniHesapla(enIyiYol, cizge, baglantiHaritasi);
    // @ts-ignore
    metrikler.weightedCost = minimumMaliyet;

    return {
        path: enIyiYol,
        metrics: metrikler,
        executionTime: performance.now() - baslamaZamani
    };
};

// ============================================================================
// 3. KARINCA KOLONİSİ (ACO)
// ============================================================================
export const karincaKolonisiCalistir = (
    cizge: CizgeVerisi,
    baslangicDugum: number,
    bitisDugum: number,
    parametreler: AlgoritmaParametreleri = { ants: 20, iterations: 20 }
): YolSonucu => {
    const baslamaZamani = performance.now();
    const rng = new TohumluRNG(parametreler.seed ?? Math.floor(Math.random() * 99999));
    const baglantiHaritasi = haritaOlustur(cizge.links);

    // Feromon İzleri
    const feromonlar = new Map<string, number>();
    const feromonGetir = (u: number, v: number) => feromonlar.get(`${u}-${v}`) || 1.0;
    const feromonAta = (u: number, v: number, deger: number) => feromonlar.set(`${u}-${v}`, deger);

    let globalEnIyiYol: number[] = [];
    let globalMinimumMaliyet = Infinity;

    for (let iter = 0; iter < (parametreler.iterations || 20); iter++) {
        for (let karinca = 0; karinca < (parametreler.ants || 20); karinca++) {
            let suanki = baslangicDugum;
            let yol = [baslangicDugum];
            let ziyaretEdilen = new Set([baslangicDugum]);

            while (suanki !== bitisDugum) {
                const komsular = cizge.links
                    .filter(l => l.source === suanki || l.target === suanki)
                    .map(l => l.source === suanki ? l.target : l.source)
                    .filter(n => !ziyaretEdilen.has(n));

                if (komsular.length === 0) break;

                // Olasılık Hesabı (Feromon * Sezgisel)
                const olasiliklar = komsular.map(n => {
                    const tau = feromonGetir(suanki, n);
                    const hedefD = cizge.nodes.find(node => node.id === bitisDugum);
                    const komsuD = cizge.nodes.find(node => node.id === n);
                    const mesafe = (hedefD && komsuD) ? mesafeHesapla(komsuD, hedefD) : 1;
                    const eta = 1 / (mesafe + 0.1);
                    return Math.pow(tau, 1.0) * Math.pow(eta, 2.0); // Beta=2
                });

                const toplamOlasilik = olasiliklar.reduce((a, b) => a + b, 0);

                // Rulet Tekerleği Seçimi
                let r = rng.siradakiOndalikli(0, toplamOlasilik);
                let secilen = komsular[komsular.length - 1];

                let kumulatif = 0;
                for (let i = 0; i < komsular.length; i++) {
                    kumulatif += olasiliklar[i];
                    if (r <= kumulatif) {
                        secilen = komsular[i];
                        break;
                    }
                }

                yol.push(secilen);
                ziyaretEdilen.add(secilen);
                suanki = secilen;
            }

            if (suanki === bitisDugum) {
                const m = yolMetrikleriniHesapla(yol, cizge, baglantiHaritasi);
                const maliyet = agirlikliMaliyetHesapla(m, parametreler);

                if (maliyet < globalMinimumMaliyet) {
                    globalMinimumMaliyet = maliyet;
                    globalEnIyiYol = [...yol];
                }
            }
        }

        // Feromon Buharlaşması ve Güncelleme
        for (const anahtar of feromonlar.keys()) {
            feromonlar.set(anahtar, (feromonlar.get(anahtar) || 1.0) * 0.9); // Buharlaşma 0.1
        }

        // Global En İyiyi Ödüllendirme
        for (let i = 0; i < globalEnIyiYol.length - 1; i++) {
            const u = globalEnIyiYol[i];
            const v = globalEnIyiYol[i + 1];
            const mevcut = feromonGetir(u, v);
            const artis = 100 / globalMinimumMaliyet;
            feromonAta(u, v, mevcut + artis);
            feromonAta(v, u, mevcut + artis);
        }
    }

    const metrikler = yolMetrikleriniHesapla(globalEnIyiYol, cizge, baglantiHaritasi);
    // @ts-ignore
    metrikler.weightedCost = globalMinimumMaliyet;

    return {
        path: globalEnIyiYol,
        metrics: metrikler,
        executionTime: performance.now() - baslamaZamani
    };
};

// ============================================================================
// 4. Q-LEARNING (Pekiştirmeli Öğrenme)
// ============================================================================
export const pekisirmeliOgrenmeCalistir = (
    cizge: CizgeVerisi,
    baslangicDugum: number,
    bitisDugum: number,
    parametreler: AlgoritmaParametreleri = { iterations: 1000, epsilon: 0.1 }
): YolSonucu => {
    const baslamaZamani = performance.now();
    const rng = new TohumluRNG(parametreler.seed ?? Math.floor(Math.random() * 99999));
    const baglantiHaritasi = haritaOlustur(cizge.links);

    const Q = new Map<string, number>(); // Q-Tablosu
    const qGetir = (s: number, a: number) => Q.get(`${s}-${a}`) || 0.0;
    const qAta = (s: number, a: number, deger: number) => Q.set(`${s}-${a}`, deger);

    for (let bolum = 0; bolum < (parametreler.iterations || 500); bolum++) {
        let suanki = baslangicDugum;
        let ziyaretEdilen = new Set([baslangicDugum]);

        while (suanki !== bitisDugum) {
            const komsular = cizge.links
                .filter(l => l.source === suanki || l.target === suanki)
                .map(l => l.source === suanki ? l.target : l.source)
                .filter(n => !ziyaretEdilen.has(n));

            if (komsular.length === 0) break;

            // Epsilon-Greedy Stratejisi
            let eylem: number;
            if (rng.siradaki() < (parametreler.epsilon || 0.1)) {
                eylem = rng.secim(komsular); // Keşfet (Explore)
            } else {
                // Sömür (Exploit) - En yüksek Q değerine git
                let maxQ = -Infinity;
                let enIyiEylemler: number[] = [];
                for (const n of komsular) {
                    const q = qGetir(suanki, n);
                    if (q > maxQ) {
                        maxQ = q;
                        enIyiEylemler = [n];
                    } else if (q === maxQ) {
                        enIyiEylemler.push(n);
                    }
                }
                eylem = rng.secim(enIyiEylemler);
            }

            const sonrakiDurum = eylem;
            const adimMaliyeti = agirlikliMaliyetHesapla(yolMetrikleriniHesapla([suanki, sonrakiDurum], cizge, baglantiHaritasi), parametreler);

            let odul = -adimMaliyeti;
            if (sonrakiDurum === bitisDugum) odul += 1000; // Hedef Ödülü

            const suankiQ = qGetir(suanki, eylem);

            // Sonraki durumdaki en iyi Q değerini bul
            const sonrakiKomsular = cizge.links
                .filter(l => l.source === sonrakiDurum || l.target === sonrakiDurum)
                .map(l => l.source === sonrakiDurum ? l.target : l.source);

            let maxSonrakiQ = 0;
            if (sonrakiKomsular.length > 0) {
                maxSonrakiQ = Math.max(...sonrakiKomsular.map(n => qGetir(sonrakiDurum, n)));
            }

            // Bellman Denklemi Güncellemesi
            const yeniQ = suankiQ + 0.1 * (odul + 0.9 * maxSonrakiQ - suankiQ);
            qAta(suanki, eylem, yeniQ);

            suanki = sonrakiDurum;
            ziyaretEdilen.add(suanki);
        }
    }

    // Öğrenilmiş Tablo ile En İyi Yolu Bul
    let enIyiYol = [baslangicDugum];
    let suanki = baslangicDugum;
    let yolZiyaret = new Set([baslangicDugum]);

    while (suanki !== bitisDugum) {
        const komsular = cizge.links
            .filter(l => l.source === suanki || l.target === suanki)
            .map(l => l.source === suanki ? l.target : l.source)
            .filter(n => !yolZiyaret.has(n));

        if (komsular.length === 0) break;

        let enIyiN = -1;
        let enIyiQ = -Infinity;
        for (const n of komsular) {
            const q = qGetir(suanki, n);
            if (q > enIyiQ) {
                enIyiQ = q;
                enIyiN = n;
            }
        }

        if (enIyiN !== -1) {
            suanki = enIyiN;
            enIyiYol.push(suanki);
            yolZiyaret.add(suanki);
        } else {
            break;
        }
        if (enIyiYol.length > 50) break;
    }

    if (enIyiYol[enIyiYol.length - 1] !== bitisDugum) {
        // @ts-ignore
        return { path: [], metrics: { weightedCost: Infinity }, executionTime: performance.now() - baslamaZamani };
    }

    const metrikler = yolMetrikleriniHesapla(enIyiYol, cizge, baglantiHaritasi);
    // @ts-ignore
    metrikler.weightedCost = agirlikliMaliyetHesapla(metrikler, parametreler);

    return { path: enIyiYol, metrics: metrikler, executionTime: performance.now() - baslamaZamani };
};

// ============================================================================
// 5. YAPAY ARI KOLONİSİ (ABC)
// ============================================================================
export const yapayAriKolonisiCalistir = (
    cizge: CizgeVerisi,
    baslangicDugum: number,
    bitisDugum: number,
    parametreler: AlgoritmaParametreleri = { iterations: 20, populationSize: 20 }
): YolSonucu => {
    const baslamaZamani = performance.now();
    const rng = new TohumluRNG(parametreler.seed ?? Math.floor(Math.random() * 99999));
    const baglantiHaritasi = haritaOlustur(cizge.links);

    let enIyiYol: number[] = [];
    let minimumMaliyet = Infinity;

    const rastgeleYolUret = (): number[] => {
        let yol = [baslangicDugum];
        let suanki = baslangicDugum;
        let ziyaret = new Set([baslangicDugum]);
        while (suanki !== bitisDugum) {
            const komsular = cizge.links
                .filter(l => l.source === suanki || l.target === suanki)
                .map(l => l.source === suanki ? l.target : l.source)
                .filter(n => !ziyaret.has(n));

            if (komsular.length === 0) return [];
            const sonraki = rng.secim(komsular);
            yol.push(sonraki);
            ziyaret.add(sonraki);
            suanki = sonraki;
            if (yol.length > 50) return [];
        }
        return yol;
    };

    for (let i = 0; i < (parametreler.iterations || 50); i++) {
        // İşi basit tutmak için ABC'nin rastgele arama varyasyonunu kullanıyoruz
        const yol = rastgeleYolUret();
        if (yol.length > 0) {
            const m = yolMetrikleriniHesapla(yol, cizge, baglantiHaritasi);
            const c = agirlikliMaliyetHesapla(m, parametreler);
            if (c < minimumMaliyet) {
                minimumMaliyet = c;
                enIyiYol = yol;
            }
        }
    }

    const metrikler = enIyiYol.length > 0 ? yolMetrikleriniHesapla(enIyiYol, cizge, baglantiHaritasi) : { weightedCost: Infinity };
    if (enIyiYol.length > 0) {
        // @ts-ignore
        metrikler.weightedCost = minimumMaliyet;
    }

    return {
        path: enIyiYol,
        // @ts-ignore
        metrics: metrikler,
        executionTime: performance.now() - baslamaZamani
    };
};
