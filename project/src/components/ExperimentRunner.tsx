import React, { useState, useEffect } from 'react';
import { GraphData, AlgorithmType, AlgorithmParams, Link } from '../types';
import { runGeneticAlgorithm, runACO, runQLearning, runABC } from '../services/algorithms';

interface ExperimentRunnerProps {
    graph: GraphData;
}

// Deney Sonucu Veri Modeli
interface TestResult {
    testCase: number;      // Senaryo No
    s: number;             // Başlangıç Düğümü
    d: number;             // Hedef Düğümü
    b: number;             // İstenen Bant Genişliği
    algorithm: string;     // Algoritma Adı
    successRate: number;   // Başarım Oranı (5 tekrarda kaçı başarılı)
    avgCost: number | string; // Ortalama Maliyet
    stdDev: number | string;  // Standart Sapma
    bestCost: number | string; // En İyi Maliyet
    worstCost: number | string; // En Kötü Maliyet
    avgRuntime: number;    // Ortalama Çalışma Süresi (ms)
}

// Yardımcı: Grafiği belirli bir bant genişliğine göre filtreler
// Proje İsteri: Eğer bir linkin kapasitesi yetersizse, o link kullanılamaz.
const filterGraphByBandwidth = (graph: GraphData, minBw: number): GraphData => {
    const filteredLinks = graph.links.filter(l => l.bandwidth >= minBw);
    const adjacency = new Map<number, Link[]>();

    filteredLinks.forEach(link => {
        if (!adjacency.has(link.source)) adjacency.set(link.source, []);
        adjacency.get(link.source)!.push(link);

        // Çift yönlü bağlantı kabulü (Undirected Graph)
        if (!adjacency.has(link.target)) adjacency.set(link.target, []);
        adjacency.get(link.target)!.push({ ...link, source: link.target, target: link.source });
    });

    return {
        ...graph,
        links: filteredLinks,
        adjacency
    };
};

