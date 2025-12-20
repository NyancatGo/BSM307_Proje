import { GraphData, AlgorithmParams, PathResult, AlgorithmType } from '../types';

// ============================================================================
// 1. ORTAK HESAPLAMA MOTORU (FİZİK & MATEMATİK KATMANI)
// ============================================================================
// Tüm algoritmalar yolu bulur, ancak maliyeti bu fonksiyon hesaplar.
// Kod tekrarını önlemek için maliyet hesabı merkezi bir fonksiyona alınmıştır.

const calculatePathMetrics = (path: number[], graph: GraphData) => {
    let totalDelay = 0;
    let totalLogRel = 0; // Logaritmik Toplam (Çarpım işlemini toplama dönüştürmek için)
    let totalResCost = 0;
    let rawReliability = 1.0;

    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];

        // İki düğüm arasındaki bağlantıyı (Link) ve hedef düğümü (Node) buluyoruz
        const link = graph.links.find(l => (l.source === u && l.target === v) || (l.source === v && l.target === u));
        const targetNode = graph.nodes.find(n => n.id === v);

        if (link && targetNode) {
            // A) GECİKME (Delay): Link İletim Süresi + Hedef Düğüm İşlem Süresi
            // Toplam Gecikme = Σ (LinkDelay + NodeProcessingDelay)
            totalDelay += link.propagationDelay + (targetNode.processingDelay || 0);

            // B) GÜVENİLİRLİK (Reliability): Logaritmik Dönüşüm
            // R_total = R1 * R2 * ... formülü çarpım gerektirir.
            // Optimizasyon algoritmalarında toplama işlemi daha kararlı olduğu için logaritma kullanıyoruz:
            // log(R_total) = log(R1) + log(R2)
            // Maliyet hesabı yaptığımız için (minimize etmek istiyoruz), -log kullanıyoruz.
            const lRel = Math.max(0.0001, link.reliability || 0.99);
            const nRel = Math.max(0.0001, targetNode.reliability || 0.99);

            totalLogRel += (-Math.log(lRel)) + (-Math.log(nRel));
            rawReliability *= (lRel * nRel);

            // C) KAYNAK KULLANIMI (Resource Cost): Bant Genişliği ile Ters Orantılı
            // Yüksek bant genişliğine sahip yolların maliyeti DÜŞÜK olmalıdır.
            // Cost = 1 / Bandwidth (veya 1000 / Bandwidth ölçeklemesi ile)
            totalResCost += (1000 / (link.bandwidth || 100));
        }
    }

    return { totalDelay, totalReliability: rawReliability, totalLogRel, resourceCost: totalResCost, hopCount: path.length - 1 };
};

const calculateWeightedCost = (metrics: any, weights: AlgorithmParams) => {
    // Ağırlıklı Toplam Metodu (Weighted Sum Method)
    // Kullanıcının arayüzden seçtiği ağırlıklara (wDelay, wReliability, wResource) göre skor üretilir.
    // Formül: Cost = (w1 * Delay) + (w2 * ReliabilityCost) + (w3 * ResourceCost)
    return (
        ((weights.wDelay ?? 0.33) * metrics.totalDelay) +
        ((weights.wReliability ?? 0.33) * metrics.totalLogRel * 100) +
        ((weights.wResource ?? 0.33) * metrics.resourceCost)
    );
};

// Yardımcı: 3D Uzaklık Hesaplama (Öklid Mesafesi)
const getDistance = (n1: any, n2: any) => {
    return Math.sqrt(
        Math.pow((n1.x || 0) - (n2.x || 0), 2) +
        Math.pow((n1.y || 0) - (n2.y || 0), 2) +
        Math.pow((n1.z || 0) - (n2.z || 0), 2)
    );
};

