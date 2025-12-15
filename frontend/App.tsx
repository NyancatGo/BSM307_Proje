import React, { useState, useEffect } from 'react';
import { WorldMap } from './components/WorldMap';
import { generateGraph } from './services/graphGenerator';
import { runGeneticAlgorithm, runACO, runQLearning, runABC } from './services/algorithms';
import { GraphData, AlgorithmParams, AlgorithmType, PathResult } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import {
    CpuChipIcon, SignalIcon, ClockIcon, AdjustmentsHorizontalIcon,
    PlayIcon, ChartBarIcon, ChevronDownIcon, ChevronUpIcon, TrophyIcon, TableCellsIcon
} from '@heroicons/react/24/solid';

const App: React.FC = () => {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [startNode, setStartNode] = useState<number>(0);

    // --- DEĞİŞİKLİK 1: HEDEF NODE DEFAULT DEĞERİ ---
    const [endNode, setEndNode] = useState<number>(999);

    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const [weights, setWeights] = useState<AlgorithmParams>({ wDelay: 0.33, wReliability: 0.33, wResource: 0.34 });
    const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>(AlgorithmType.GENETIC);
    const [result, setResult] = useState<PathResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [showComparison, setShowComparison] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(true);
    const [resultsOpen, setResultsOpen] = useState(true);

    // --- DEĞİŞİKLİK 2: GRAFİK OLUŞTURMA SAYISI ---
    useEffect(() => {
        const g = generateGraph(1000); // <-- ARTIK 1000 DÜĞÜM VAR
        setGraph(g);
    }, []);

    const verifyWithBackend = (algoName: string, cost: number) => {
        fetch('http://localhost:5000/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm: algoName, clientCost: cost, start: startNode, end: endNode })
        }).catch(err => console.error(err));
    };

    const handleCalculate = async () => {
        if (!graph) return;
        setIsCalculating(true);
        setResult(null);
        setShowComparison(false);
        setTimeout(() => {
            let res: PathResult;
            switch (selectedAlgo) {
                case AlgorithmType.GENETIC: res = runGeneticAlgorithm(graph, startNode, endNode, weights); break;
                case AlgorithmType.ACO: res = runACO(graph, startNode, endNode, weights); break;
                case AlgorithmType.ABC: res = runABC(graph, startNode, endNode, weights); break;
                case AlgorithmType.Q_LEARNING: res = runQLearning(graph, startNode, endNode, weights); break;
                default: res = runGeneticAlgorithm(graph, startNode, endNode, weights);
            }
            setResult(res);
            setIsCalculating(false);
            setResultsOpen(true);
            verifyWithBackend(selectedAlgo, res.metrics.weightedCost);
        }, 200);
    };

    const handleCompareAll = () => {
        if (!graph) return;
        setIsCalculating(true);
        setShowComparison(true);
        setTimeout(() => {
            const resG = runGeneticAlgorithm(graph, startNode, endNode, weights);
            const resA = runACO(graph, startNode, endNode, weights);
            const resB = runABC(graph, startNode, endNode, weights);
            const resQ = runQLearning(graph, startNode, endNode, weights);

            const data = [
                { name: 'Genetik', res: resG, cost: resG.metrics.weightedCost, color: '#4ade80' },
                { name: 'ACO', res: resA, cost: resA.metrics.weightedCost, color: '#facc15' },
                { name: 'ABC (Arı)', res: resB, cost: resB.metrics.weightedCost, color: '#f97316' },
                { name: 'Q-Learn', res: resQ, cost: resQ.metrics.weightedCost, color: '#c084fc' },
            ];
            data.sort((a, b) => a.cost - b.cost);

            setComparisonData(data);
            setResult(data[0].res);
            setIsCalculating(false);
            setResultsOpen(true);
            verifyWithBackend("KARŞILAŞTIRMA MODU (Hepsi)", data[0].cost);
        }, 800);
    };

    const normalizeWeights = (type: 'delay' | 'rel' | 'res', value: number) => {
        const newW = { ...weights };
        if (type === 'delay') newW.wDelay = value;
        if (type === 'rel') newW.wReliability = value;
        if (type === 'res') newW.wResource = value;
        setWeights(newW);
    };

    if (!graph) return <div className="flex h-screen w-screen items-center justify-center bg-black text-white">Ağ Oluşturuluyor... (1000 Node)</div>;

    return (
        <div className="relative w-full h-full bg-black overflow-hidden font-sans text-slate-200">
            <div className="absolute inset-0 z-0">
                <WorldMap graph={graph} pathResult={result ? result.path : null} startNode={startNode} endNode={endNode} autoRotate={autoRotate} />
            </div>

            <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/90 to-transparent z-10 pointer-events-none">
                <h1 className="text-2xl font-bold text-white tracking-wider flex items-center gap-2">
                    QoS Rotalama <span className="text-blue-400 font-light">Simülatörü v2.0</span>
                </h1>
            </div>

            {/* SOL PANEL (AYARLAR) */}
            <div className={`absolute top-24 left-4 z-20 transition-all duration-300 ${settingsOpen ? 'w-80' : 'w-12'}`}>
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                    <div className="p-3 bg-slate-800/90 cursor-pointer flex justify-between items-center border-b border-slate-700 hover:bg-slate-700" onClick={() => setSettingsOpen(!settingsOpen)}>
                        {settingsOpen ? <span className="font-semibold text-white flex gap-2"><AdjustmentsHorizontalIcon className="w-5 h-5" /> Ayarlar</span> : <AdjustmentsHorizontalIcon className="w-6 h-6 mx-auto text-blue-400" />}
                    </div>
                    {settingsOpen && (
                        <div className="p-4 space-y-5">
                            <div>
                                <label className="text-xs uppercase text-slate-400 font-bold mb-2 block">Algoritma</label>
                                <select className="w-full bg-black/50 border border-slate-600 rounded p-2 text-sm text-white" value={selectedAlgo} onChange={(e) => setSelectedAlgo(e.target.value as AlgorithmType)}>
                                    {Object.values(AlgorithmType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {/* --- DEĞİŞİKLİK 3: KAYNAK INPUT LİMİTİ --- */}
                                <div>
                                    <label className="text-xs text-slate-400">Kaynak (S)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="999"
                                        className="w-full bg-black/50 border border-slate-600 rounded p-1 text-center"
                                        value={startNode}
                                        onChange={(e) => setStartNode(Math.min(999, Math.max(0, parseInt(e.target.value) || 0)))}
                                    />
                                </div>

                                {/* --- DEĞİŞİKLİK 4: HEDEF INPUT LİMİTİ --- */}
                                <div>
                                    <label className="text-xs text-slate-400">Hedef (D)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="999"
                                        className="w-full bg-black/50 border border-slate-600 rounded p-1 text-center"
                                        value={endNode}
                                        onChange={(e) => setEndNode(Math.min(999, Math.max(0, parseInt(e.target.value) || 0)))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs uppercase text-slate-400 font-bold border-b border-slate-700 pb-1">Ağırlıklar</label>
                                <div><span className="flex justify-between text-xs mb-1"><span>Gecikme</span><span className="text-blue-400">{weights.wDelay}</span></span><input type="range" max="1" step="0.01" value={weights.wDelay} onChange={(e) => normalizeWeights('delay', parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none" /></div>
                                <div><span className="flex justify-between text-xs mb-1"><span>Güvenilirlik</span><span className="text-green-400">{weights.wReliability}</span></span><input type="range" max="1" step="0.01" value={weights.wReliability} onChange={(e) => normalizeWeights('rel', parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none" /></div>
                                <div><span className="flex justify-between text-xs mb-1"><span>Kaynak</span><span className="text-purple-400">{weights.wResource}</span></span><input type="range" max="1" step="0.01" value={weights.wResource} onChange={(e) => normalizeWeights('res', parseFloat(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none" /></div>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-slate-700">
                                <span className="text-xs text-slate-400 font-bold">DÜNYA DÖNÜŞÜ</span>
                                <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                            </div>
                            <button onClick={handleCalculate} disabled={isCalculating} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded flex justify-center items-center gap-2 shadow-lg shadow-blue-900/50">
                                {isCalculating ? <span className="animate-pulse">...</span> : <><PlayIcon className="w-5 h-5" /> Hesapla</>}
                            </button>
                            <button onClick={handleCompareAll} disabled={isCalculating} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded flex justify-center items-center gap-2 border border-slate-600">
                                <ChartBarIcon className="w-5 h-5 text-yellow-400" /> Tümünü Kıyasla
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SAĞ PANEL (SONUÇLAR) */}
            <div className={`absolute top-24 right-4 z-20 transition-all duration-300 ${resultsOpen ? 'w-96' : 'w-12'}`}>
                <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="p-3 bg-slate-800/90 cursor-pointer flex justify-between items-center border-b border-slate-700 hover:bg-slate-700" onClick={() => setResultsOpen(!resultsOpen)}>
                        {resultsOpen ? <span className="font-semibold text-white flex gap-2"><ChartBarIcon className="w-5 h-5" /> Analiz Raporu</span> : <ChartBarIcon className="w-6 h-6 mx-auto text-green-400" />}
                    </div>

                    {resultsOpen && (
                        <div className="p-4 overflow-y-auto custom-scrollbar">
                            {showComparison && comparisonData.length > 0 ? (
                                <div className="space-y-6 animate-fadeIn">
                                    {/* Grafik */}
                                    <div className="h-48 w-full bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tick={{ dy: 5 }} />
                                                <YAxis stroke="#94a3b8" fontSize={10} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                                <Bar dataKey="cost" radius={[4, 4, 0, 0]} barSize={40}>
                                                    {comparisonData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Rozet */}
                                    <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
                                        <TrophyIcon className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
                                        <div>
                                            <div className="text-xs text-green-300 font-bold uppercase">En İyi Performans</div>
                                            <div className="text-sm text-white font-mono">{comparisonData[0].name}</div>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <div className="text-xs text-slate-400">Maliyet</div>
                                            <div className="text-lg font-bold text-white">{comparisonData[0].cost.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Tablo */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-1">
                                            <TableCellsIcon className="w-4 h-4" /> Detaylı Metrikler
                                        </h3>
                                        <div className="space-y-2">
                                            {comparisonData.map((item, idx) => (
                                                <div key={idx} className={`grid grid-cols-4 gap-2 text-xs p-2 rounded border ${idx === 0 ? 'bg-slate-700/50 border-yellow-500/50' : 'bg-slate-800/30 border-slate-700'}`}>
                                                    <div className="col-span-1 font-bold text-slate-200 flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                                        {item.name.split(' ')[0]}
                                                    </div>
                                                    <div className="text-center text-slate-400">{item.res.executionTime.toFixed(0)}ms</div>
                                                    <div className="text-center text-slate-400">{item.res.path.length} hop</div>
                                                    <div className="text-right font-mono text-slate-200">{item.cost.toFixed(1)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                !result ? (
                                    <div className="text-slate-500 text-center text-sm py-10">Analiz başlatılmadı.</div>
                                ) : (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded text-center">
                                            <div className="text-xs text-blue-300 uppercase font-bold">Seçilen Algoritma</div>
                                            <div className="text-lg text-white font-mono">{result.algorithmName}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-2 bg-black/40 rounded border border-slate-700 text-center">
                                                <div className="text-xs text-slate-500">Süre</div>
                                                <div className="text-sm text-white font-mono">{result.executionTime.toFixed(2)}ms</div>
                                            </div>
                                            <div className="p-2 bg-black/40 rounded border border-slate-700 text-center">
                                                <div className="text-xs text-slate-500">Uzunluk</div>
                                                <div className="text-sm text-white font-mono">{result.path.length} hops</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 pt-2 border-t border-slate-700">
                                            <div className="flex justify-between p-2 rounded bg-slate-800/50">
                                                <span className="text-xs text-slate-400">Gecikme</span>
                                                <span className="text-xs text-blue-300 font-mono">{result.metrics.totalDelay.toFixed(1)}ms</span>
                                            </div>
                                            <div className="flex justify-between p-2 rounded bg-slate-800/50">
                                                <span className="text-xs text-slate-400">Güvenilirlik</span>
                                                <span className="text-xs text-green-300 font-mono">{(result.metrics.totalReliability * 100).toFixed(4)}%</span>
                                            </div>
                                            <div className="flex justify-between p-2 rounded bg-slate-800/50">
                                                <span className="text-xs text-slate-400">Kaynak</span>
                                                <span className="text-xs text-purple-300 font-mono">{result.metrics.resourceCost.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 p-3 bg-gradient-to-r from-slate-800 to-slate-900 rounded border border-slate-600 flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-300">TOPLAM MALİYET</span>
                                            <span className="text-xl font-bold text-yellow-400 font-mono">{result.metrics.weightedCost.toFixed(3)}</span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;