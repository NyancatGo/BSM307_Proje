import React, { useState, useMemo } from 'react';
import { CizgeVerisi, AlgoritmaTipi, AlgoritmaParametreleri, Baglanti } from '../tipler';
import { genetikAlgoritmayiCalistir, karincaKolonisiCalistir, pekisirmeliOgrenmeCalistir, yapayAriKolonisiCalistir, kimlikGetir, istatistikHesapla, baglantiKontrol } from '../services/algoritmalar';

interface DeneyYurutucuProps {
    cizge: CizgeVerisi;
}

// ----------------------------------------------------------------------------
// VERİ MODELLERİ (TÜRKÇE)
// ----------------------------------------------------------------------------

// Ham Veri (Her bir koşu için)
interface KosumMetrigi {
    kosumId: number;
    maliyet: number | null; // Başarısız ise null
    sure: number | null;    // Başarısız ise null
    basarili: boolean;
    gerekce?: string;
    agirliklar: { wGecikme: number, wGuven: number, wKaynak: number };
    detaylar?: { delay: number, reliability: number, resourceCost: number };
    seed: number;
}

// Deney Sonucu Veri Modeli
interface TestSonucu {
    senaryoNo: number;
    kaynak: number;
    hedef: number;
    kullanilanBantGenisligi: number;
    algoritma: string;

    // İstatistikler
    istatistikler: {
        basariOrani: number;       // %0 - %100
        ortMaliyet: number | string;
        stdSapmaMaliyet: number | string;
        enIyiMaliyet: number | string;
        enKotuMaliyet: number | string;
        ortSure: number;
        stdSapmaSure: number;
        minSure: number;
        maxSure: number;
    };

    kosumlar: KosumMetrigi[];
    durum: string; // BAŞARILI, UYGUNSUZ, BAŞARISIZ
    gerekce: string;
}

// Ağırlık Profilleri (İsimler Türkçe)
const AGIRLIK_PROFILLERI = {
    DENGELI: { wGecikme: 0.34, wGuvenilirlik: 0.33, wKaynak: 0.33, etiket: "Dengeli (Balanced)" },
    GECIKME_ODAKLI: { wGecikme: 0.70, wGuvenilirlik: 0.15, wKaynak: 0.15, etiket: "Gecikme Odaklı (Delay)" },
    GUVENILIRLIK_ODAKLI: { wGecikme: 0.15, wGuvenilirlik: 0.70, wKaynak: 0.15, etiket: "Güvenilirlik Odaklı (Reliability)" },
    KAYNAK_ODAKLI: { wGecikme: 0.15, wGuvenilirlik: 0.15, wKaynak: 0.70, etiket: "Kaynak Odaklı (Resource)" }
};

// ----------------------------------------------------------------------------
// YARDIMCI FONKSİYONLAR
// ----------------------------------------------------------------------------

// Grafı belirli bant genişliğine göre filtreler (Darboğaz kontrolü)
const grafiFiltrele = (cizge: CizgeVerisi, minBantGenisligi: number): CizgeVerisi => {
    const filtrelenmisLinkler = cizge.links.filter(l => l.bandwidth >= minBantGenisligi);
    const komsuluk = new Map<number, Baglanti[]>();

    filtrelenmisLinkler.forEach(baglanti => {
        if (!komsuluk.has(baglanti.source)) komsuluk.set(baglanti.source, []);
        komsuluk.get(baglanti.source)!.push(baglanti);
        // İki yönlü ekleme (Graf görselleştirme yapısı gereği)
        if (!komsuluk.has(baglanti.target)) komsuluk.set(baglanti.target, []);
        komsuluk.get(baglanti.target)!.push({ ...baglanti, source: baglanti.target, target: baglanti.source });
    });

    return { ...cizge, links: filtrelenmisLinkler, adjacency: komsuluk };
};

