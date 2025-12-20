import React, { useEffect, useMemo, useState } from "react";
import WorldMap from "./components/WorldMap";
import ExperimentRunner from "./components/ExperimentRunner";
import { AlgorithmType, GraphData, ResultType } from "./types";
import { runABC, runACO, runGeneticAlgorithm, runQLearning } from "./services/algorithms";
import {
    AdjustmentsHorizontalIcon,
    ChartBarIcon,
    MapIcon,
    PlayIcon
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
type Weights = { wDelay: number; wReliability: number; wResource: number };
type Demand = { src: number; dst: number; bw: number };

const App: React.FC = () => {
    // Grafik Verisi
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [isLoadingMap, setIsLoadingMap] = useState(true);

    // Test Senaryoları (CSV'den okunur)
    const [demands, setDemands] = useState<Demand[]>([]);

    // Kullanıcı Seçimleri
    const [startNode, setStartNode] = useState<number>(8);
    const [endNode, setEndNode] = useState<number>(44);
    const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>(AlgorithmType.GENETIC);
    const [autoRotate, setAutoRotate] = useState<boolean>(true);

    // Algoritma Ağırlıkları (Gecikme, Güvenilirlik, Kaynak)
    const [weights, setWeights] = useState<Weights>({
        wDelay: 0.34,
        wReliability: 0.33,
        wResource: 0.33
    });

    // Hesaplama Sonuçları
    const [result, setResult] = useState<ResultType | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // UI Durumları
    const [settingsOpen, setSettingsOpen] = useState(true);
    const [resultsOpen, setResultsOpen] = useState(true);
    const [showComparison, setShowComparison] = useState(false);
    const [showTesting, setShowTesting] = useState(false);
    const [comparisonData, setComparisonData] = useState<any[]>([]);

    useEffect(() => {
        const fetchMap = async () => {
            try {
                setIsLoadingMap(true);

                // --- 1. DÜĞÜM (NODE) VERİLERİNİ YÜKLE ---
                const nodeResponse = await fetch("/BSM307_317_Guz2025_TermProject_NodeData.csv");
                const nodeText = await nodeResponse.text();
                const nodeLines = nodeText.trim().split('\n').slice(1); // Başlığı atla

                const nodes = nodeLines.map((line, idx) => {
                    const [id, s_ms, r_node] = line.split(';');

                    // Fibonacci Küresi ile Düğümleri Konumlandır (Görsel Dağılım İçin)
                    const phi = Math.acos(1 - 2 * (idx + 0.5) / nodeLines.length);
                    const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
                    const ORBIT_RADIUS = 75;

                    return {
                        id: parseInt(id),
                        x: ORBIT_RADIUS * Math.sin(phi) * Math.cos(theta),
                        y: ORBIT_RADIUS * Math.sin(phi) * Math.sin(theta),
                        z: ORBIT_RADIUS * Math.cos(phi),
                        processingDelay: parseFloat(s_ms.replace(',', '.')),
                        reliability: parseFloat(r_node.replace(',', '.'))
                    };
                });

                console.log(`✅ ${nodes.length} düğüm yüklendi.`);

                // --- 2. BAĞLANTI (LINK/EDGE) VERİLERİNİ YÜKLE ---
                const edgeResponse = await fetch("/BSM307_317_Guz2025_TermProject_EdgeData.csv");
                const edgeText = await edgeResponse.text();
                const edgeLines = edgeText.trim().split('\n').slice(1);

                const links = edgeLines.map(line => {
                    const [src, dst, capacity, delay, reliability] = line.split(';');
                    return {
                        source: parseInt(src),
                        target: parseInt(dst),
                        bandwidth: parseFloat(capacity), // Mbps
                        propagationDelay: parseFloat(delay.replace(',', '.')), // ms
                        reliability: parseFloat(reliability.replace(',', '.'))
                    };
                });

                console.log(`✅ ${links.length} bağlantı yüklendi.`);

                // --- 3. KOMŞULUK HARİTASI (Adjacency Map) OLUŞTUR ---
                // Algoritmaların hızlı erişimi için gereklidir
                const adjacency = new Map<number, any[]>();

                links.forEach(link => {
                    // Kaynak -> Hedef
                    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
                    adjacency.get(link.source)!.push(link);

                    // Hedef -> Kaynak (Yönsüz Graf Varsayımı)
                    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
                    adjacency.get(link.target)!.push({
                        ...link,
                        source: link.target,
                        target: link.source
                    });
                });

                // --- 4. GRAF VERİSİNİ STATE'E KAYDET ---
                const graphData: GraphData = {
                    nodes,
                    links,
                    adjacency
                };

                setGraph(graphData);

                // --- 5. TEST SENARYOLARINI (DEMANDS) YÜKLE ---
                try {
                    const demandResponse = await fetch("/BSM307_317_Guz2025_TermProject_DemandData.csv");
                    const demandText = await demandResponse.text();
                    const demandLines = demandText.trim().split('\n').slice(1);

                    const demands = demandLines.map(line => {
                        const [src, dst, bw] = line.split(';');
                        return {
                            src: parseInt(src),
                            dst: parseInt(dst),
                            bw: parseFloat(bw)
                        };
                    });

                    setDemands(demands);
                    console.log(`✅ ${demands.length} test senaryosu yüklendi.`);

                    // İlk senaryoyu varsayılan olarak seç
                    if (demands.length > 0) {
                        setStartNode(demands[0].src);
                        setEndNode(demands[0].dst);
                    }
                } catch (e) {
                    console.warn('Talep verisi bulunamadı, varsayılanlar kullanılacak.');
                }

            } catch (e) {
                console.error("❌ Veri Yükleme Hatası:", e);
            } finally {
                setIsLoadingMap(false);
            }
        };

        fetchMap();
    }, []);

    // Seçilen Algoritmayı Çalıştır
    const computeByAlgo = (algo: AlgorithmType, g: GraphData, src: number, dst: number, w: Weights) => {
        if (algo === AlgorithmType.GENETIC) return runGeneticAlgorithm(g, src, dst, w);
        if (algo === AlgorithmType.ACO) return runACO(g, src, dst, w);
        if (algo === AlgorithmType.Q_LEARNING) return runQLearning(g, src, dst, w);
        if (algo === AlgorithmType.ABC) return runABC(g, src, dst, w);

        return {
            path: [],
            metrics: { totalDelay: 0, totalReliability: 0, resourceCost: 0, weightedCost: 0 },
            executionTime: 0,
            algorithmName: "Bilinmiyor"
        } as ResultType;
    };

    // "Hesapla" Butonu Tetikleyicisi
    const handleCalculate = () => {
        if (!graph) return;
        setIsCalculating(true);

        // UI blocking'i önlemek için kısa gecikme
        window.setTimeout(() => {
            const res = computeByAlgo(selectedAlgo, graph, startNode, endNode, weights);
            setResult(res);

            setShowComparison(false);
            setResultsOpen(true);
            setIsCalculating(false);
        }, 300);
    };

    // "Tümünü Kıyasla" Butonu Tetikleyicisi
    const handleCompareAll = () => {
        if (!graph) return;
        setIsCalculating(true);

        window.setTimeout(() => {
            const algos: AlgorithmType[] = [
                AlgorithmType.GENETIC,
                AlgorithmType.ACO,
                AlgorithmType.Q_LEARNING,
                AlgorithmType.ABC
            ];

            const iterations = 5; // Daha stabil sonuç için 5 kez çalıştırıp ortalamasını al
            const averagedResults = algos.map((algo) => {
                let totalWeightedCost = 0;
                let minCost = Infinity;
                let bestRun: ResultType | null = null;

                for (let i = 0; i < iterations; i++) {
                    const res = computeByAlgo(algo, graph, startNode, endNode, weights);
                    const c = res.metrics.weightedCost;
                    totalWeightedCost += c;
                    // En düşük maliyetli koşuyu sakla
                    if (c < minCost) {
                        minCost = c;
                        bestRun = res;
                    }
                }

                const avgCost = totalWeightedCost / iterations;

                return {
                    name: algo,
                    res: bestRun!, // En iyi sonucu görselleştirme için kullanacağız
                    cost: avgCost,
                    color:
                        algo === AlgorithmType.GENETIC
                            ? "#4ade80"
                            : algo === AlgorithmType.ACO
                                ? "#facc15"
                                : algo === AlgorithmType.Q_LEARNING
                                    ? "#c084fc"
                                    : "#f97316"
                };
            });

            // En düşük maliyetli algoritma en üstte olsun
            averagedResults.sort((a, b) => a.cost - b.cost);
            setComparisonData(averagedResults);

            // Haritada en başarılı algoritmanın yolunu göster
            if (averagedResults[0].res) setResult(averagedResults[0].res);

            setShowComparison(true);
            setResultsOpen(true);
            setIsCalculating(false);
        }, 1000);
    };

    // Ağırlık Slider Kontrolü
    const normalizeWeights = (type: "delay" | "rel" | "res", value: number) => {
        const newW = { ...weights };
        if (type === "delay") newW.wDelay = value;
        if (type === "rel") newW.wReliability = value;
        if (type === "res") newW.wResource = value;
        setWeights(newW);
    };

    if (isLoadingMap)
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
                <div>Harita ve Veriler Yükleniyor...</div>
            </div>
        );

    if (!graph)
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
                Veri Yükleme Hatası: Graph verisi oluşmadı.
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
                <WorldMap
                    graph={graph}
                    pathResult={result ? result.path : []}
                    startNode={startNode}
                    endNode={endNode}
                    autoRotate={autoRotate}
                    algorithmName={
                        result?.algorithmName
                            ? result.algorithmName
                            : selectedAlgo === AlgorithmType.GENETIC ? "Genetik Algoritma (GA)"
                                : selectedAlgo === AlgorithmType.ACO ? "Karınca Kolonisi (ACO)"
                                    : selectedAlgo === AlgorithmType.Q_LEARNING ? "Q-Learning (Pekiştirmeli Öğrenme)"
                                        : "Yapay Arı Kolonisi (ABC)"
                    }
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
                        gap: "10px",
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "white",
                        margin: 0
                    }}
                >
                    <MapIcon style={{ width: "32px", height: "32px", color: "#3b82f6" }} />
                    Çok Amaçlı KYS Yönlendirme Simülasyonu <span style={{ color: "#60a5fa", fontWeight: 300, fontSize: "16px" }}>| BSM307 Dönem Projesi</span>
                </h1>
            </div>

            {/* SOL PANEL: AYARLAR */}
            <div style={{ position: "absolute", top: "100px", left: "20px", width: settingsOpen ? "320px" : "50px", zIndex: 20, transition: "width 0.3s" }}>
                <div style={{ backgroundColor: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(10px)", border: "1px solid #334155", borderRadius: "8px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                    <div onClick={() => setSettingsOpen(!settingsOpen)} style={{ padding: "12px", backgroundColor: "rgba(30, 41, 59, 0.9)", cursor: "pointer", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {settingsOpen ? (
                            <span style={{ fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
                                <AdjustmentsHorizontalIcon style={{ width: "20px" }} /> Kontrol Paneli
                            </span>
                        ) : (
                            <AdjustmentsHorizontalIcon style={{ width: "24px", color: "#60a5fa", margin: "0 auto" }} />
                        )}
                    </div>

                    {settingsOpen && (
                        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* TALEP SEÇİMİ (DEMANDS) */}
                            {demands.length > 0 && (
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", textTransform: "uppercase", color: "#facc15", fontWeight: "bold", marginBottom: "8px" }}>
                                        Test Senaryoları (Ön Tanımlı)
                                    </label>
                                    <select
                                        className="w-full bg-slate-800 border border-yellow-600 rounded p-2 text-xs text-yellow-100 focus:border-yellow-400 outline-none"
                                        onChange={(e) => {
                                            const idx = parseInt(e.target.value);
                                            setStartNode(demands[idx].src);
                                            setEndNode(demands[idx].dst);
                                        }}
                                    >
                                        {demands.map((d, i) => (
                                            <option key={i} value={i}>
                                                #{i + 1}: Düğüm {d.src} -&gt; {d.dst} ({d.bw} Mbps)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* ALGORİTMA SEÇİMİ */}
                            <div>
                                <label style={{ display: "block", fontSize: "12px", textTransform: "uppercase", color: "#94a3b8", fontWeight: "bold", marginBottom: "8px" }}>
                                    Algoritma Seçimi
                                </label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                    value={selectedAlgo}
                                    onChange={(e) => setSelectedAlgo(e.target.value as AlgorithmType)}
                                >
                                    <option value={AlgorithmType.GENETIC}>Genetik Algoritma (GA)</option>
                                    <option value={AlgorithmType.ACO}>Karınca Kolonisi (ACO)</option>
                                    <option value={AlgorithmType.Q_LEARNING}>Q-Learning (RL)</option>
                                    <option value={AlgorithmType.ABC}>Yapay Arı Kolonisi (ABC)</option>
                                </select>
                            </div>

                            {/* KAYNAK - HEDEF */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Başlangıç (ID)</label>
                                    <input
                                        type="number"
                                        style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid #475569", color: "white", padding: "4px", borderRadius: "4px" }}
                                        value={startNode}
                                        onChange={(e) => setStartNode(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Hedef (ID)</label>
                                    <input
                                        type="number"
                                        style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid #475569", color: "white", padding: "4px", borderRadius: "4px" }}
                                        value={endNode}
                                        onChange={(e) => setEndNode(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* AĞIRLIK AYARLARI */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <label style={{ fontSize: "12px", textTransform: "uppercase", color: "#94a3b8", fontWeight: "bold", borderBottom: "1px solid #334155", paddingBottom: "4px" }}>
                                    Yönlendirme Kriterleri (Weights)
                                </label>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                        <span>Gecikme (Delay)</span>
                                        <span style={{ color: "#60a5fa" }}>{weights.wDelay}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={weights.wDelay} onChange={(e) => normalizeWeights("delay", parseFloat(e.target.value))} style={{ width: "100%" }} />
                                </div>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                        <span>Güvenilirlik (Reliability)</span>
                                        <span style={{ color: "#4ade80" }}>{weights.wReliability}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={weights.wReliability} onChange={(e) => normalizeWeights("rel", parseFloat(e.target.value))} style={{ width: "100%" }} />
                                </div>

                                <div>
                                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                        <span>Kaynak/Bant Gen. (Resource)</span>
                                        <span style={{ color: "#c084fc" }}>{weights.wResource}</span>
                                    </span>
                                    <input type="range" max="1" step="0.01" value={weights.wResource} onChange={(e) => normalizeWeights("res", parseFloat(e.target.value))} style={{ width: "100%" }} />
                                </div>
                            </div>

                            {/* AKSİYON BUTONLARI */}
                            <button
                                onClick={handleCalculate}
                                disabled={isCalculating}
                                style={{
                                    width: "100%",
                                    backgroundColor: "#2563eb",
                                    color: "white",
                                    fontWeight: "bold",
                                    padding: "10px",
                                    borderRadius: "4px",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px"
                                }}
                            >
                                {isCalculating ? "Hesaplanıyor..." : (
                                    <>
                                        <PlayIcon style={{ width: "20px" }} /> Rotayı Çiz
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleCompareAll}
                                disabled={isCalculating}
                                style={{
                                    width: "100%",
                                    backgroundColor: "#334155",
                                    color: "white",
                                    fontWeight: "bold",
                                    padding: "10px",
                                    borderRadius: "4px",
                                    border: "1px solid #475569",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px"
                                }}
                            >
                                <ChartBarIcon style={{ width: "20px", color: "#facc15" }} /> Algoritma Yarıştır
                            </button>

                            <button
                                onClick={() => setShowTesting(!showTesting)}
                                style={{
                                    width: "100%",
                                    backgroundColor: showTesting ? "#dc2626" : "#7c3aed",
                                    color: "white",
                                    fontWeight: "bold",
                                    padding: "10px",
                                    borderRadius: "4px",
                                    border: "1px solid #475569",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px"
                                }}
                            >
                                <AdjustmentsHorizontalIcon style={{ width: "20px" }} /> {showTesting ? "Otomatik Testi Kapat" : "Otomatik Test (20+ Senaryo)"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* DENEY MODÜLÜ (Görünürse) */}
            {showTesting && graph && <ExperimentRunner graph={graph} />}

            {/* SAĞ PANEL: SONUÇLAR */}
            {result && resultsOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "100px",
                        right: "20px",
                        zIndex: 20,
                        width: "350px",
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "20px",
                        color: "white"
                    }}
                >
                    <h3 style={{ fontWeight: "bold", color: "#4ade80", marginBottom: "10px", fontSize: "18px" }}>
                        Sonuç Raporu
                    </h3>

                    {showComparison && comparisonData.length > 0 ? (
                        <div style={{ height: "200px", marginBottom: "10px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                    <YAxis stroke="#94a3b8" fontSize={10} />
                                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                                    <Bar dataKey="cost">
                                        {comparisonData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                            <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "4px", border: "1px solid #334155", textAlign: "center" }}>
                                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Kullanılan Algoritma</div>
                                <div style={{ fontWeight: "bold" }}>{result.algorithmName}</div>
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "4px", border: "1px solid #334155", textAlign: "center" }}>
                                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Hesaplama Süresi</div>
                                <div style={{ fontWeight: "bold" }}>{result.executionTime.toFixed(0)} ms</div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #334155", paddingTop: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(30,41,59,0.5)", borderRadius: "4px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Toplam Gecikme (Delay)</span>
                            <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>{result.metrics.totalDelay.toFixed(2)} ms</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(30,41,59,0.5)", borderRadius: "4px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Güvenilirlik (Reliability)</span>
                            <span style={{ fontFamily: "monospace", color: "#4ade80" }}>{(result.metrics.totalReliability * 100).toFixed(6)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(30,41,59,0.5)", borderRadius: "4px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Kaynak Maliyeti</span>
                            <span style={{ fontFamily: "monospace", color: "#c084fc" }}>{result.metrics.resourceCost.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style={{ marginTop: "15px", padding: "10px", background: "linear-gradient(to right, #1e293b, #0f172a)", borderRadius: "4px", border: "1px solid #475569", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#cbd5e1" }}>TOPLAM SKOR (COST)</span>
                        <span style={{ fontSize: "20px", fontWeight: "bold", color: "#facc15", fontFamily: "monospace" }}>{result.metrics.weightedCost.toFixed(3)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
