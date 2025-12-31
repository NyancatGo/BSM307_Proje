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
 * İSTATİSTİKSEL ANALİZ MODÜLÜ
 * Bu fonksiyon, elde edilen sonuçların (gecikme, maliyet vb.) dağılım özelliklerini hesaplar.
 * Ortalama, minimum, maksimum ve standart sapma değerlerini döndürür.
 * Standart sapma, algoritmanın kararlılığını (sonuçların tutarlılığını) ölçmek için kritik bir metriktir.
 */
export const istatistikHesapla = (degerler: number[]) => {
    if (degerler.length === 0) return { ortalama: 0, stdSapma: 0, min: 0, max: 0 };
    const ortalama = degerler.reduce((a, b) => a + b, 0) / degerler.length;
    // Standart Sapma: Verilerin ortalamadan ne kadar saptığını gösterir. Düşük değer yüksek kararlılık anlamına gelir.
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
 * METRİK VE MALİYET ANALİZ FONKSİYONU
 * Verilen bir yolun (Path) performans metriklerini hesaplar.
 * - Toplam Gecikme (Latency)
 * - Toplam Güvenilirlik (Reliability)
 * - Kaynak Maliyeti (Resource Cost)
 * 
 * NOT: Bu fonksiyon ham metrikleri çıkarır. Ağırlıklandırma işlemi 'agirlikliMaliyetHesapla' fonksiyonunda yapılır.
 */
const yolMetrikleriniHesapla = (yol: number[], cizge: CizgeVerisi, baglantiHaritasi?: Map<string, Baglanti>) => {
    let toplamGecikme = 0;
    let toplamLogGuvenilirlik = 0; // İşlem kolaylığı için logaritmik toplama yöntemi kullanılır.
    let toplamKaynakMaliyeti = 0;
    let hamGuvenilirlik = 1.0;

    for (let i = 0; i < yol.length - 1; i++) {
        const u = yol[i];
        const v = yol[i + 1];

        // VERİ ERİŞİM OPTİMİZASYONU (O(1) Lookup)
        // Bağlantı verilerine erişmek için Hash Map yapısı kullanılır, bu sayede döngü içi arama maliyeti minimize edilir.
        let baglanti: Baglanti | undefined;

        if (baglantiHaritasi) {
            baglanti = baglantiHaritasi.get(`${u}-${v}`) || baglantiHaritasi.get(`${v}-${u}`);
        } else {
            // Harita mevcut değilse lineer arama yapılır (O(N) Fallback)
            baglanti = cizge.links.find(l => (l.source === u && l.target === v) || (l.source === v && l.target === u));
        }

        const hedefDugum = cizge.nodes.find(n => n.id === v);

        if (baglanti && hedefDugum) {
            // 1. GECİKME: İletim gecikmesi ve düğüm işlem süresi toplanır.
            toplamGecikme += baglanti.propagationDelay + (hedefDugum.processingDelay || 0);

            // 2. GÜVENİLİRLİK: Önceden hesaplanmış Logaritmik değerler kullanılır (CPU Optimizasyonu).
            const logRel = baglanti.logReliability ?? -Math.log(Math.max(0.0001, baglanti.reliability || 0.99));
            const dGuven = Math.max(0.0001, hedefDugum.reliability || 0.99);

            toplamLogGuvenilirlik += logRel + (-Math.log(dGuven));
            hamGuvenilirlik *= ((baglanti.reliability || 0.99) * dGuven);

            // 3. MALİYET: Bant genişliği ile ters orantılıdır (Yüksek bant genişliği = Düşük birim maliyet).
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

// PERFORMANS OPTİMİZASYONU: ÖN HESAPLAMA VE HIZLI ERİŞİM HARİTASI
// Hesaplama yoğunluğunu azaltmak için (Logaritma, Bölme vb.) işlemler önceden yapılır (Pre-calculation).
// Ayrıca O(1) erişim süresi için HashMap yapısı oluşturulur.
const haritaOlustur = (links: Baglanti[]): Map<string, Baglanti> => {
    const map = new Map<string, Baglanti>();
    links.forEach(l => {
        // ÖN HESAPLAMA (PRE-CALCULATION)
        // Algoritma esnasında tekrarlanan matematiksel işlemler burada bir kez yapılır ve saklanır.
        const logRel = -Math.log(Math.max(0.0001, l.reliability || 0.99));
        const resCost = 1000 / (l.bandwidth || 100);

        const linkWithMets = { ...l, logReliability: logRel, resourceCost: resCost };

        map.set(`${l.source}-${l.target}`, linkWithMets);
        // Yönsüz graf varsayımı ile ters yön de eklenir.
        map.set(`${l.target}-${l.source}`, linkWithMets);
    });
    return map;
};

/**
 * AĞIRLIKLI MALİYET HESAPLAMA (WEIGHTED COST FUNCTION)
 * Kullanıcı tarafından belirlenen ağırlık katsayılarını (QoS Gereksinimleri) kullanarak
 * her yol için tek bir başarı puanı (Score) üretir.
 * - Amaç: Minimum maliyet değerine ulaşmaktır (Minimizasyon Problemi).
 */
const agirlikliMaliyetHesapla = (metrikler: any, parametreler: AlgoritmaParametreleri) => {
    const wD = parametreler.wGecikme ?? 0.33;
    const wR = parametreler.wGuvenilirlik ?? 0.33;
    const wK = parametreler.wKaynak ?? 0.33;

    const toplamAgirlik = wD + wR + wK;
    // NORMALİZASYON: Ağırlıkların toplamı 1 olacak şekilde normalize edilir.
    const normD = toplamAgirlik === 0 ? 0.33 : wD / toplamAgirlik;
    const normR = toplamAgirlik === 0 ? 0.33 : wR / toplamAgirlik;
    const normK = toplamAgirlik === 0 ? 0.33 : wK / toplamAgirlik;

    return (
        (normD * metrikler.totalDelay) +
        (normR * metrikler.totalLogRel * 100) +
        (normK * metrikler.resourceCost) +
        // HOP CEZASI (PENALTY): Gereksiz uzun yolları (fazla düğüm sayısı) engellemek için ceza puanı eklenir.
        ((metrikler.hopCount || 0) * 50)
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
    const baslamaZamani = performance.now();  // Çalıştırma süresi ölçümü için.
    const rng = new TohumluRNG(parametreler.seed ?? Math.floor(Math.random() * 99999));
    const baglantiHaritasi = haritaOlustur(cizge.links);

    // Hedef düğümün koordinatlarını buluyoruz
    const hedefNode = cizge.nodes.find(n => n.id === bitisDugum);

    // OPTİMİZE EDİLMİŞ BAŞLANGIÇ POPÜLASYONU (HEURISTIC INITIALIZATION)
    // Geleneksel GA'nın aksine, başlangıç popülasyonu tamamen rastgele oluşturulmaz.
    // Hedefe yakınlığı (Distance Heuristic) göz önüne alarak "kaliteli" adaylarla başlanır.
    // Bu yöntem, algoritmanın yakınsama (convergence) hızını artırır.
    const rastgeleYolOlustur = (): number[] => {
        let yol = [baslangicDugum];
        let suanki = baslangicDugum;
        let ziyaretEdilen = new Set([baslangicDugum]);
        let deneme = 0;

        while (suanki !== bitisDugum && deneme < 100) {
            deneme++;
            const komsular = cizge.links
                .filter(l => l.source === suanki || l.target === suanki)
                .map(l => l.source === suanki ? l.target : l.source);

            // Ziyaret edilmemiş geçerli komşular
            const gecerli = komsular.filter(n => !ziyaretEdilen.has(n));

            if (gecerli.length === 0) break; // Çıkmaz sokak

            // --- SEZGİSEL YÖNLENDİRME (HEURISTIC GUIDANCE) ---
            // Rastgele seçim yerine, hedefe olan mesafeye dayalı olasılıksal seçim yapılır.

            // 1. Uygunluk Değeri (Fitness Score): 1 / Mesafe^4
            // Hedefe yakın düğümlerin seçilme olasılığı üstel olarak artar.
            const adaylar = gecerli.map(k => {
                const k_node = cizge.nodes.find(n => n.id === k);
                const dist = (k_node && hedefNode) ? mesafeHesapla(k_node, hedefNode) : 99999;
                return { id: k, score: Math.pow(1 / (dist + 1), 4) };
            });

            // 2. Rulet Seçimi
            const toplamSkor = adaylar.reduce((sum, item) => sum + item.score, 0);
            let sans = rng.siradaki() * toplamSkor;
            let sonraki = gecerli[0];

            for (const aday of adaylar) {
                sans -= aday.score;
                if (sans <= 0) {
                    sonraki = aday.id;
                    break;
                }
            }

            // 3. Mutasyon (%20 Rastgelelik) - Genetik Çeşitlilik İçin Şart
            if (rng.siradaki() < 0.2) {
                sonraki = rng.secim(gecerli);
            }

            yol.push(sonraki);
            ziyaretEdilen.add(sonraki);
            suanki = sonraki;
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

                // OLASILIKSAL GEÇİŞ FONKSİYONU (PROBABILISTIC TRANSITION)
                // Karıncanın bir sonraki düğümü seçme olasılığı iki faktöre bağlıdır:
                // 1. Feromon Miktarı (Tau): Geçmiş tecrübelerden gelen bilgi.
                // 2. Sezgisel Bilgi (Eta): Hedefe olan fiziksel yakınlık (1/Distance).
                const olasiliklar = komsular.map(n => {
                    const tau = feromonGetir(suanki, n);
                    const hedefD = cizge.nodes.find(node => node.id === bitisDugum);
                    const komsuD = cizge.nodes.find(node => node.id === n);
                    const mesafe = (hedefD && komsuD) ? mesafeHesapla(komsuD, hedefD) : 1;
                    const eta = 1 / (mesafe + 0.1); // Kısa mesafe avantaj sağlar.
                    return Math.pow(tau, 1.0) * Math.pow(eta, 2.0); // Sezgisel bilgiye (Eta) ağırlık verilmiştir (Beta=2).
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

    // SEZGİSEL Q-DEĞERİ BAŞLATMA (HEURISTIC Q-INITIALIZATION)
    // Standart Q-Learning'de başlangıç değerleri 0'dır (Cold Start).
    // Burada ise, henüz ziyaret edilmemiş durumlara hedefe olan mesafeye göre tahmini bir Q değeri atanır.
    // Bu yöntem ajanın keşif sürecini (Exploration) hedefe doğru yönlendirir.
    const hedefNode = cizge.nodes.find(n => n.id === bitisDugum);

    const qGetir = (s: number, a: number) => {
        if (Q.has(`${s}-${a}`)) return Q.get(`${s}-${a}`)!;

        // HİÇ GİDİLMEMİŞ ROTA İÇİN TAHMİN (Heuristic)
        const nodeA = cizge.nodes.find(n => n.id === a);
        if (nodeA && hedefNode) {
            const mesafe = mesafeHesapla(nodeA, hedefNode);
            // Hedefe yakınsa yüksek (100), uzaksa düşük puan ver.
            return 1000 / (mesafe + 1);
        }
        return 0.0;
    };

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

    // Hedef düğümün koordinatlarını buluyoruz (Arılar yönünü bilsin diye)
    const hedefNode = cizge.nodes.find(n => n.id === bitisDugum);

    // AĞIRLIKLI RASTGELE YÜRÜYÜŞ (WEIGHTED RANDOM WALK)
    // Standart rastgele yürüyüş yerine, hedefe daha yakın düğümlerin seçilme ihtimali yüksektir.
    // Bu, arıların arama uzayını (Search Space) daha verimli kullanmasını sağlar.
    const rastgeleYolUret = (): number[] => {
        let yol = [baslangicDugum];
        let suanki = baslangicDugum;
        let ziyaret = new Set([baslangicDugum]);
        let denemeSayisi = 0;

        // Sonsuz döngü koruması
        while (suanki !== bitisDugum && denemeSayisi < 100) {
            denemeSayisi++;

            const komsular = cizge.links
                .filter(l => l.source === suanki || l.target === suanki)
                .map(l => l.source === suanki ? l.target : l.source)
                .filter(n => !ziyaret.has(n));

            if (komsular.length === 0) return []; // Çıkmaz sokak

            // --- AKILLI SEÇİM MANTIĞI ---

            // 1. Tüm komşuların hedefe olan kuş bakışı (3D) mesafesini ölçüyoruz.
            // Arılar hedefe daha yakın olan çiçekleri (düğümleri) daha çok sever.
            const adaylar = komsular.map(komsuId => {
                const komsuNode = cizge.nodes.find(n => n.id === komsuId);
                // Eğer node bulunamazsa uzakta varsay
                const mesafe = (komsuNode && hedefNode) ? mesafeHesapla(komsuNode, hedefNode) : 99999;
                return { id: komsuId, mesafe };
            });

            // 2. Bir "Çekim Gücü" (Fitness) puanı hesaplıyoruz.
            // Formül: 1 / (Mesafe ^ 2)
            // Bu formül sayesinde, hedefe yakın olanların seçilme şansı karesiyle artar.
            // Yani arı, hedefe 10 metre uzaktaki çiçeği, 20 metre uzaktakine göre 4 kat daha çok ister.
            const puanlar = adaylar.map(a => Math.pow(1 / (a.mesafe + 1), 4));

            // 3. Rulet Tekerleği Yöntemi (Roulette Wheel Selection) ile seçim yapıyoruz.
            // En yüksek puanlıyı kesin seçmeyiz (bu Genetic Algoritma olurdu), şans veririz.
            // Böylece arı bazen yolu uzatsa da genellikle doğru yöne uçar.
            const toplamPuan = puanlar.reduce((a, b) => a + b, 0);
            let sans = rng.siradaki() * toplamPuan;
            let secilen = komsular[0];

            for (let i = 0; i < komsular.length; i++) {
                sans -= puanlar[i];
                if (sans <= 0) {
                    secilen = komsular[i];
                    break;
                }
            }

            // 4. KAŞİFLİK RUHU (%20)
            // Arılar bazen (%20 ihtimalle) kokuyu görmezden gelip tamamen rastgele uçarlar.
            // Bu sayede "Local Optimum" denilen tuzak çukurlara düşmekten kurtulurlar.
            // Eğer bunu yapmazsak arı bir duvara toslayıp orada kalabilir.
            if (rng.siradaki() < 0.2) {
                secilen = rng.secim(komsular);
            }

            yol.push(secilen);
            ziyaret.add(secilen);
            suanki = secilen;

            if (yol.length > 50) return []; // Çok uzadıysa iptal et
        }
        return suanki === bitisDugum ? yol : [];
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
