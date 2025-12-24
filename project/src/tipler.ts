// src/tipler.ts

// ----------------------------------------------------------------------------
// DÜĞÜM (NODE) YAPISI
// ----------------------------------------------------------------------------
export interface Dugum {
    id: number;              // Benzersiz Kimlik
    x: number;               // X Koordinatı (3D Uzay)
    y: number;               // Y Koordinatı
    z: number;               // Z Koordinatı
    processingDelay?: number; // İşleme Gecikmesi (ms) - Opsiyonel
    reliability?: number;    // Güvenilirlik Oranı (0.0 - 1.0)
    connections?: number[];  // Bağlantı Listesi (Cache için)
}

// ----------------------------------------------------------------------------
// BAĞLANTI (LINK) YAPISI
// ----------------------------------------------------------------------------
export interface Baglanti {
    source: number;          // Kaynak Düğüm ID
    target: number;          // Hedef Düğüm ID
    bandwidth: number;       // Bant Genişliği (Mbps)
    propagationDelay: number;// İletim Gecikmesi (ms)
    reliability: number;     // Bağlantı Güvenilirliği (0.0 - 1.0)
    score?: number;          // Hesaplanan Skor (Algoritma için)
    logReliability?: number; // Önceden hesaplanmış -log(reliability)
    resourceCost?: number;   // Önceden hesaplanmış kaynak maliyeti
}

// ----------------------------------------------------------------------------
// ÇİZGE (GRAPH) VERİSİ
// ----------------------------------------------------------------------------
export interface CizgeVerisi {
    nodes: Dugum[];           // Düğümler Listesi
    links: Baglanti[];        // Bağlantılar Listesi
    adjacency: Map<number, Baglanti[]>; // Komşuluk Listesi (Hızlı Erişim)
}

// ----------------------------------------------------------------------------
// ALGORİTMA TİPLERİ (ENUM)
// ----------------------------------------------------------------------------
export enum AlgoritmaTipi {
    GENETIC = 'Genetik Algoritma',
    ACO = 'Karınca Kolonisi',
    Q_LEARNING = 'Pekiştirmeli Öğrenme (Q-Learning)',
    ABC = 'Yapay Arı Kolonisi'
}

// ----------------------------------------------------------------------------
// ALGORİTMA PARAMETRELERİ
// ----------------------------------------------------------------------------
export interface AlgoritmaParametreleri {
    // Ağırlıklar (Kullanıcı Slider'ları)
    wGecikme?: number;       // Gecikme Ağırlığı (Delay Weight)
    wGuvenilirlik?: number;  // Güvenilirlik Ağırlığı (Reliability Weight)
    wKaynak?: number;        // Kaynak Maliyeti Ağırlığı (Resource Weight)

    // Algoritma Özel Ayarları
    generations?: number;    // Nesil Sayısı (Genetik)
    populationSize?: number; // Popülasyon Büyüklüğü
    mutationRate?: number;   // Mutasyon Oranı
    iterations?: number;     // İterasyon Sayısı (Genel)
    ants?: number;           // Karınca Sayısı (ACO)
    alpha?: number;          // Feromon Önemi (ACO)
    beta?: number;           // Sezgisel Önem (ACO)
    evaporation?: number;    // Buharlaşma Oranı (ACO)
    episodes?: number;       // Bölüm Sayısı (Q-Learning)
    learningRate?: number;   // Öğrenme Oranı (Alpha - RL)
    discountFactor?: number; // İndirim Faktörü (Gamma - RL)
    epsilon?: number;        // Keşfetme Oranı (Epsilon - RL)
    limit?: number;          // Limit Değeri (ABC)
    seed?: number;           // Tekrarlanabilirlik Çekirdeği
}

// ----------------------------------------------------------------------------
// YOL METRİKLERİ (SONUÇ DEĞERLERİ)
// ----------------------------------------------------------------------------
export interface YolMetrikleri {
    weightedCost: number;    // Ağırlıklı Toplam Maliyet
    totalDelay: number;      // Toplam Gecikme (ms)
    totalReliability: number;// Toplam Güvenilirlik (Çarpım)
    resourceCost: number;    // Kaynak Maliyeti

    // Ara Hesaplamalar
    totalLogRel?: number;    // Logaritmik Güvenilirlik (İşlem kolaylığı için)
    reliabilityCost?: number;// Güvenilirlik Maliyeti (Dönüştürülmüş)
    hopCount?: number;       // Atla (Hop) Sayısı
}

// ----------------------------------------------------------------------------
// YOL SONUCU (ÇIKTI)
// ----------------------------------------------------------------------------
export interface YolSonucu {
    path: number[];           // Yol (Node ID Listesi)
    metrics: YolMetrikleri;   // Hesaplanan Metrikler
    executionTime: number;    // Çalışma Süresi (ms)
    algorithmName?: string;   // Algoritma Adı
    score?: number;           // Skor
}

// Takma Ad (Alias)
export type SonucTipi = YolSonucu;