// Widest Path Problem (Darboğaz Kapasitesi Bulma)
const maksimumKapasiteyiBul = (cizge: CizgeVerisi, s: number, d: number): number => {
    const genislikler = new Map<number, number>();
    const ziyaretEdilen = new Set<number>();

    cizge.nodes.forEach(n => genislikler.set(n.id, 0));
    genislikler.set(s, Infinity);

    while (ziyaretEdilen.size < cizge.nodes.length) {
        let maxW = -1;
        let u = -1;

        cizge.nodes.forEach(n => {
            if (!ziyaretEdilen.has(n.id)) {
                const w = genislikler.get(n.id) || 0;
                if (w > maxW) {
                    maxW = w;
                    u = n.id;
                }
            }
        });

        if (u === -1 || maxW === 0) break; // Ulaşılamaz
        if (u === d) return maxW;

        ziyaretEdilen.add(u);

        const komsular = cizge.adjacency.get(u) || [];
        komsular.forEach(baglanti => {
            const v = kimlikGetir(baglanti.target);
            const komsuId = v === u ? kimlikGetir(baglanti.source) : v;

            if (!ziyaretEdilen.has(komsuId)) {
                const bw = baglanti.bandwidth;
                const suankiW = Math.min(maxW, bw);
                if (suankiW > (genislikler.get(komsuId) || 0)) {
                    genislikler.set(komsuId, suankiW);
                }
            }
        });
    }
    return 0;
};