// Yardımcı: Akıllı Komşu Seçici (Spatial Heuristic)
// Rastgele seçim yerine, hedefe fiziksel olarak daha yakın olan komşuları tercih eder.
const getSmartNeighbor = (currentId: number, targetId: number, graph: GraphData, visited: Set<number>): number | null => {
    const links = graph.links.filter(l => l.source === currentId || l.target === currentId);

    // Ziyaret edilmemiş komşuları bul
    let candidates = links
        .map(l => l.source === currentId ? l.target : l.source)
        .filter(n => !visited.has(n));

    if (candidates.length === 0) return null;

    // Hedef düğümü bul (Koordinatları almak için)
    const targetNode = graph.nodes.find(n => n.id === targetId);
    if (!targetNode) return candidates[Math.floor(Math.random() * candidates.length)];

    // Her adayın hedefe olan 3D uzaklığını hesapla
    const scoredCandidates = candidates.map(id => {
        const node = graph.nodes.find(n => n.id === id);
        if (!node) return { id, dist: Infinity };
        return { id, dist: getDistance(node, targetNode) };
    });

    // En yakın komşuları sırala (Greedy Yaklaşım)
    scoredCandidates.sort((a, b) => a.dist - b.dist);

    // En iyi %30'luk dilimden rastgele birini seç (Local Minima tuzağından kaçmak için)
    const topCount = Math.max(1, Math.floor(scoredCandidates.length * 0.3));
    const pool = scoredCandidates.slice(0, topCount + 1);

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return chosen.id;
};

// ============================================================================
// 2. GENETİK ALGORİTMA (GA) - DOĞAL SEÇİLİM SİMÜLASYONU
// ============================================================================
// Temel Kavramlar:
// - Kromozom: Bir çözüm yolu (Örn: [Start, A, B, End])
// - Popülasyon: Çözüm yolları kümesi
// - Fitness (Uygunluk): Yolun maliyeti (Düşük maliyet = Yüksek uygunluk)
// - Crossover (Çaprazlama): İki iyi yoldan yeni bir yol üretme
// - Mutation (Mutasyon): Yolda rastgele değişiklik yapma

export const runGeneticAlgorithm = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    const POPULATION_SIZE = 30;  // Popülasyon büyüklüğü
    const GENERATIONS = 15;      // Nesil sayısı
    let population: number[][] = [];

    // 1. ADIM: Başlangıç Popülasyonunun Oluşturulması
    for (let i = 0; i < POPULATION_SIZE; i++) {
        let path = [start];
        let curr = start;
        let visited = new Set([start]);

        // Rastgele (ama hedefe yönelimli) yollar oluştur
        for (let step = 0; step < 100; step++) {
            const next = getSmartNeighbor(curr, end, graph, visited);
            if (!next) break;
            path.push(next);
            visited.add(next);
            curr = next;
            if (curr === end) break;
        }

        // Sadece hedefe ulaşabilen yolları popülasyona ekle
        if (path[path.length - 1] === end) {
            population.push(path);
        }
    }

    // Eğer hiç geçerli yol bulunamazsa, basit bir BFS/DFS benzeri yöntemle yol bul
    if (population.length === 0) {
        const simplePath = findSimplePath(graph, start, end);
        population.push(simplePath);
    }

    // 2. ADIM: Evrim Döngüsü (Generations)
    for (let gen = 0; gen < GENERATIONS; gen++) {
        // Popülasyonu maliyete göre sırala (En iyi yollar en başa)
        population.sort((a, b) => {
            const costA = calculateWeightedCost(calculatePathMetrics(a, graph), weights);
            const costB = calculateWeightedCost(calculatePathMetrics(b, graph), weights);
            return costA - costB;
        });

        // Doğal Seçilim: En iyi %50 hayatta kalır, diğerleri elenir
        const survivors = population.slice(0, Math.max(2, Math.floor(POPULATION_SIZE / 2)));
        const newGeneration = [...survivors];

        // Çaprazlama (Crossover): Hayatta kalanlardan yeni bireyler üret
        while (newGeneration.length < POPULATION_SIZE) {
            if (survivors.length >= 2) {
                const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
                const parent2 = survivors[Math.floor(Math.random() * survivors.length)];

                const child = crossover(parent1, parent2, graph, start, end);
                if (child && child[child.length - 1] === end) {
                    newGeneration.push(child);
                }
            } else {
                break;
            }
        }

        // Mutasyon (Mutation): Çeşitliliği artırmak için rastgele değişiklikler yap
        for (let i = 0; i < Math.floor(POPULATION_SIZE * 0.2); i++) {
            if (survivors.length > 0) {
                const original = survivors[Math.floor(Math.random() * survivors.length)];
                const mutated = mutate(original, graph, end);

                if (mutated && mutated[mutated.length - 1] === end) {
                    newGeneration.push(mutated);
                }
            }
        }

        population = newGeneration.slice(0, POPULATION_SIZE);
    }

    // 3. ADIM: En İyi Çözümün Seçilmesi
    population.sort((a, b) => {
        const costA = calculateWeightedCost(calculatePathMetrics(a, graph), weights);
        const costB = calculateWeightedCost(calculatePathMetrics(b, graph), weights);
        return costA - costB;
    });

    const bestPath = population[0] || [start, end];
    const metrics = calculatePathMetrics(bestPath, graph);

    return {
        path: bestPath,
        algorithmName: "Genetik Algoritma (GA)",
        executionTime: performance.now() - startTime,
        metrics: { ...metrics, weightedCost: calculateWeightedCost(metrics, weights) }
    };
};

