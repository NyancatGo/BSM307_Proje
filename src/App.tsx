import React, { useEffect, useState } from "react";
import DunyaHaritasi from "./components/DunyaHaritasi";
import DeneyYurutucu from "./components/DeneyYurutucu";
import { AlgoritmaTipi, CizgeVerisi, YolSonucu, Baglanti } from "./tipler";
import { yapayAriKolonisiCalistir, karincaKolonisiCalistir, genetikAlgoritmayiCalistir, pekisirmeliOgrenmeCalistir } from "./services/algoritmalar";
import {
    AdjustmentsHorizontalIcon,
    ChartBarIcon,
    MapIcon,
    PlayIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from "@heroicons/react/24/outline";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

// Ağırlık ve Talep Veri Tipleri
type Agirliklar = { wGecikme: number; wGuvenilirlik: number; wKaynak: number };
type Talep = { kaynak: number; hedef: number; bantGenisligi: number };

const App: React.FC = () => {
    // Grafik Verisi
    const [graf, setGraf] = useState<CizgeVerisi | null>(null);
    const [haritaYukleniyor, setHaritaYukleniyor] = useState(true);

    // Test Senaryoları (CSV'den okunur)
    const [talepler, setTalepler] = useState<Talep[]>([]);

    // Kullanıcı Seçimleri
    const [baslangicDugum, setBaslangicDugum] = useState<number>(8);
    const [bitisDugum, setBitisDugum] = useState<number>(44);
    const [minBantGenisligi, setMinBantGenisligi] = useState<number>(0);
    const [seciliAlgoritma, setSeciliAlgoritma] = useState<AlgoritmaTipi>(AlgoritmaTipi.GENETIC);
    const [otomatikDonus, setOtomatikDonus] = useState<boolean>(true);

    // Algoritma Ağırlıkları (Gecikme, Güvenilirlik, Kaynak)
    const [agirliklar, setAgirliklar] = useState<Agirliklar>({
        wGecikme: 0.34,
        wGuvenilirlik: 0.33,
        wKaynak: 0.33
    });

    // Hesaplama Sonuçları
    const [sonuc, setSonuc] = useState<YolSonucu | null>(null);
    const [hesaplamaYapiyor, setHesaplamaYapiyor] = useState(false);

    // UI Durumları
    const [ayarlarAcik, setAyarlarAcik] = useState(true);
    const [sonuclarAcik, setSonuclarAcik] = useState(true);
    const [kiyaslamaGoster, setKiyaslamaGoster] = useState(false);
    const [testModuGoster, setTestModuGoster] = useState(false);
    const [kiyaslamaVerisi, setKiyaslamaVerisi] = useState<any[]>([]);

    useEffect(() => {
        const haritaGetir = async () => {
            try {
                setHaritaYukleniyor(true);

                // --- 1. DÜĞÜM (NODE) VERİLERİNİ YÜKLE ---
                const nodeResponse = await fetch("/BSM307_317_Guz2025_TermProject_NodeData.csv");
                const nodeText = await nodeResponse.text();
                const nodeLines = nodeText.trim().split('\n').slice(1); // Başlığı atla

                const dugumler = nodeLines.map((line, idx) => {
                    const [id, s_ms, r_node] = line.split(';');
                    // Koordinatlar WorldMap componentinde Fibonacci küresi ile atanacak (sabitVeri)
                    // Burada sadece ham veriyi parse ediyoruz.
                    return {
                        id: parseInt(id),
                        x: 0, y: 0, z: 0, // Placeholder
                        processingDelay: parseFloat(s_ms.replace(',', '.')),
                        reliability: parseFloat(r_node.replace(',', '.'))
                    };
                });

                console.log(`✅ ${dugumler.length} düğüm yüklendi.`);

                // --- 2. BAĞLANTI (LINK/EDGE) VERİLERİNİ YÜKLE ---
                const edgeResponse = await fetch("/BSM307_317_Guz2025_TermProject_EdgeData.csv");
                const edgeText = await edgeResponse.text();
                const edgeLines = edgeText.trim().split('\n').slice(1);

                const baglantilar = edgeLines.map(line => {
                    const [src, dst, capacity, delay, reliability] = line.split(';');
                    return {
                        source: parseInt(src),
                        target: parseInt(dst),
                        bandwidth: parseFloat(capacity), // Mbps
                        propagationDelay: parseFloat(delay.replace(',', '.')), // ms
                        reliability: parseFloat(reliability.replace(',', '.'))
                    };
                });

                console.log(`✅ ${baglantilar.length} bağlantı yüklendi.`);

                // --- 3. KOMŞULUK HARİTASI (Adjacency Map) OLUŞTUR ---
                const komsuluk = new Map<number, Baglanti[]>();

                baglantilar.forEach(link => {
                    // Kaynak -> Hedef
                    if (!komsuluk.has(link.source)) komsuluk.set(link.source, []);
                    komsuluk.get(link.source)!.push(link);

                    // Hedef -> Kaynak (Yönsüz Graf Varsayımı)
                    if (!komsuluk.has(link.target)) komsuluk.set(link.target, []);
                    komsuluk.get(link.target)!.push({
                        ...link,
                        source: link.target,
                        target: link.source
                    });
                });

                // --- 4. GRAF VERİSİNİ STATE'E KAYDET ---
                const grafVerisi: CizgeVerisi = {
                    nodes: dugumler,
                    links: baglantilar,
                    adjacency: komsuluk
                };

                setGraf(grafVerisi);

                // --- 5. TEST SENARYOLARINI (DEMANDS) YÜKLE ---
                try {
                    const demandResponse = await fetch("/BSM307_317_Guz2025_TermProject_DemandData.csv");
                    const demandText = await demandResponse.text();
                    const demandLines = demandText.trim().split('\n').slice(1);

                    const yuklenenTalepler = demandLines.map(line => {
                        const [src, dst, bw] = line.split(';');
                        return {
                            kaynak: parseInt(src),
                            hedef: parseInt(dst),
                            bantGenisligi: parseFloat(bw)
                        };
                    });

                    setTalepler(yuklenenTalepler);
                    console.log(`✅ ${yuklenenTalepler.length} test senaryosu yüklendi.`);

                    // İlk senaryoyu varsayılan olarak seç
                    if (yuklenenTalepler.length > 0) {
                        setBaslangicDugum(yuklenenTalepler[0].kaynak);
                        setBitisDugum(yuklenenTalepler[0].hedef);
                        setMinBantGenisligi(yuklenenTalepler[0].bantGenisligi);
                    }
                } catch (e) {
                    console.warn('Talep verisi bulunamadı, varsayılanlar kullanılacak.');
                }

            } catch (e) {
                console.error("❌ Veri Yükleme Hatası:", e);
            } finally {
                setHaritaYukleniyor(false);
            }
        };

        haritaGetir();
    }, []);

    // Yardımcı: Bant Genişliğine Göre Filtreleme
    const grafiFiltrele = (g: CizgeVerisi, bw: number): CizgeVerisi => {
        if (bw <= 0) return g;
        const filtrelenmisLinkler = g.links.filter(l => l.bandwidth >= bw);

        // Adjacency Map'i de güncelle
        const komsuluk = new Map<number, Baglanti[]>();
        filtrelenmisLinkler.forEach(link => {
            if (!komsuluk.has(link.source)) komsuluk.set(link.source, []);
            komsuluk.get(link.source)!.push(link);

            if (!komsuluk.has(link.target)) komsuluk.set(link.target, []);
            komsuluk.get(link.target)!.push({
                ...link,
                source: link.target,
                target: link.source
            });
        });

        return { ...g, links: filtrelenmisLinkler, adjacency: komsuluk };
    };

    // Seçilen Algoritmayı Çalıştır
    const algoritmaIleHesapla = (algo: AlgoritmaTipi, g: CizgeVerisi, src: number, dst: number, w: Agirliklar) => {
        let sonuc: any;
        let isim = "Bilinmiyor";

        if (algo === AlgoritmaTipi.GENETIC) {
            sonuc = genetikAlgoritmayiCalistir(g, src, dst, w);
            isim = "Genetik Algoritma (GA)";
        } else if (algo === AlgoritmaTipi.ACO) {
            sonuc = karincaKolonisiCalistir(g, src, dst, w);
            isim = "Karınca Kolonisi (ACO)";
        } else if (algo === AlgoritmaTipi.Q_LEARNING) {
            sonuc = pekisirmeliOgrenmeCalistir(g, src, dst, w);
            isim = "Q-Learning (Pekiştirmeli Öğrenme)";
        } else if (algo === AlgoritmaTipi.ABC) {
            sonuc = yapayAriKolonisiCalistir(g, src, dst, w);
            isim = "Yapay Arı Kolonisi (ABC)";
        } else {
            return {
                path: [],
                metrics: { totalDelay: 0, totalReliability: 0, resourceCost: 0, weightedCost: 0 },
                executionTime: 0,
                algorithmName: "Bilinmiyor"
            } as YolSonucu;
        }

        return { ...sonuc, algorithmName: isim };
    };

    // "Hesapla" Butonu Tetikleyicisi
    const hesaplaButonunaBasildi = () => {
        if (!graf) return;
        setHesaplamaYapiyor(true);

        window.setTimeout(() => {
            // Filtrelenmiş Graf Üzerinde Çalış
            const aktifGraf = grafiFiltrele(graf, minBantGenisligi);
            const sonuc = algoritmaIleHesapla(seciliAlgoritma, aktifGraf, baslangicDugum, bitisDugum, agirliklar);
            setSonuc(sonuc);

            setKiyaslamaGoster(false);
            setSonuclarAcik(true);
            setHesaplamaYapiyor(false);
        }, 300);
    };

    // "Tümünü Kıyasla" Butonu Tetikleyicisi
    const kiyaslaButonunaBasildi = () => {
        if (!graf) return;
        setHesaplamaYapiyor(true);

        window.setTimeout(() => {
            const aktifGraf = grafiFiltrele(graf, minBantGenisligi);
            const algoritmalar: AlgoritmaTipi[] = [
                AlgoritmaTipi.GENETIC,
                AlgoritmaTipi.ACO,
                AlgoritmaTipi.Q_LEARNING,
                AlgoritmaTipi.ABC
            ];

            const iterasyon = 5; // Stabil sonuç için 5 tekrar
            const ortalamaSonuclar = algoritmalar.map((algo) => {
                let minMaliyet = Infinity;
                let enIyiKosum: YolSonucu | null = null;

                for (let i = 0; i < iterasyon; i++) {
                    const res = algoritmaIleHesapla(algo, aktifGraf, baslangicDugum, bitisDugum, agirliklar);
                    const c = res.metrics.weightedCost;

                    if (c < minMaliyet) {
                        minMaliyet = c;
                        enIyiKosum = res;
                    }
                }

                let kisaAd = "??";
                if (algo === AlgoritmaTipi.GENETIC) kisaAd = "GA";
                else if (algo === AlgoritmaTipi.ACO) kisaAd = "ACO";
                else if (algo === AlgoritmaTipi.Q_LEARNING) kisaAd = "RL"; // Q-Learning -> RL
                else if (algo === AlgoritmaTipi.ABC) kisaAd = "ABC";

                return {
                    name: kisaAd, // Grafik için kısa isim
                    fullName: enIyiKosum?.algorithmName || algo, // Tooltip için uzun isim
                    res: enIyiKosum!,
                    cost: enIyiKosum!.metrics.weightedCost,
                    color:
                        algo === AlgoritmaTipi.GENETIC
                            ? "#facc15" // Yellow
                            : algo === AlgoritmaTipi.ACO
                                ? "#ef4444" // Red
                                : algo === AlgoritmaTipi.Q_LEARNING
                                    ? "#a855f7" // Purple
                                    : "#3b82f6" // Blue
                };
            });

            // En düşük maliyetli algoritma en üstte olsun
            ortalamaSonuclar.sort((a, b) => a.cost - b.cost);
            setKiyaslamaVerisi(ortalamaSonuclar);

            if (ortalamaSonuclar[0].res) setSonuc(ortalamaSonuclar[0].res);

            setKiyaslamaGoster(true);
            setSonuclarAcik(true);
            setHesaplamaYapiyor(false);
        }, 1000);
    };

    // Ağırlık Slider Kontrolü
    const agirlikNormalizasyonu = (tip: "gecikme" | "guven" | "kaynak", deger: number) => {
        const yeniDeger = Math.min(Math.max(deger, 0), 1);
        const kalan = 1 - yeniDeger;

        let yeniAgirliklar = { ...agirliklar };

        if (tip === "gecikme") {
            yeniAgirliklar.wGecikme = yeniDeger;
            const digerToplam = yeniAgirliklar.wGuvenilirlik + yeniAgirliklar.wKaynak;
            if (digerToplam === 0) {
                yeniAgirliklar.wGuvenilirlik = kalan / 2;
                yeniAgirliklar.wKaynak = kalan / 2;
            } else {
                yeniAgirliklar.wGuvenilirlik = (yeniAgirliklar.wGuvenilirlik / digerToplam) * kalan;
                yeniAgirliklar.wKaynak = (yeniAgirliklar.wKaynak / digerToplam) * kalan;
            }
        } else if (tip === "guven") {
            yeniAgirliklar.wGuvenilirlik = yeniDeger;
            const digerToplam = yeniAgirliklar.wGecikme + yeniAgirliklar.wKaynak;
            if (digerToplam === 0) {
                yeniAgirliklar.wGecikme = kalan / 2;
                yeniAgirliklar.wKaynak = kalan / 2;
            } else {
                yeniAgirliklar.wGecikme = (yeniAgirliklar.wGecikme / digerToplam) * kalan;
                yeniAgirliklar.wKaynak = (yeniAgirliklar.wKaynak / digerToplam) * kalan;
            }
        } else if (tip === "kaynak") {
            yeniAgirliklar.wKaynak = yeniDeger;
            const digerToplam = yeniAgirliklar.wGecikme + yeniAgirliklar.wGuvenilirlik;
            if (digerToplam === 0) {
                yeniAgirliklar.wGecikme = kalan / 2;
                yeniAgirliklar.wGuvenilirlik = kalan / 2;
            } else {
                yeniAgirliklar.wGecikme = (yeniAgirliklar.wGecikme / digerToplam) * kalan;
                yeniAgirliklar.wGuvenilirlik = (yeniAgirliklar.wGuvenilirlik / digerToplam) * kalan;
            }
        }

        yeniAgirliklar.wGecikme = parseFloat(yeniAgirliklar.wGecikme.toFixed(2));
        yeniAgirliklar.wGuvenilirlik = parseFloat(yeniAgirliklar.wGuvenilirlik.toFixed(2));
        yeniAgirliklar.wKaynak = parseFloat(yeniAgirliklar.wKaynak.toFixed(2));

        setAgirliklar(yeniAgirliklar);
    };

    if (haritaYukleniyor)
        return (
            <div
                style={{
                    backgroundColor: "black",
                    height: "100vh",
                    color: "white",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <div>Veriler Yükleniyor...</div>
            </div>
        );

    if (!graf)
        return (
            <div
                style={{
                    backgroundColor: "black",
                    height: "100vh",
                    color: "white",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                Veri Yükleme Hatası: Graf verisi oluşmadı.
            </div>
        );

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "black",
                color: "#e2e8f0",
                overflow: "hidden",
                fontFamily: "Inter, sans-serif"
            }}
        >
            {/* ARKAPLAN: 3D DÜNYA HARİTASI */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%" }}>
                <DunyaHaritasi
                    graf={graf}
                    yolSonucu={sonuc ? sonuc.path : []}
                    baslangicDugum={baslangicDugum}
                    bitisDugum={bitisDugum}
                    otomatikDonus={otomatikDonus}
                    algoritmaAdi={sonuc?.algorithmName || "Seçim Bekleniyor"}
                    istatistikler={sonuc?.metrics}
                />
            </div>

            {/* BAŞLIK ÇUBUĞU */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    padding: "20px",
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
                    zIndex: 10,
                    pointerEvents: "none"
                }}
            >
                <h1
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "26px",
                        fontWeight: "800",
                        color: "white",
                        margin: 0,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        letterSpacing: "-1px"
                    }}
                >
                    <MapIcon style={{ width: "28px", height: "28px", color: "#3b82f6" }} />
                    <span style={{ background: "linear-gradient(to right, #fff, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        QOS PROJECT
                    </span>
                    <span style={{
                        color: "#475569",
                        fontWeight: 400,
                        fontSize: "12px",
                        border: "1px solid #334155",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontFamily: "monospace",
                        letterSpacing: "1px"
                    }}>
                        BSM307
                    </span>
                </h1>
            </div>

            {/* SOL PANEL: AYARLAR */}
            <div style={{ position: "absolute", top: "100px", left: "20px", width: ayarlarAcik ? "320px" : "50px", zIndex: 20, transition: "width 0.3s" }}>
                <div style={{ backgroundColor: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(12px)", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div onClick={() => setAyarlarAcik(!ayarlarAcik)} style={{ padding: "16px", backgroundColor: "rgba(30, 41, 59, 0.5)", cursor: "pointer", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {ayarlarAcik ? (
                            <span style={{ fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
                                <AdjustmentsHorizontalIcon style={{ width: "20px" }} /> Kontrol Paneli
                            </span>
                        ) : (
                            <AdjustmentsHorizontalIcon style={{ width: "24px", color: "#60a5fa", margin: "0 auto" }} />
                        )}
                    </div>

                    {ayarlarAcik && (
                        <div style={{
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            maxHeight: "calc(100vh - 160px)",
                            overflowY: "auto"
                        }}>
                            {/* TALEP SEÇİMİ */}
                            {talepler.length > 0 && (
                                <div>
                                    <label style={{ display: "block", fontSize: "11px", textTransform: "uppercase", color: "#facc15", fontWeight: "bold", marginBottom: "6px", letterSpacing: "0.5px" }}>
                                        Test Senaryoları
                                    </label>
                                    <select
                                        className="w-full bg-slate-900 border border-yellow-600/50 rounded-lg p-2 text-xs text-yellow-100 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none transition-all"
                                        onChange={(e) => {
                                            const idx = parseInt(e.target.value);
                                            setBaslangicDugum(talepler[idx].kaynak);
                                            setBitisDugum(talepler[idx].hedef);
                                            setMinBantGenisligi(talepler[idx].bantGenisligi);
                                        }}
                                        style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                                    >
                                        {talepler.map((d, i) => (
                                            <option key={i} value={i}>
                                                #{i + 1}: {d.kaynak} ➔ {d.hedef} ({d.bantGenisligi} Mbps)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* ALGORİTMA SEÇİMİ */}
                            <div>
                                <label style={{ display: "block", fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px", letterSpacing: "0.5px" }}>
                                    Algoritma Seçimi
                                </label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white"
                                    value={seciliAlgoritma}
                                    onChange={(e) => setSeciliAlgoritma(e.target.value as AlgoritmaTipi)}
                                    style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                                >
                                    <option value={AlgoritmaTipi.GENETIC}>🧬 Genetik Algoritma (GA)</option>
                                    <option value={AlgoritmaTipi.ACO}>🐜 Karınca Kolonisi (ACO)</option>
                                    <option value={AlgoritmaTipi.Q_LEARNING}>🤖 Q-Learning (RL)</option>
                                    <option value={AlgoritmaTipi.ABC}>🐝 Yapay Arı Kolonisi (ABC)</option>
                                </select>
                            </div>

                            {/* KAYNAK - HEDEF - BANT GENİŞLİĞİ */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Başlangıç ID</label>
                                    <input
                                        type="number"
                                        style={{ width: "100%", background: "rgba(15, 23, 42, 0.6)", border: "1px solid #475569", color: "white", padding: "8px", borderRadius: "6px", fontSize: "13px", outline: "none" }}
                                        value={baslangicDugum}
                                        onChange={(e) => setBaslangicDugum(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Hedef ID</label>
                                    <input
                                        type="number"
                                        style={{ width: "100%", background: "rgba(15, 23, 42, 0.6)", border: "1px solid #475569", color: "white", padding: "8px", borderRadius: "6px", fontSize: "13px", outline: "none" }}
                                        value={bitisDugum}
                                        onChange={(e) => setBitisDugum(Number(e.target.value))}
                                    />
                                </div>
                                <div style={{ gridColumn: "span 2" }}>
                                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Gerekli Bant Genişliği (Mbps)</label>
                                    <input
                                        type="number"
                                        style={{ width: "100%", background: "rgba(15, 23, 42, 0.6)", border: "1px solid #475569", color: "white", padding: "8px", borderRadius: "6px", fontSize: "13px", outline: "none" }}
                                        value={minBantGenisligi}
                                        onChange={(e) => setMinBantGenisligi(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* AĞIRLIK AYARLARI */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px", background: "rgba(30,41,59,0.3)", padding: "10px", borderRadius: "8px", border: "1px dashed #334155" }}>
                                <label style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", fontWeight: "bold", borderBottom: "1px solid #334155", paddingBottom: "4px", marginBottom: "0" }}>
                                    Kriter Ağırlıkları (QoS)
                                </label>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                                        <span style={{ color: "#cbd5e1" }}>Gecikme (Delay)</span>
                                        <span style={{ color: "#60a5fa", fontWeight: 'bold' }}>{agirliklar.wGecikme}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={agirliklar.wGecikme} onChange={(e) => agirlikNormalizasyonu("gecikme", parseFloat(e.target.value))} style={{ width: "100%", height: "4px", accentColor: "#60a5fa" }} />
                                </div>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                                        <span style={{ color: "#cbd5e1" }}>Güvenilirlik (Reliability)</span>
                                        <span style={{ color: "#4ade80", fontWeight: 'bold' }}>{agirliklar.wGuvenilirlik}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={agirliklar.wGuvenilirlik} onChange={(e) => agirlikNormalizasyonu("guven", parseFloat(e.target.value))} style={{ width: "100%", height: "4px", accentColor: "#4ade80" }} />
                                </div>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                                        <span style={{ color: "#cbd5e1" }}>Kaynak Maliyeti (Cost)</span>
                                        <span style={{ color: "#c084fc", fontWeight: 'bold' }}>{agirliklar.wKaynak}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={agirliklar.wKaynak} onChange={(e) => agirlikNormalizasyonu("kaynak", parseFloat(e.target.value))} style={{ width: "100%", height: "4px", accentColor: "#c084fc" }} />
                                </div>
                            </div>

                            {/* AKSİYON BUTONLARI */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                                <button
                                    onClick={hesaplaButonunaBasildi}
                                    disabled={hesaplamaYapiyor}
                                    style={{
                                        width: "100%",
                                        background: "linear-gradient(to right, #2563eb, #1d4ed8)",
                                        color: "white",
                                        fontWeight: "bold",
                                        fontSize: "14px",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        border: "1px solid #3b82f6",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "8px",
                                        boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.3)",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {hesaplamaYapiyor ? "Hesaplanıyor..." : (
                                        <>
                                            <PlayIcon style={{ width: "20px" }} /> Rota Hesapla
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={kiyaslaButonunaBasildi}
                                    disabled={hesaplamaYapiyor}
                                    style={{
                                        width: "100%",
                                        backgroundColor: "rgba(30, 41, 59, 0.6)",
                                        color: "#e2e8f0",
                                        fontWeight: "600",
                                        fontSize: "13px",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        border: "1px solid #475569",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "8px",
                                        transition: "background 0.2s"
                                    }}
                                >
                                    <ChartBarIcon style={{ width: "18px", color: "#fbbf24" }} /> Algoritmaları Yarıştır
                                </button>

                                <button
                                    onClick={() => setTestModuGoster(!testModuGoster)}
                                    style={{
                                        width: "100%",
                                        backgroundColor: testModuGoster ? "rgba(220, 38, 38, 0.2)" : "rgba(124, 58, 237, 0.2)",
                                        color: testModuGoster ? "#fca5a5" : "#c4b5fd",
                                        fontWeight: "600",
                                        fontSize: "13px",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        border: `1px solid ${testModuGoster ? "#dc2626" : "#7c3aed"}`,
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "8px"
                                    }}
                                >
                                    <AdjustmentsHorizontalIcon style={{ width: "18px" }} /> {testModuGoster ? "Test Modunu Kapat" : "Otomatik Test Modu"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* DENEY MODÜLÜ */}
            {testModuGoster && graf && <DeneyYurutucu cizge={graf} />}

            {/* SAĞ PANEL: SONUÇLAR */}
            {sonuc && (
                <div
                    style={{
                        position: "absolute",
                        top: "100px",
                        right: sonuclarAcik ? "20px" : "-400px",
                        zIndex: 20,
                        width: "420px", // Genişletildi (350 -> 420)
                        maxHeight: "90vh", // Dikey taşmayı önle
                        overflowY: "auto", // Scroll ekle
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                        transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        color: "white"
                    }}
                >
                    {/* Toggle Button */}
                    <div
                        onClick={() => setSonuclarAcik(!sonuclarAcik)}
                        style={{
                            position: "absolute",
                            left: "-40px",
                            top: "20px",
                            width: "40px",
                            height: "40px",
                            backgroundColor: "#334155",
                            borderRadius: "8px 0 0 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "-4px 0 6px rgba(0,0,0,0.1)",
                            border: "1px solid #475569",
                            borderRight: "none"
                        }}
                    >
                        {sonuclarAcik ? <ChevronDoubleRightIcon width={20} /> : <ChevronDoubleLeftIcon width={20} color="#4ade80" />}
                    </div>

                    {/* Header */}
                    <div style={{ padding: "20px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontWeight: "bold", background: "linear-gradient(to right, #4ade80, #22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "18px", margin: 0 }}>
                            🚀 Simülasyon Raporu
                        </h3>
                        <span style={{ fontSize: "10px", backgroundColor: "#1e293b", padding: "2px 6px", borderRadius: "4px", color: "#64748b" }}>CANLI</span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: "20px" }}>

                        {/* Grafik veya Tekil Sonuç */}
                        {kiyaslamaGoster && kiyaslamaVerisi.length > 0 ? (
                            <div style={{ height: "180px", marginBottom: "20px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "10px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={kiyaslamaVerisi}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tick={{ fill: '#94a3b8' }} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tick={{ fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            formatter={(value: number) => value.toFixed(2)}
                                            labelFormatter={(label) => {
                                                // Tooltip'te uzun ismi göstermek için kiyaslamaVerisi'nden bul
                                                const match = kiyaslamaVerisi.find(v => v.name === label);
                                                return match ? match.fullName : label;
                                            }}
                                        />
                                        <Bar
                                            dataKey="cost"
                                            radius={[4, 4, 0, 0]}
                                            onClick={(data: any) => {
                                                if (data && data.res) {
                                                    setSonuc(data.res);
                                                }
                                            }}
                                            onMouseEnter={(data: any) => {
                                                if (data && data.res) {
                                                    setSonuc(data.res);
                                                }
                                            }}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {kiyaslamaVerisi.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    stroke={sonuc?.algorithmName === entry.name ? "white" : "transparent"}
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                                <div style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))", padding: "12px", borderRadius: "8px", border: "1px solid #334155", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                                    <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: 'uppercase', marginBottom: '4px' }}>Algoritma</div>
                                    <div style={{ fontWeight: "700", color: "#fff", fontSize: "14px" }}>{sonuc.algorithmName}</div>
                                </div>
                                <div style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))", padding: "12px", borderRadius: "8px", border: "1px solid #334155", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                                    <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: 'uppercase', marginBottom: '4px' }}>Süre</div>
                                    <div style={{ fontWeight: "bold", fontSize: "18px", color: "#38bdf8" }}>{sonuc.executionTime.toFixed(0)} <span style={{ fontSize: "12px" }}>ms</span></div>
                                </div>
                            </div>
                        )}

                        {/* Detaylı Metrikler */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(30,41,59,0.4)", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>Toplam Gecikme</div>
                                    <div style={{ fontWeight: "600", color: "#e2e8f0" }}>Delay</div>
                                </div>
                                <span style={{ fontFamily: "monospace", color: "#60a5fa", fontSize: "15px", fontWeight: "bold" }}>{sonuc.metrics.totalDelay.toFixed(2)} ms</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(30,41,59,0.4)", borderRadius: "8px", borderLeft: "4px solid #4ade80" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>Güvenilirlik</div>
                                    <div style={{ fontWeight: "600", color: "#e2e8f0" }}>Reliability</div>
                                </div>
                                <span style={{ fontFamily: "monospace", color: "#4ade80", fontSize: "15px", fontWeight: "bold" }}>{(sonuc.metrics.totalReliability * 100).toFixed(6)}%</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(30,41,59,0.4)", borderRadius: "8px", borderLeft: "4px solid #c084fc" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>Kaynak Tüketimi</div>
                                    <div style={{ fontWeight: "600", color: "#e2e8f0" }}>Resource Cost</div>
                                </div>
                                <span style={{ fontFamily: "monospace", color: "#c084fc", fontSize: "15px", fontWeight: "bold" }}>{sonuc.metrics.resourceCost.toFixed(2)}</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(30,41,59,0.4)", borderRadius: "8px", borderLeft: "4px solid #facc15" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>Genel Skor</div>
                                    <div style={{ fontWeight: "600", color: "#e2e8f0" }}>Weighted Cost</div>
                                </div>
                                <span style={{ fontFamily: "monospace", color: "#facc15", fontSize: "15px", fontWeight: "bold" }}>{sonuc.metrics.weightedCost.toFixed(4)}</span>
                            </div>
                        </div>

                        {/* Rota (Node Listesi) */}
                        <div style={{ marginTop: "20px" }}>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Hesaplanan Rota:</div>
                            <div style={{
                                backgroundColor: "rgba(0,0,0,0.3)",
                                padding: "10px",
                                borderRadius: "6px",
                                fontFamily: "monospace",
                                fontSize: "11px",
                                color: "#cbd5e1",
                                border: "1px solid #334155",
                                wordBreak: "break-all",
                                lineHeight: "1.5"
                            }}>
                                {sonuc.path.join(" → ")}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