// ----------------------------------------------------------------------------
// ANA BİLEŞEN: DENEY YÜRÜTÜCÜ
// ----------------------------------------------------------------------------
const DeneyYurutucu: React.FC<DeneyYurutucuProps> = ({ cizge }) => {
    const [sonuclar, setSonuclar] = useState<TestSonucu[]>([]);
    const [calisiyor, setCalisiyor] = useState(false);
    const [loglar, setLoglar] = useState<string[]>([]);
    const [ilerleme, setIlerleme] = useState(0);
    const [gorunumModu, setGorunumModu] = useState<'tablo' | 'hatalar'>('tablo');
    const [seciliProfil, setSeciliProfil] = useState<keyof typeof AGIRLIK_PROFILLERI>('DENGELI');
    const [sonIslenenSeed, setSonIslenenSeed] = useState<string>('-');

    const algoritmalar = [
        { tip: AlgoritmaTipi.GENETIC, isim: 'GA' },
        { tip: AlgoritmaTipi.ACO, isim: 'ACO' },
        { tip: AlgoritmaTipi.Q_LEARNING, isim: 'Q-Learning' },
        { tip: AlgoritmaTipi.ABC, isim: 'ABC' }
    ];

    const mevcutAgirliklar = {
        ...AGIRLIK_PROFILLERI[seciliProfil],
        populationSize: 50, iterations: 50, ants: 20, epsilon: 0.1
    };

    const logEkle = (mesaj: string) => setLoglar(onceki => [...onceki.slice(-4), mesaj]);

    const deneyleriBaslat = async (mod: 'random' | 'csv' = 'random') => {
        setCalisiyor(true);
        setSonuclar([]);
        setLoglar(['Yol Analizleri Başlatılıyor...']);
        setIlerleme(0);
        setGorunumModu('tablo');

        // CSV Yükleme ve Parse İşlemi
        let senaryoListesi: { s: number, d: number, bw: number }[] = [];

        if (mod === 'csv') {
            try {
                setLoglar(prev => [...prev, "Veri seti indiriliyor: BSM307_317_Guz2025_TermProject_DemandData.csv"]);
                const response = await fetch('/BSM307_317_Guz2025_TermProject_DemandData.csv');
                if (!response.ok) throw new Error("CSV dosyası bulunamadı!");

                const text = await response.text();
                const lines = text.trim().split('\n'); // Satırlara ayır
                // İlk satır header (src;dst;demand_mbps) olduğu için atla
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const parts = line.split(';');
                    if (parts.length >= 3) {
                        senaryoListesi.push({
                            s: parseInt(parts[0]),
                            d: parseInt(parts[1]),
                            bw: parseInt(parts[2])
                        });
                    }
                }
                logEkle(`CSV Başarıyla Yüklendi: ${senaryoListesi.length} senaryo bulundu.`);
            } catch (err) {
                console.error(err);
                logEkle("HATA: CSV dosyası okunamadı! Rastgele senaryolara dönülüyor.");
                mod = 'random';
            }
        }

        setTimeout(async () => {
            const geciciSonuclar: TestSonucu[] = [];
            const N = cizge.nodes.length;
            const TOPLAM_SENARYO = mod === 'csv' ? senaryoListesi.length : 20;

            for (let i = 0; i < TOPLAM_SENARYO; i++) {
                let s, d, bantGenisligiTalebi;

                if (mod === 'csv') {
                    // CSV'den veriyi al
                    s = senaryoListesi[i].s;
                    d = senaryoListesi[i].d;
                    bantGenisligiTalebi = senaryoListesi[i].bw;
                } else {
                    // Rastgele Üret
                    s = Math.floor(Math.random() * N);
                    d = Math.floor(Math.random() * N);
                    while (d === s || !cizge.nodes[s] || !cizge.nodes[d]) {
                        s = Math.floor(Math.random() * N);
                        d = Math.floor(Math.random() * N);
                    }
                    bantGenisligiTalebi = Math.floor(Math.random() * 1000) + 1;
                }

                logEkle(`[${i + 1}/${TOPLAM_SENARYO}] ${mod === 'csv' ? '(CSV)' : '(RND)'} S:${s}->D:${d} (İstenen:${bantGenisligiTalebi} Mbps)`);

                const filtrelenmisGraf = grafiFiltrele(cizge, bantGenisligiTalebi);
                const yolVarMi = baglantiKontrol(filtrelenmisGraf, s, d);

                for (const alg of algoritmalar) {
                    if (!yolVarMi) {
                        geciciSonuclar.push({
                            senaryoNo: i + 1, kaynak: s, hedef: d, kullanilanBantGenisligi: bantGenisligiTalebi,
                            algoritma: alg.isim,
                            istatistikler: { basariOrani: 0, ortMaliyet: '-', stdSapmaMaliyet: '-', enIyiMaliyet: '-', enKotuMaliyet: '-', ortSure: 0, stdSapmaSure: 0, minSure: 0, maxSure: 0 },
                            kosumlar: [],
                            durum: "UYGUNSUZ",
                            gerekce: "Yetersiz Bant Genişliği (Fiziksel Yol Yok)"
                        });
                        continue;
                    }

                    const suankiKosumlar: KosumMetrigi[] = [];

                    for (let tekrar = 0; tekrar < 5; tekrar++) {
                        const baslamaT = performance.now();
                        const seed = Math.floor(Math.random() * 99999);
                        setSonIslenenSeed(seed.toString());
                        const guncelParametreler = { ...mevcutAgirliklar, seed };

                        let sonuc;
                        try {
                            // Algoritma Seçimi ve Çalıştırma
                            if (alg.tip === AlgoritmaTipi.GENETIC) sonuc = genetikAlgoritmayiCalistir(filtrelenmisGraf, s, d, guncelParametreler);
                            else if (alg.tip === AlgoritmaTipi.ACO) sonuc = karincaKolonisiCalistir(filtrelenmisGraf, s, d, guncelParametreler);
                            else if (alg.tip === AlgoritmaTipi.Q_LEARNING) sonuc = pekisirmeliOgrenmeCalistir(filtrelenmisGraf, s, d, guncelParametreler);
                            else sonuc = yapayAriKolonisiCalistir(filtrelenmisGraf, s, d, guncelParametreler);
                        } catch (e) {
                            sonuc = { path: [], metrics: { weightedCost: Infinity }, executionTime: 0 };
                        }
                        const bitisT = performance.now();
                        const sure = bitisT - baslamaT;

                        const basarili = sonuc.path && sonuc.path.length > 0 && sonuc.metrics.weightedCost !== Infinity;

                        suankiKosumlar.push({
                            kosumId: tekrar + 1,
                            basarili: !!basarili,
                            maliyet: basarili ? sonuc.metrics.weightedCost : null,
                            sure: basarili ? sure : null,
                            gerekce: basarili ? "Başarılı" : "Algoritma Yakınsayamadı / Zaman Aşımı",
                            agirliklar: { wGecikme: mevcutAgirliklar.wGecikme!, wGuven: mevcutAgirliklar.wGuvenilirlik!, wKaynak: mevcutAgirliklar.wKaynak! },
                            detaylar: basarili ? {
                                delay: sonuc.metrics.totalDelay || 0,
                                reliability: sonuc.metrics.totalReliability || 0,
                                resourceCost: sonuc.metrics.resourceCost || 0
                            } : undefined,
                            seed: seed
                        });

                        if (tekrar % 5 === 0) await new Promise(r => setTimeout(r, 0)); // UI Blocking Önleme
                    }

                    const basariliKosumlar = suankiKosumlar.filter(r => r.basarili);
                    const basariOrani = basariliKosumlar.length / 5;

                    const maliyetStats = istatistikHesapla(basariliKosumlar.map(r => r.maliyet as number));
                    const sureStats = istatistikHesapla(basariliKosumlar.map(r => r.sure as number));

                    geciciSonuclar.push({
                        senaryoNo: i + 1, kaynak: s, hedef: d, kullanilanBantGenisligi: bantGenisligiTalebi,
                        algoritma: alg.isim,
                        istatistikler: {
                            basariOrani,
                            ortMaliyet: basariliKosumlar.length ? maliyetStats.ortalama : '-',
                            stdSapmaMaliyet: basariliKosumlar.length ? maliyetStats.stdSapma : '-',
                            enIyiMaliyet: basariliKosumlar.length ? maliyetStats.min : '-',
                            enKotuMaliyet: basariliKosumlar.length ? maliyetStats.max : '-',
                            ortSure: basariliKosumlar.length ? sureStats.ortalama : 0,
                            stdSapmaSure: basariliKosumlar.length ? sureStats.stdSapma : 0,
                            minSure: basariliKosumlar.length ? sureStats.min : 0,
                            maxSure: basariliKosumlar.length ? sureStats.max : 0
                        },
                        kosumlar: suankiKosumlar,
                        durum: basariOrani === 1 ? "BAŞARILI" : basariOrani > 0 ? "KISMI BAŞARILI" : "BAŞARISIZ",
                        gerekce: basariOrani === 1 ? "Optimum Rota Bulundu" : basariOrani > 0 ? `Kısmi Başarı (${basariliKosumlar.length}/5)` : "Yol Bulunamadı"
                    });
                }
                setIlerleme(((i + 1) / TOPLAM_SENARYO) * 100);
            }

            setSonuclar(geciciSonuclar);
            setCalisiyor(false);
            logEkle(`Analiz Raporu Hazır (${AGIRLIK_PROFILLERI[seciliProfil].etiket}).`);
        }, 100);
    };

    const csvIndir = () => {
        let csv = `# Deney Raporu\n# Profil: ${AGIRLIK_PROFILLERI[seciliProfil].etiket}\n# Tarih: ${new Date().toLocaleString()}\n\n`;
        // Header: Senaryo + Algoritma + Metrik Ortalamaları + İstatistikler
        csv += "Senaryo,Kaynak,Hedef,Talep(Mbps),Algoritma,TekrarSayisi,Durum,BasariOrani(%),OrtSure(ms),MinSure(ms),MaxSure(ms),OrtGecikme(ms),OrtGuvenilirlik(%),OrtKaynakTuketimi,OrtMaliyet(Weighted),StdSapmaMaliyet,KullanilanSeedler\n";

        sonuclar.forEach(r => {
            const ist = r.istatistikler;
            const basariYuzdesi = (ist.basariOrani * 100).toFixed(0);

            // Metrik Ortalamalarını Hesapla (Sadece başarılı koşumlar)
            const basariliKosumlar = r.kosumlar.filter(k => k.basarili);
            const seedListesi = r.kosumlar.map(k => k.seed).join(";");

            const ortGecikme = basariliKosumlar.length ? (basariliKosumlar.reduce((acc, k) => acc + (k.detaylar?.delay || 0), 0) / basariliKosumlar.length).toFixed(2) : "-";
            const ortGuven = basariliKosumlar.length ? (basariliKosumlar.reduce((acc, k) => acc + (k.detaylar?.reliability || 0), 0) / basariliKosumlar.length * 100).toFixed(6) : "-"; // Yüzdelik gösterim
            const ortKaynak = basariliKosumlar.length ? (basariliKosumlar.reduce((acc, k) => acc + (k.detaylar?.resourceCost || 0), 0) / basariliKosumlar.length).toFixed(2) : "-";

            const row = [
                r.senaryoNo,
                r.kaynak,
                r.hedef,
                r.kullanilanBantGenisligi,
                r.algoritma,
                "5", // Tekrar Sayısı
                r.durum,
                basariYuzdesi,
                typeof ist.ortSure === 'number' ? ist.ortSure.toFixed(2) : ist.ortSure,
                typeof ist.minSure === 'number' ? ist.minSure.toFixed(2) : "-",
                typeof ist.maxSure === 'number' ? ist.maxSure.toFixed(2) : "-",
                ortGecikme, // Gecikme
                ortGuven,   // Güvenilirlik
                ortKaynak,  // Kaynak Tüketimi
                typeof ist.ortMaliyet === 'number' ? ist.ortMaliyet.toFixed(4) : ist.ortMaliyet, // Ağırlıklı Maliyet (En sonda)
                typeof ist.stdSapmaMaliyet === 'number' ? ist.stdSapmaMaliyet.toFixed(4) : ist.stdSapmaMaliyet, // Standart Sapma
                seedListesi // Tohumlar
            ].join(",");

            csv += row + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bsm307_ozet_analiz_${seciliProfil.toLowerCase()}.csv`;
        link.click();
    };

    const gruplanmisSonuclar = useMemo(() => {
        const gruplar = new Map<number, TestSonucu[]>();
        sonuclar.forEach(r => {
            if (!gruplar.has(r.senaryoNo)) gruplar.set(r.senaryoNo, []);
            gruplar.get(r.senaryoNo)?.push(r);
        });
        return Array.from(gruplar.values());
    }, [sonuclar]);

    // Hata Raporunda Uygunsuzlar VE Başarısızlar (veya kısmi başarılılar) görünsün
    const hatalar = sonuclar.filter(r => r.durum === 'UYGUNSUZ' || r.istatistikler.basariOrani < 1);

    // Global Özet İstatistikleri
    const toplamSenaryo = gruplanmisSonuclar.length;
    const uygunsuzSenaryo = gruplanmisSonuclar.filter(grup => grup[0].durum === "UYGUNSUZ").length;
    const gecerliSenaryo = toplamSenaryo - uygunsuzSenaryo;

    return (
        <div style={{
            position: 'fixed',
            top: '60px', left: '50%', transform: 'translateX(-50%)',
            width: '98%', maxHeight: '90vh',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            zIndex: 100,
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}>
            {/* BAŞLIK (HEADER) */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: '12px 12px 0 0' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#facc15', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📊 Deneysel Analiz ve Raporlama (Bölüm 6)
                    </h2>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                        value={seciliProfil}
                        onChange={(e) => setSeciliProfil(e.target.value as any)}
                        style={{ background: '#334155', color: 'white', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                        disabled={calisiyor}
                    >
                        {Object.entries(AGIRLIK_PROFILLERI).map(([anahtar, deger]) => (
                            <option key={anahtar} value={anahtar}>{deger.etiket}</option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', background: '#334155', padding: '2px', borderRadius: '6px', marginRight: '10px' }}>
                        <button onClick={() => setGorunumModu('tablo')} style={{ background: gorunumModu === 'tablo' ? '#2563eb' : 'transparent', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Sonuç Tablosu</button>
                        <button
                            onClick={() => setGorunumModu('hatalar')}
                            style={{ background: gorunumModu === 'hatalar' ? '#ef4444' : 'transparent', color: hatalar.length > 0 ? '#fca5a5' : '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            title={hatalar.length === 0 ? "Tüm senaryolar tam başarılı" : `${hatalar.length} sorunlu durum`}
                        >
                            Hata Raporu ({hatalar.length})
                        </button>
                    </div>

                    {!calisiyor && sonuclar.length > 0 && (
                        <button onClick={csvIndir} style={{ padding: '8px 14px', background: '#064e3b', color: '#34d399', border: '1px solid #059669', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                            CSV İndir
                        </button>
                    )}
                    <button
                        onClick={() => deneyleriBaslat('random')}
                        disabled={calisiyor}
                        style={{
                            padding: '8px 20px',
                            background: calisiyor ? '#334155' : 'linear-gradient(to right, #2563eb, #1d4ed8)',
                            color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px',
                            cursor: calisiyor ? 'not-allowed' : 'pointer',
                            minWidth: '100px'
                        }}
                    >
                        {calisiyor ? `%${ilerleme.toFixed(0)}` : 'Başlat (Rastgele)'}
                    </button>

                    <button
                        onClick={() => deneyleriBaslat('csv')}
                        disabled={calisiyor}
                        style={{
                            padding: '8px 20px',
                            background: calisiyor ? '#334155' : 'linear-gradient(to right, #d97706, #b45309)',
                            color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px',
                            cursor: calisiyor ? 'not-allowed' : 'pointer',
                            minWidth: '140px'
                        }}
                    >
                        Hazır Test Senaryoları
                    </button>
                    <button onClick={() => setSonuclar([])} style={{ padding: '8px', background: '#334155', color: '#f5f5f5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>X</button>
                </div>
            </div>

            {/* İÇERİK */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#0f172a' }}>

                {/* Özet Kutucukları */}
                {!calisiyor && sonuclar.length > 0 && gorunumModu === 'tablo' && (
                    <div style={{
                        display: 'flex', gap: '20px', marginBottom: '20px',
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '15px', position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: '-10px', left: '15px', fontSize: '10px', background: '#334155', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
                            Son İşlenen Seed: <span style={{ color: 'white' }}>{sonIslenenSeed}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>TOPLAM SENARYO</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>{toplamSenaryo}</div>
                        </div>
                        <div style={{ width: '1px', background: '#334155' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>GEÇERLİ (FEASIBLE)</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{gecerliSenaryo}</div>
                        </div>
                        <div style={{ width: '1px', background: '#334155' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>UYGUNSUZ (INFEASIBLE)</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{uygunsuzSenaryo}</div>
                        </div>
                        <div style={{ width: '1px', background: '#334155' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>TEKRAR/KOŞUM</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>5</div>
                        </div>
                    </div>
                )}

                {calisiyor && (
                    <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #1e40af', borderRadius: '8px', color: '#60a5fa', fontFamily: 'monospace', fontSize: '12px' }}>
                        {'>'} {loglar[loglar.length - 1]}
                    </div>
                )}

                {gorunumModu === 'hatalar' ? (
                    <div style={{ color: '#cbd5e1' }}>
                        <h3 style={{ borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '15px' }}>Uygunsuz / Başarısız Senaryo Detayları</h3>
                        {hatalar.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px' }}>
                                ✔ Hiçbir sorunlu durum tespit edilmedi. Tüm algoritmalar %100 başarılı.
                            </div>
                        ) : (
                            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#334155' }}>
                                        <th style={{ padding: '10px' }}>Senaryo</th>
                                        <th style={{ padding: '10px' }}>Kaynak ➔ Hedef (BW)</th>
                                        <th style={{ padding: '10px' }}>Algoritma</th>
                                        <th style={{ padding: '10px' }}>Durum</th>
                                        <th style={{ padding: '10px' }}>Gerekçe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hatalar.map((f, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #334155', background: f.durum.includes('BAŞARISIZ') ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.2)' }}>
                                            <td style={{ padding: '10px' }}>#{f.senaryoNo}</td>
                                            <td style={{ padding: '10px' }}>{f.kaynak} ➔ {f.hedef} ({f.kullanilanBantGenisligi} Mbps)</td>
                                            <td style={{ padding: '10px' }}>{f.algoritma}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: f.durum === 'UYGUNSUZ' ? '#fca5a5' : '#fbbf24' }}>{f.durum}</td>
                                            <td style={{ padding: '10px' }}>{f.gerekce}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                        {gruplanmisSonuclar.map((grup, idx) => {
                            const r = grup[0];
                            const uygunsuzMu = r.durum === "UYGUNSUZ";

                            if (uygunsuzMu) {
                                // A) UYGUNSUZ Senaryo Kartı
                                return (
                                    <div key={idx} style={{
                                        background: 'rgba(239, 68, 68, 0.05)',
                                        border: '1px solid #ef4444',
                                        borderRadius: '8px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', borderBottom: '1px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '12px' }}>Senaryo #{r.senaryoNo} (UYGUNSUZ)</span>
                                            <div style={{ fontSize: '11px', display: 'flex', gap: '10px' }}>
                                                <span style={{ color: '#fca5a5' }}>{r.kaynak} ➔ {r.hedef}</span>
                                                <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>{r.kullanilanBantGenisligi} Mbps</span>
                                            </div>
                                        </div>
                                        <div style={{ padding: '15px', color: '#fca5a5', fontSize: '12px', textAlign: 'center' }}>
                                            ⚠ {r.gerekce}
                                            <div style={{ fontSize: '10px', marginTop: '5px', opacity: 0.8 }}>(Metrik hesaplanamadı)</div>
                                        </div>
                                    </div>
                                );
                            }

                            // B) NORMAL Senaryo Kartı (Başarılı veya Kısmi Başarılı)
                            return (
                                <div key={idx} style={{
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                                }}>
                                    <div style={{ padding: '8px 12px', background: '#334155', borderBottom: '1px solid #475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold', color: '#e2e8f0', fontSize: '12px' }}>Senaryo #{r.senaryoNo}</span>
                                        <div style={{ fontSize: '11px', display: 'flex', gap: '10px' }}>
                                            <span style={{ color: '#94a3b8' }}>{r.kaynak} ➔ {r.hedef}</span>
                                            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{r.kullanilanBantGenisligi} Mbps</span>
                                        </div>
                                    </div>

                                    <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', color: '#cbd5e1' }}>
                                        <thead>
                                            <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                                                <th style={{ padding: '6px 10px' }}>ALGORİTMA</th>
                                                <th style={{ padding: '6px', textAlign: 'center' }}>BAŞARI</th>
                                                <th style={{ padding: '6px', textAlign: 'right' }}>MALİYET (Ort±σ)</th>
                                                <th style={{ padding: '6px', textAlign: 'right' }}>SÜRE (Ort±σ)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grup.map((satir, rIdx) => {
                                                const basariSayisi = satir.istatistikler.basariOrani * 5; // 5 koşumdan kaçı
                                                const basarisizMi = basariSayisi === 0;

                                                return (
                                                    <tr key={rIdx} style={{ borderBottom: rIdx !== grup.length - 1 ? '1px solid #334155' : 'none' }}>
                                                        <td style={{ padding: '6px 10px', fontWeight: 'bold', color: satir.algoritma === 'GA' ? '#facc15' : satir.algoritma === 'ACO' ? '#ef4444' : satir.algoritma === 'Q-Learning' ? '#a855f7' : '#3b82f6' }}>
                                                            {satir.algoritma}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'center', color: satir.istatistikler.basariOrani === 1 ? '#4ade80' : satir.istatistikler.basariOrani > 0 ? '#fbbf24' : '#f87171' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{basariSayisi}/5</div>
                                                            <div style={{ fontSize: '9px', opacity: 0.8 }}>(%{(satir.istatistikler.basariOrani * 100).toFixed(0)})</div>
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'right' }}>
                                                            {!basarisizMi && typeof satir.istatistikler.ortMaliyet === 'number' ? (
                                                                <>
                                                                    <div style={{ fontFamily: 'monospace' }}>{satir.istatistikler.ortMaliyet.toFixed(1)}<span style={{ color: '#64748b', fontSize: '9px' }}>±{typeof satir.istatistikler.stdSapmaMaliyet === 'number' ? satir.istatistikler.stdSapmaMaliyet.toFixed(1) : '-'}</span></div>
                                                                    <div style={{ fontSize: '9px', color: '#475569' }}>[{typeof satir.istatistikler.enIyiMaliyet === 'number' ? satir.istatistikler.enIyiMaliyet.toFixed(1) : '-'} - {typeof satir.istatistikler.enKotuMaliyet === 'number' ? satir.istatistikler.enKotuMaliyet.toFixed(1) : '-'}]</div>
                                                                </>
                                                            ) : <span style={{ color: '#64748b' }}>-</span>}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'right' }}>
                                                            {!basarisizMi ? (
                                                                <>
                                                                    <div style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{satir.istatistikler.ortSure.toFixed(0)}<span style={{ color: '#475569', fontSize: '9px' }}>±{satir.istatistikler.stdSapmaSure.toFixed(0)}</span></div>
                                                                    <div style={{ fontSize: '9px', color: '#475569' }}>[{satir.istatistikler.minSure.toFixed(0)} - {satir.istatistikler.maxSure.toFixed(0)}]</div>
                                                                </>
                                                            ) : <span style={{ color: '#64748b' }}>-</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: '15px', padding: '10px', background: '#1e293b', borderTop: '1px solid #334155', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
                    <div>
                        <strong>METRİKLER:</strong>
                        W_Gecikme:{mevcutAgirliklar.wGecikme.toFixed(2)}, W_Guven:{mevcutAgirliklar.wGuvenilirlik.toFixed(2)}, W_Kaynak:{mevcutAgirliklar.wKaynak.toFixed(2)}
                    </div>
                    <div style={{ fontFamily: 'monospace' }}>
                        Profil: {AGIRLIK_PROFILLERI[seciliProfil].etiket}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeneyYurutucu;