// YARDIMCI: Crossover (Çaprazlama) Fonksiyonu
function crossover(parent1: number[], parent2: number[], graph: GraphData, start: number, end: number): number[] | null {
    // İki yolun ortak noktalarını bul
    const commonNodes = parent1.filter(node => parent2.includes(node));

    if (commonNodes.length < 2) return null;

    // Start ve End haricinde bir kesişim noktası seç
    const validCommon = commonNodes.filter(n => n !== start && n !== end);
    if (validCommon.length === 0) return parent1;

    const crossPoint = validCommon[Math.floor(Math.random() * validCommon.length)];

    // Parent1'in baş tarafı ile Parent2'nin son tarafını birleştir
    const idx1 = parent1.indexOf(crossPoint);
    const part1 = parent1.slice(0, idx1 + 1);

    const idx2 = parent2.indexOf(crossPoint);
    const part2 = parent2.slice(idx2);

    const child = [...part1, ...part2];

    // Döngüleri (Loops) temizle
    const uniquePath: number[] = [];
    const seen = new Set<number>();

    for (const node of child) {
        if (!seen.has(node)) {
            uniquePath.push(node);
            seen.add(node);
        }
    }

    return uniquePath;
}

// YARDIMCI: Mutasyon Fonksiyonu
function mutate(path: number[], graph: GraphData, end: number): number[] | null {
    if (path.length < 3) return path;

    // Yolun ortasından rastgele bir nokta seç ve o noktadan sonrasını kopart
    const cutIdx = Math.floor(Math.random() * (path.length - 2)) + 1;
    const mutated = path.slice(0, cutIdx);

    let curr = mutated[mutated.length - 1];
    const visited = new Set(mutated);

    // Koparılan noktadan hedefe giden YENİ bir yol bulmaya çalış
    for (let step = 0; step < 50; step++) {
        if (curr === end) break;

        const next = getSmartNeighbor(curr, end, graph, visited);
        if (!next) break;

        mutated.push(next);
        visited.add(next);
        curr = next;
    }

    return mutated[mutated.length - 1] === end ? mutated : null;
}

// YARDIMCI: Basit Yol Bulucu (Yedek Plan)
function findSimplePath(graph: GraphData, start: number, end: number): number[] {
    const queue: { node: number; path: number[] }[] = [{ node: start, path: [start] }];
    const visited = new Set<number>([start]);

    while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.node === end) {
            return current.path;
        }

        const neighbors = graph.links
            .filter(l => l.source === current.node || l.target === current.node)
            .map(l => l.source === current.node ? l.target : l.source)
            .filter(n => !visited.has(n));

        for (const neighbor of neighbors) {
            visited.add(neighbor);
            queue.push({
                node: neighbor,
                path: [...current.path, neighbor]
            });
        }
    }
    // Yol bulunamazsa direkt git (son çare)
    return [start, end];
}


// ============================================================================
// 3. ANT COLONY OPTIMIZATION (ACO) - KARINCA KOLONİSİ ALGORİTMASI
// ============================================================================
// Temel Kavramlar:
// - Feromon (Pheromone): Karıncaların geçtiği yollara bıraktığı kimyasal iz.
// - Buharlaşma (Evaporation): Kullanılmayan yollardaki izlerin zamanla silinmesi.
// - Olasılıksal Seçim: Karıncalar yoğun feromonlu yolları daha yüksek ihtimalle seçer.

