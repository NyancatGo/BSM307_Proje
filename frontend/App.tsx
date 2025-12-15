import React, { useState, useEffect, useMemo } from 'react';
import { WorldMap } from './components/WorldMap';
import { generateGraph } from './services/graphGenerator';
import { runGeneticAlgorithm, runACO, runQLearning, runABC } from './services/algorithms';
import { GraphData, AlgorithmParams, AlgorithmType, PathResult } from './types';
import {
    CpuChipIcon,
    SignalIcon,
    ClockIcon,
    AdjustmentsHorizontalIcon,
    PlayIcon,
    ChartBarIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from '@heroicons/react/24/solid';

const App: React.FC = () => {
    // --- State ---
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [startNode, setStartNode] = useState<number>(0);
    const [endNode, setEndNode] = useState<number>(249);
    const [autoRotate, setAutoRotate] = useState<boolean>(true);

    const [weights, setWeights] = useState<AlgorithmParams>({
        wDelay: 0.33,
        wReliability: 0.33,
        wResource: 0.34,
    });

    const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>(AlgorithmType.GENETIC);
    const [result, setResult] = useState<PathResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Panels State
    const [settingsOpen, setSettingsOpen] = useState(true);
    const [resultsOpen, setResultsOpen] = useState(true);

    // --- Initialization ---
    useEffect(() => {
        // Generate graph once on mount
        const g = generateGraph(250);
        setGraph(g);
    }, []);

    // --- Handlers ---
    const handleCalculate = async () => {
        if (!graph) return;
        setIsCalculating(true);
        setResult(null);

        // Use setTimeout to allow UI to render "Calculating..." state
        setTimeout(() => {
            let res: PathResult;

            switch (selectedAlgo) {
                case AlgorithmType.GENETIC:
                    res = runGeneticAlgorithm(graph, startNode, endNode, weights);
                    break;
                case AlgorithmType.ACO:
                    res = runACO(graph, startNode, endNode, weights);
                    break;
                case AlgorithmType.Q_LEARNING:
                    res = runQLearning(graph, startNode, endNode, weights);
                    break;
                case AlgorithmType.ABC:
                    res = runABC(graph, startNode, endNode, weights);
                    break;
            }

            setResult(res);
            setIsCalculating(false);
            setResultsOpen(true);

            // --- İŞTE BU KISIM VAR MI? ---
            console.log("Python'a istek atılıyor..."); // <--- Bu satır var mı?
            fetch('http://localhost:5000/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    algorithm: selectedAlgo,
                    clientCost: res.metrics.weightedCost,
                    start: startNode,
                    end: endNode
                })
            })
                .then(r => r.json())
                .then(d => console.log("Backend'den cevap geldi:", d))
                .catch(e => console.error("HATA:", e));
        }, 100);
    };

    const normalizeWeights = (type: 'delay' | 'rel' | 'res', value: number) => {
        // Simple logic: update one, distribute difference to others proportionally
        // For this demo, we allow free input, but in calculation we might want to normalize to sum=1.
        // The prompt asks for adjustable weights. We will just set them directly.
        const newW = { ...weights };
        if (type === 'delay') newW.wDelay = value;
        if (type === 'rel') newW.wReliability = value;
        if (type === 'res') newW.wResource = value;
        setWeights(newW);
    };

    if (!graph) return <div className="flex h-screen w-screen items-center justify-center bg-black text-white">Ağ Oluşturuluyor...</div>;

    return (
        <div className="relative w-full h-full bg-black overflow-hidden font-sans text-slate-200">

            {/* 3D Background */}
            <div className="absolute inset-0 z-0">
                <WorldMap
                    graph={graph}
                    pathResult={result ? result.path : null}
                    startNode={startNode}
                    endNode={endNode}
                    autoRotate={autoRotate}
                />
            </div>

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
                <h1 className="text-2xl font-bold text-white tracking-wider flex items-center gap-2">
                    QoS Rotalama <span className="text-blue-400 font-light">Simülatörü</span>
                </h1>
                <p className="text-sm text-slate-400">Meta-Sezgisel ve RL Yaklaşımları</p>
            </div>

            {/* Control Panel (Collapsible) */}
            <div className={`absolute top-24 left-4 z-20 transition-all duration-300 ${settingsOpen ? 'w-80' : 'w-12'}`}>
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                    <div
                        className="p-3 bg-slate-800/90 cursor-pointer flex justify-between items-center border-b border-slate-700 hover:bg-slate-700 transition-colors"
                        onClick={() => setSettingsOpen(!settingsOpen)}
                    >
                        {settingsOpen && <span className="font-semibold text-white flex gap-2"><AdjustmentsHorizontalIcon className="w-5 h-5" /> Ayarlar</span>}
                        {!settingsOpen && <AdjustmentsHorizontalIcon className="w-6 h-6 mx-auto text-blue-400" />}
                        {settingsOpen && <ChevronUpIcon className="w-4 h-4" />}
                    </div>

                    {settingsOpen && (
                        <div className="p-4 space-y-6">
                            {/* Algorithm Selection */}
                            <div>
                                <label className="text-xs uppercase text-slate-400 font-bold mb-2 block">Algoritma</label>
                                <select
                                    className="w-full bg-black/50 border border-slate-600 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    value={selectedAlgo}
                                    onChange={(e) => setSelectedAlgo(e.target.value as AlgorithmType)}
                                >
                                    {Object.values(AlgorithmType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Nodes */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Kaynak (S)</label>
                                    <input
                                        type="number" min="0" max="249"
                                        className="w-full bg-black/50 border border-slate-600 rounded p-1 text-center"
                                        value={startNode}
                                        onChange={(e) => setStartNode(Math.min(249, Math.max(0, parseInt(e.target.value) || 0)))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Hedef (D)</label>
                                    <input
                                        type="number" min="0" max="249"
                                        className="w-full bg-black/50 border border-slate-600 rounded p-1 text-center"
                                        value={endNode}
                                        onChange={(e) => setEndNode(Math.min(249, Math.max(0, parseInt(e.target.value) || 0)))}
                                    />
                                </div>
                            </div>

                            {/* Weights */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase text-slate-400 font-bold block border-b border-slate-700 pb-1">QoS Ağırlıkları (W)</label>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> Gecikme</span>
                                        <span className="text-blue-400">{weights.wDelay.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={weights.wDelay}
                                        onChange={(e) => normalizeWeights('delay', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1"><SignalIcon className="w-3 h-3" /> Güvenilirlik</span>
                                        <span className="text-green-400">{weights.wReliability.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={weights.wReliability}
                                        onChange={(e) => normalizeWeights('rel', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="flex items-center gap-1"><CpuChipIcon className="w-3 h-3" /> Kaynak</span>
                                        <span className="text-purple-400">{weights.wResource.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={weights.wResource}
                                        onChange={(e) => normalizeWeights('res', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Auto Rotate Toggle */}
                            <div className="flex items-center justify-between py-2 border-t border-slate-700">
                                <span className="text-xs text-slate-400 font-bold uppercase">Dünya Dönüşü</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoRotate}
                                        onChange={(e) => setAutoRotate(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <button
                                onClick={handleCalculate}
                                disabled={isCalculating}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-900/50"
                            >
                                {isCalculating ? (
                                    <span className="animate-pulse">Hesaplanıyor...</span>
                                ) : (
                                    <>
                                        <PlayIcon className="w-5 h-5" /> Yolu Hesapla
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Panel */}
            <div className={`absolute top-24 right-4 z-20 transition-all duration-300 ${resultsOpen ? 'w-72' : 'w-12'}`}>
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                    <div
                        className="p-3 bg-slate-800/90 cursor-pointer flex justify-between items-center border-b border-slate-700 hover:bg-slate-700 transition-colors"
                        onClick={() => setResultsOpen(!resultsOpen)}
                    >
                        {resultsOpen && <span className="font-semibold text-white flex gap-2"><ChartBarIcon className="w-5 h-5" /> Sonuçlar</span>}
                        {!resultsOpen && <ChartBarIcon className="w-6 h-6 mx-auto text-green-400" />}
                        {resultsOpen && <ChevronDownIcon className="w-4 h-4" />}
                    </div>

                    {resultsOpen && (
                        <div className="p-4 min-h-[200px]">
                            {!result ? (
                                <div className="text-slate-500 text-center text-sm py-8">
                                    Simülasyonu başlatmak için "Yolu Hesapla" butonuna tıklayın.
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="text-xs text-slate-400">
                                        Algoritma: <span className="text-white font-mono">{result.algorithmName}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Süre: <span className="text-white font-mono">{result.executionTime.toFixed(2)}ms</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Yol Uzunluğu: <span className="text-white font-mono">{result.path.length} hops</span>
                                    </div>

                                    <div className="border-t border-slate-700 pt-3 space-y-2">
                                        <h3 className="text-xs uppercase font-bold text-slate-300">Metrikler</h3>

                                        <div className="flex justify-between items-center p-2 bg-black/40 rounded border border-slate-700/50">
                                            <span className="text-xs text-slate-400">Top. Gecikme</span>
                                            <span className="text-sm text-blue-300 font-mono">{result.metrics.totalDelay.toFixed(2)} ms</span>
                                        </div>

                                        <div className="flex justify-between items-center p-2 bg-black/40 rounded border border-slate-700/50">
                                            <span className="text-xs text-slate-400">Güvenilirlik</span>
                                            <span className="text-sm text-green-300 font-mono">{(result.metrics.totalReliability * 100).toFixed(4)} %</span>
                                        </div>

                                        <div className="flex justify-between items-center p-2 bg-black/40 rounded border border-slate-700/50">
                                            <span className="text-xs text-slate-400">Kay. Maliyeti</span>
                                            <span className="text-sm text-purple-300 font-mono">{result.metrics.resourceCost.toFixed(2)}</span>
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-dashed border-slate-700">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-white">Ağırlıklı Maliyet</span>
                                                <span className="text-lg font-bold text-yellow-400 font-mono">{result.metrics.weightedCost.toFixed(3)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default App;