const ExperimentRunner: React.FC<ExperimentRunnerProps> = ({ graph }) => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const algorithms = [
        { type: AlgorithmType.GENETIC, name: 'GA' },
        { type: AlgorithmType.ACO, name: 'ACO' },
        { type: AlgorithmType.Q_LEARNING, name: 'Q-Learning' },
        { type: AlgorithmType.ABC, name: 'ABC' }
    ];

    const weights: AlgorithmParams = {
        wDelay: 0.34,
        wReliability: 0.33,
        wResource: 0.33,
        // Varsayılan parametreler
        populationSize: 50,
        iterations: 50,
        ants: 20,
        epsilon: 0.1
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const runExperiments = async () => {
        setRunning(true);
        setResults([]);
        setLogs(['Deneyler başlatılıyor...']);

        // UI'ın donmaması için asenkron gecikme ekliyoruz
        setTimeout(async () => {
            const tempResults: TestResult[] = [];
            const N = graph.nodes.length;

            // Proje İsteri: 20 farklı (Source, Destination, Bandwidth) senaryosu
            for (let i = 0; i < 20; i++) {
                // Rastgele S ve D seçimi
                let s = Math.floor(Math.random() * N);
                let d = Math.floor(Math.random() * N);
                while (d === s || graph.nodes[s] === undefined || graph.nodes[d] === undefined) {
                    s = Math.floor(Math.random() * N);
                    d = Math.floor(Math.random() * N);
                }

                // Rastgele Bant Genişliği İsteği [100 - 1000 Mbps arası]
                const b = Math.floor(Math.random() * 900) + 100;

                addLog(`Senaryo ${i + 1}: Node ${s} -> ${d}, Bant Genişliği: ${b} Mbps`);

                // Kapasite kısıtına göre grafiği daralt
                const filteredGraph = filterGraphByBandwidth(graph, b);

                for (const alg of algorithms) {
                    const costs: number[] = [];
                    const runtimes: number[] = [];
                    let successes = 0;

                    // Proje İsteri: Her senaryo 5 kez tekrar edilecek (Average, StdDev hesabı için)
                    for (let rep = 0; rep < 5; rep++) {
                        const startT = performance.now();
                        let res;
                        try {
                            if (alg.type === AlgorithmType.GENETIC) res = runGeneticAlgorithm(filteredGraph, s, d, weights);
                            else if (alg.type === AlgorithmType.ACO) res = runACO(filteredGraph, s, d, weights);
                            else if (alg.type === AlgorithmType.Q_LEARNING) res = runQLearning(filteredGraph, s, d, weights);
                            else res = runABC(filteredGraph, s, d, weights);
                        } catch (e) {
                            console.error(e);
                            res = { path: [], metrics: { weightedCost: Infinity }, executionTime: 0 };
                        }
                        const endT = performance.now();

                        // Başarım Kontrolü: Yol bulundu mu ve geçerli mi?
                        if (res.path && res.path.length > 0) {
                            if (res.metrics.weightedCost === Infinity) {
                                // Başarısız
                            } else {
                                costs.push(res.metrics.weightedCost);
                                successes++;
                            }
                        }
                        runtimes.push(endT - startT);

                        // UI'a nefes aldır
                        if (rep % 5 === 0) await new Promise(r => setTimeout(r, 0));
                    }

                    // İstatistik Hesaplama
                    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : Infinity;
                    const stdDev = costs.length ? Math.sqrt(costs.map(x => (x - avgCost) ** 2).reduce((a, b) => a + b, 0) / costs.length) : Infinity;
                    const best = costs.length ? Math.min(...costs) : Infinity;
                    const worst = costs.length ? Math.max(...costs) : Infinity;
                    const avgRuntime = runtimes.reduce((a, b) => a + b, 0) / runtimes.length;

                    tempResults.push({
                        testCase: i + 1,
                        s,
                        d,
                        b,
                        algorithm: alg.name,
                        successRate: successes / 5,
                        avgCost: avgCost === Infinity ? 'Başarısız' : avgCost,
                        stdDev: stdDev === Infinity ? '-' : stdDev,
                        bestCost: best === Infinity ? '-' : best,
                        worstCost: worst === Infinity ? '-' : worst,
                        avgRuntime
                    });
                }
            }

            setResults(tempResults);
            setRunning(false);
            addLog('Deneyler tamamlandı.');
        }, 100);
    };

    const downloadCSV = () => {
        const header = ['Senaryo', 'Baslangic (S)', 'Hedef (D)', 'Bant Gen (Mbps)', 'Algoritma', 'Basarim Orani', 'Ort. Maliyet', 'Std. Sapma', 'En Iyi', 'En Kotu', 'Ort. Sure (ms)'];
        const rows = results.map(r => [
            r.testCase, r.s, r.d, r.b.toFixed(2), r.algorithm,
            r.successRate.toFixed(2),
            typeof r.avgCost === 'number' ? r.avgCost.toFixed(2) : r.avgCost,
            typeof r.stdDev === 'number' ? r.stdDev.toFixed(2) : r.stdDev,
            typeof r.bestCost === 'number' ? r.bestCost.toFixed(2) : r.bestCost,
            typeof r.worstCost === 'number' ? r.worstCost.toFixed(2) : r.worstCost,
            r.avgRuntime.toFixed(4)
        ].join(','));

        const csvContent = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'deney_sonuclari.csv';
        link.click();
    };

    const copyMarkdown = () => {
        const header = '| Senaryo | S | D | BW (Mbps) | Algoritma | Başarım | Ort. Maliyet | Std. Sapma | En İyi | En Kötü | Süre (ms) |';
        const sep = '|---|---|---|---|---|---|---|---|---|---|---|';
        const rows = results.map(r => `| ${r.testCase} | ${r.s} | ${r.d} | ${r.b.toFixed(2)} | ${r.algorithm} | ${r.successRate.toFixed(2)} | ${typeof r.avgCost === 'number' ? r.avgCost.toFixed(2) : r.avgCost} | ${typeof r.stdDev === 'number' ? r.stdDev.toFixed(2) : r.stdDev} | ${typeof r.bestCost === 'number' ? r.bestCost.toFixed(2) : r.bestCost} | ${typeof r.worstCost === 'number' ? r.worstCost.toFixed(2) : r.worstCost} | ${r.avgRuntime.toFixed(4)} |`);

        const md = [header, sep, ...rows].join('\n');
        navigator.clipboard.writeText(md);
        alert('Markdown tablosu kopyalandı! Raporuna yapıştırabilirsin.');
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxHeight: '80vh',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            zIndex: 100,
            padding: '20px',
            overflow: 'auto',
            color: 'white',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>Otomatik Deney Çalıştırıcısı (20+ Senaryo)</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={runExperiments}
                        disabled={running}
                        style={{ padding: '8px 16px', background: running ? '#475569' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: running ? 'default' : 'pointer' }}
                    >
                        {running ? 'Çalışıyor...' : 'Deneyleri Başlat'}
                    </button>
                    {results.length > 0 && (
                        <>
                            <button onClick={downloadCSV} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>CSV İndir (Excel)</button>
                            <button onClick={copyMarkdown} style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Tabloyu Kopyala (Rapor İçin)</button>
                        </>
                    )}
                </div>
            </div>

            {running && (
                <div style={{ marginBottom: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                    {logs[logs.length - 1]}
                </div>
            )}

            {results.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: '#0f172a', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>No</th>
                            <th style={{ padding: '8px' }}>S</th>
                            <th style={{ padding: '8px' }}>D</th>
                            <th style={{ padding: '8px' }}>Bant Gen.</th>
                            <th style={{ padding: '8px' }}>Algoritma</th>
                            <th style={{ padding: '8px' }}>Başarım</th>
                            <th style={{ padding: '8px' }}>Ort. Maliyet</th>
                            <th style={{ padding: '8px' }}>Std. Sapma</th>
                            <th style={{ padding: '8px' }}>En İyi</th>
                            <th style={{ padding: '8px' }}>En Kötü</th>
                            <th style={{ padding: '8px' }}>Süre (ms)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #334155', background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                                <td style={{ padding: '8px' }}>{r.testCase}</td>
                                <td style={{ padding: '8px' }}>{r.s}</td>
                                <td style={{ padding: '8px' }}>{r.d}</td>
                                <td style={{ padding: '8px' }}>{r.b}</td>
                                <td style={{ padding: '8px', color: r.algorithm === 'GA' ? '#4ade80' : r.algorithm === 'ACO' ? '#facc15' : r.algorithm === 'ABC' ? '#fb923c' : '#c084fc' }}>{r.algorithm}</td>
                                <td style={{ padding: '8px' }}>{(r.successRate * 100).toFixed(0)}%</td>
                                <td style={{ padding: '8px' }}>{typeof r.avgCost === 'number' ? r.avgCost.toFixed(2) : r.avgCost}</td>
                                <td style={{ padding: '8px' }}>{typeof r.stdDev === 'number' ? r.stdDev.toFixed(2) : r.stdDev}</td>
                                <td style={{ padding: '8px' }}>{typeof r.bestCost === 'number' ? r.bestCost.toFixed(2) : r.bestCost}</td>
                                <td style={{ padding: '8px' }}>{typeof r.worstCost === 'number' ? r.worstCost.toFixed(2) : r.worstCost}</td>
                                <td style={{ padding: '8px' }}>{r.avgRuntime.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ExperimentRunner;