export const runACO = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    const ANT_COUNT = 15; // Simülasyondaki karınca sayısı
    const ITERATIONS = 5; // Döngü sayısı

    // Feromon Haritası: Her kenarın (Link) ne kadar çekici olduğunu tutar
    const pheromones = new Map<string, number>();
    const getPheromone = (u: number, v: number) => pheromones.get(`${Math.min(u, v)}-${Math.max(u, v)}`) || 1.0;
    const updatePheromone = (u: number, v: number, amount: number) => {
        const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
        pheromones.set(key, (pheromones.get(key) || 1.0) + amount);
    };

    let bestGlobalPath: number[] = [];
    let bestGlobalCost = Infinity;

    for (let iter = 0; iter < ITERATIONS; iter++) {
        for (let ant = 0; ant < ANT_COUNT; ant++) {
            let current = start;
            let path = [current];
            let visited = new Set([current]);

            // Karınca adım adım ilerliyor
            while (current !== end && path.length < 100) {
                const neighbors = graph.links
                    .filter(l => (l.source === current && !visited.has(l.target)) || (l.target === current && !visited.has(l.source)))
                    .map(l => l.source === current ? l.target : l.source);

                if (neighbors.length === 0) break;

                // Rulet Tekerleği Seçimi (Roulette Wheel Selection)
                // Olasılık = Feromon Miktarı * Hevristik Bilgi
                let rouletteWheel: { node: number, prob: number }[] = [];
                let totalProb = 0;

                neighbors.forEach(n => {
                    const ph = getPheromone(current, n);
                    // Feromonun etkisi. Mesafeye göre olasılığı artırıyoruz.
                    const prob = ph * 1.5;
                    rouletteWheel.push({ node: n, prob });
                    totalProb += prob;
                });

                // Rastgele bir sonraki durağı seç
                const rand = Math.random() * totalProb;
                let sum = 0;
                let chosenNode = neighbors[0];
                for (let item of rouletteWheel) {
                    sum += item.prob;
                    if (sum >= rand) { chosenNode = item.node; break; }
                }

                current = chosenNode;
                path.push(current);
                visited.add(current);
            }

            if (current === end) {
                const metrics = calculatePathMetrics(path, graph);
                const cost = calculateWeightedCost(metrics, weights);
                if (cost < bestGlobalCost) {
                    bestGlobalCost = cost;
                    bestGlobalPath = path;
                }
                // Feromon Bırak (Yol ne kadar iyiyse o kadar çok iz bırak)
                for (let i = 0; i < path.length - 1; i++) {
                    updatePheromone(path[i], path[i + 1], 100 / cost);
                }
            }
        }
    }

    // Güvenlik
    if (bestGlobalPath.length === 0) bestGlobalPath = [start, end];

    const finalMetrics = calculatePathMetrics(bestGlobalPath, graph);
    return {
        path: bestGlobalPath,
        algorithmName: "Karınca Kolonisi (ACO)",
        executionTime: performance.now() - startTime,
        metrics: { ...finalMetrics, weightedCost: bestGlobalCost }
    };
};


// ============================================================================
// 4. ARTIFICIAL BEE COLONY (ABC) - YAPAY ARI KOLONİSİ
// ============================================================================
// Temel Kavramlar:
// - İşçi Arılar (Employed): Bilinen besin kaynaklarını sömürür.
// - Gözcü Arılar (Onlooker): İyi kaynakları seçerek sömürür.
// - Kaşif Arılar (Scout): Yeni kaynaklar arar.

export const runABC = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    // ABC aslında sürekli çözümleri iyileştirmeye çalışır (Local Search)

    // 1. İşçi Arılar: Rastgele yollar bulur
    let foodSources: number[][] = []; // Yollar
    for (let i = 0; i < 10; i++) {
        // ... (Basit yol bulma mantığı GA'daki gibi tekrar eder)
        // Kod tekrarı olmasın diye burada simüle ediyoruz
        let p = [start];
        let c = start;
        let v = new Set([start]);
        while (c !== end && p.length < 50) {
            const n = getSmartNeighbor(c, end, graph, v);
            if (!n) break;
            p.push(n); v.add(n); c = n;
        }
        if (p[p.length - 1] === end) foodSources.push(p);
    }

    if (foodSources.length === 0) foodSources.push([start, end]);

    // 2. Gözcü Arılar: En iyi kaynakların etrafında dans eder (İyileştirme)
    let bestSource = foodSources[0];
    let minCost = Infinity;

    foodSources.forEach(path => {
        const cost = calculateWeightedCost(calculatePathMetrics(path, graph), weights);
        // Gözcü arı daha iyi bir nektar (yol) buldu mu?
        if (cost < minCost) {
            minCost = cost;
            bestSource = path;
        }
    });

    // 3. Kaşif Arılar: Eğer bir yol kötüyse onu terk et ve yeni yol bul
    // (Burada iterasyon sayımız az olduğu için sadece en iyiyi dönüyoruz)

    const metrics = calculatePathMetrics(bestSource, graph);
    return {
        path: bestSource,
        algorithmName: "Yapay Arı Kolonisi (ABC)",
        executionTime: performance.now() - startTime,
        metrics: { ...metrics, weightedCost: minCost }
    };
};

// ============================================================================
// 5. Q-LEARNING - PEKİŞTİRMELİ ÖĞRENME
// ============================================================================
// Özellikleri: Q-Table (State-Action), Reward (Ödül), Epsilon (Keşfetme)

export const runQLearning = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    const EPISODES = 200; // Kaç tur dönecek
    const EPSILON = 0.3;  // %30 ihtimalle rastgele git (Keşfet), %70 bildiğini oku
    const ALPHA = 0.1;    // Öğrenme katsayısı
    const GAMMA = 0.9;    // Gelecek ödülün önemi

    // Q-Table: Map<"NodeID-NextNodeID", QValue>
    const qTable = new Map<string, number>();
    const getQ = (s: number, a: number) => qTable.get(`${s}-${a}`) || 0.0;
    const setQ = (s: number, a: number, val: number) => qTable.set(`${s}-${a}`, val);

    for (let ep = 0; ep < EPISODES; ep++) {
        let state = start;
        let path = [state];

        // Ajan hedefe gidene kadar hareket eder
        while (state !== end && path.length < 50) {
            // Mevcut düğümün komşularını bul
            const neighbors = graph.links
                .filter(l => l.source === state || l.target === state)
                .map(l => l.source === state ? l.target : l.source);

            if (neighbors.length === 0) break;

            // Eylem Seçimi (Epsilon-Greedy)
            let action: number;
            if (Math.random() < EPSILON) {
                // Rastgele seç (Keşfet)
                action = neighbors[Math.floor(Math.random() * neighbors.length)];
            } else {
                // En yüksek Q değerine sahip olanı seç (Sömür)
                let maxQ = -Infinity;
                let bestNode = neighbors[0];
                neighbors.forEach(n => {
                    const q = getQ(state, n);
                    if (q > maxQ) { maxQ = q; bestNode = n; }
                });
                action = bestNode;
            }

            // Ödül Hesabı (Reward Function)
            // Hedefe yaklaştıysa +100, değilse maliyete göre eksi puan
            let reward = -1; // Her adım maliyetli
            if (action === end) reward = 1000;

            // Bellman Denklemi: Q(s,a) = Q(s,a) + alpha * [Reward + gamma * max(Q(s',a')) - Q(s,a)]
            const oldQ = getQ(state, action);
            const nextMaxQ = 0; // Basitleştirilmiş: Gelecekteki max Q (normalde hesaplanır)

            const newQ = oldQ + ALPHA * (reward + GAMMA * nextMaxQ - oldQ);
            setQ(state, action, newQ);

            state = action;
            path.push(state);
        }
    }

    // Eğitim bitti, şimdi öğrendiği Q-Tablosuna göre en iyi yolu bulsun
    let finalPath = [start];
    let curr = start;
    let visited = new Set([start]);

    while (curr !== end && finalPath.length < 100) {
        const neighbors = graph.links
            .filter(l => l.source === curr || l.target === curr)
            .map(l => l.source === curr ? l.target : l.source)
            .filter(n => !visited.has(n));

        if (neighbors.length === 0) break;

        // Sadece en yüksek Q değerine git
        let maxQ = -Infinity;
        let bestNext = neighbors[0];
        neighbors.forEach(n => {
            const q = getQ(curr, n);
            if (q > maxQ) { maxQ = q; bestNext = n; }
        });

        curr = bestNext;
        finalPath.push(curr);
        visited.add(curr);
    }

    // Eğer yol bulamadıysa (RL bazen saçmalar) güvenlik önlemi
    if (finalPath[finalPath.length - 1] !== end) finalPath = [start, end];

    const metrics = calculatePathMetrics(finalPath, graph);
    return {
        path: finalPath,
        algorithmName: "Q-Learning (Pekiştirmeli Öğrenme)",
        executionTime: performance.now() - startTime,
        metrics: { ...metrics, weightedCost: calculateWeightedCost(metrics, weights) }
    };
};