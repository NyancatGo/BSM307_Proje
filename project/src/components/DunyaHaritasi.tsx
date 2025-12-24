import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import ForceGraph3D, { ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { CizgeVerisi } from "../tipler";
import { kimlikGetir } from "../services/algoritmalar";

// ----------------------------------------------------------------------------
// BİLEŞEN ÖZELLİKLERİ (PROPS)
// ----------------------------------------------------------------------------
interface DunyaHaritasiProps {
    graf: CizgeVerisi;         // Görüntülenecek Graf Verisi
    yolSonucu: number[];       // Seçilen/Hesaplanan Yol (Node ID Listesi)
    baslangicDugum: number;    // Başlangıç Düğüm ID
    bitisDugum: number;        // Bitiş Düğüm ID
    otomatikDonus: boolean;    // Dünya dönsün mü?
    algoritmaAdi: string;      // Çalışan algoritmanın adı (Renk için)
    istatistikler?: {          // Yolun hesaplanan metrikleri
        totalDelay: number;
        totalReliability: number;
        resourceCost: number;
        weightedCost: number;
    };
}

const DUNYA_YARICAPI = 60;
const YORUNGE_YARICAPI = 75;

// Throttle (Hız Sınırlayıcı) Yardımcı Fonksiyonu
// Performans için event handler'ların çalışma sıklığını sınırlar.
function hizSinirlayici<T extends (...args: any[]) => any>(fonksiyon: T, limit: number): T {
    let sinirlamada: boolean;
    return function (this: any, ...argumanlar: any[]) {
        const baglam = this;
        if (!sinirlamada) {
            fonksiyon.apply(baglam, argumanlar);
            sinirlamada = true;
            setTimeout(() => sinirlamada = false, limit);
        }
    } as T;
}

// ----------------------------------------------------------------------------
// ALGORİTMA RENK PALETİ
// ----------------------------------------------------------------------------
const ALGORITMA_RENKLERI: Record<string, string> = {
    GENETIC: "#facc15",      // SARI (Genetik)
    ACO: "#ef4444",          // KIRMIZI (Karınca)
    Q_LEARNING: "#a855f7",   // MOR (Q-Learning)
    ABC: "#3b82f6",          // MAVİ (Arı)

    // İngilizce İsim Eşleştirmeleri (Eski kod uyumu için)
    "Genetic Algorithm": "#facc15",
    "Ant Colony Optimization": "#ef4444",
    "Q-Learning (RL)": "#a855f7",
    "Artificial Bee Colony": "#3b82f6",

    // TÜRKÇE İSİM EŞLEŞTİRMELERİ
    "Genetik Algoritma (GA)": "#facc15",
    "Karınca Kolonisi (ACO)": "#ef4444",
    "Pekiştirmeli Öğrenme (Q-Learning)": "#a855f7", // İsim tipler.ts ile aynı olmalı
    "Q-Learning (Pekiştirmeli Öğrenme)": "#a855f7", // İsim tipler.ts ile aynı olmalı
    "Yapay Arı Kolonisi (ABC)": "#3b82f6",
};

// ----------------------------------------------------------------------------
// ANA BİLEŞEN: DÜNYA HARİTASI
// ----------------------------------------------------------------------------
const DunyaHaritasi: React.FC<DunyaHaritasiProps> = ({
    graf,
    yolSonucu,
    baslangicDugum,
    bitisDugum,
    otomatikDonus,
    algoritmaAdi,
    istatistikler
}) => {
    const grafikReferansi = useRef<ForceGraphMethods>(); // 3D Graf Motoru Referansı
    const sahneHazir = useRef(false);

    // 1. HIZLI ARAMA KÜMESİ: Performans için yol üzerindeki node'ları Set'te tutuyoruz
    const yolKumesi = useMemo(() => new Set(yolSonucu), [yolSonucu]);
    const algoritmaRengi = useMemo(() => ALGORITMA_RENKLERI[algoritmaAdi] ?? "#ffffff", [algoritmaAdi]);

    // 2. SABİT VERİ: Node pozisyonları sabit, fizik motoru kapalı
    // Bu kısım 250+ node olduğunda FPS düşmesini engellemek için kritik.
    const sabitVeri = useMemo(() => {
        if (!graf) return { nodes: [], links: [] };

        // Düğümleri Fibonacci Küresi algoritması ile dünya üzerine eşit dağıtıyoruz
        const dugumler = graf.nodes.map((d, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / graf.nodes.length);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            return {
                ...d,
                // Sabit pozisyonlar (Force Engine kullanmayacağız)
                fx: YORUNGE_YARICAPI * Math.sin(phi) * Math.cos(theta),
                fy: YORUNGE_YARICAPI * Math.sin(phi) * Math.sin(theta),
                fz: YORUNGE_YARICAPI * Math.cos(phi)
            };
        });
        return { nodes: dugumler, links: graf.links.map(l => ({ ...l })) };
    }, [graf]);

    // 3. BAĞLANTI KONTROLÜ (Bu bağlantı seçili yolda mı?)
    const baglantiYoldaMi = useCallback((baglanti: any) => {
        if (yolSonucu.length < 2) return false;
        const kaynak = kimlikGetir(baglanti.source);
        const hedef = kimlikGetir(baglanti.target);

        // Hızlı kontrol: İki uç da yol kümesinde olmalı
        if (!yolKumesi.has(kaynak) || !yolKumesi.has(hedef)) return false;

        // Kesin kontrol: Ardışık sıralama (Yol A -> B -> C ise, A-B ve B-C bağlantıları geçerlidir)
        for (let i = 0; i < yolSonucu.length - 1; i++) {
            const p1 = yolSonucu[i];
            const p2 = yolSonucu[i + 1];
            if ((kaynak === p1 && hedef === p2) || (kaynak === p2 && hedef === p1)) return true;
        }
        return false;
    }, [yolSonucu, yolKumesi]);

    // RENK VE STİL FONKSİYONLARI (Memoize edilmiş)
    const dugumRengiGetir = useCallback((d: any) => {
        if (d.id === baslangicDugum) return "#00ff44"; // YEŞİL (Başlangıç)
        if (d.id === bitisDugum) return "#ff3333";    // KIRMIZI (Bitiş)
        if (yolKumesi.has(d.id)) return "#ffcc00";    // SARI (Yol Üzeri)
        return "#0088ff"; // MAVİ (Pasif Düğüm)
    }, [baslangicDugum, bitisDugum, yolKumesi]);

    // X-Ray Materyal (Dünyanın içinden görünmesi için - depthTest: false)
    const xrayYolMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: algoritmaRengi, // Dinamik Renk (Algoritma Rengi)
        depthTest: false,      // Kritik: Dünyanın arkasında olsa bile çiz
        depthWrite: false,
        transparent: true,
        opacity: 0.8
    }), [algoritmaRengi]);

    const xrayYolGeo = useMemo(() => {
        const yariCap = 0.6; // Görünür çizgi kalınlığı
        return new THREE.CylinderGeometry(yariCap, yariCap, 1, 6);
    }, []);

    // GÖRÜNMEZ TIKLAMA ALANI (HITBOX) OLUŞTURMA
    const ortakHitboxMat = useMemo(() => new THREE.MeshBasicMaterial({
        visible: true,
        opacity: 0.0,
        transparent: true,
        depthWrite: false
    }), []);

    const ortakHitboxGeo = useMemo(() => {
        const yariCap = 6;
        const geo = new THREE.CylinderGeometry(yariCap, yariCap, 1, 4);
        geo.rotateZ(Math.PI / 2);
        return geo;
    }, []);

    const baglantiObjesiGetir = useCallback((baglanti: any) => {
        if (baglantiYoldaMi(baglanti)) {
            const grup = new THREE.Group();

            // 1. Görünür X-Ray Mesh
            const gorunurMesh = new THREE.Mesh(xrayYolGeo, xrayYolMat);
            gorunurMesh.renderOrder = 999; // Her şeyin üstünde çizilmesini garanti et
            grup.add(gorunurMesh);

            // 2. Tıklama Alanı
            const hitboxMesh = new THREE.Mesh(ortakHitboxGeo, ortakHitboxMat);
            grup.add(hitboxMesh);

            return grup;
        }
        return new THREE.Group();
    }, [baglantiYoldaMi, xrayYolGeo, xrayYolMat, ortakHitboxGeo, ortakHitboxMat]);

    const baglantiKonumGuncelle = useCallback((obje: any, { start, end }: any, baglanti: any) => {
        if (!baglantiYoldaMi(baglanti)) return false;

        const baslangic = new THREE.Vector3(start.x, start.y, start.z);
        const bitis = new THREE.Vector3(end.x, end.y, end.z);
        const orta = baslangic.clone().add(bitis).multiplyScalar(0.5);

        obje.position.copy(orta);
        const mesafe = baslangic.distanceTo(bitis);

        // Ana grup scale güncellemesi (Hem çizgi hem hitbox)
        obje.scale.set(1, mesafe, 1);
        obje.lookAt(bitis);
        obje.rotateX(Math.PI / 2);

        return false;
    }, [baglantiYoldaMi]);

    // LİNK GÖRÜNÜM AYARLARI
    // Yol linkleri için width=0 yapıyoruz çünkü baglantiObjesiGetir ile özel çiziyoruz.
    // Arka plan linklerini TAMAMEN GİZLİYORUZ (Kullanıcı talebi).
    const baglantiGenisligiGetir = useCallback((l: any) => baglantiYoldaMi(l) ? 0 : 0, [baglantiYoldaMi]);
    const baglantiRengiGetir = useCallback((l: any) => baglantiYoldaMi(l) ? "transparent" : "transparent", [baglantiYoldaMi]);
    const baglantiEgrilikGetir = useCallback((l: any) => baglantiYoldaMi(l) ? 0 : 0.1, [baglantiYoldaMi]);

    // 4. SAHNE KURULUMU (THREE.JS)
    useEffect(() => {
        const fg = grafikReferansi.current;
        if (!fg || sahneHazir.current) return;

        // Renderer Optimizasyonu
        const renderer = fg.renderer();
        if (renderer) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setPixelRatio(1);
            renderer.shadowMap.enabled = false;
        }

        const sahne = fg.scene();

        // Dünya Dokusu ve Mesh
        const dokuYukleyici = new THREE.TextureLoader();
        const dunyaDokusu = dokuYukleyici.load("//unpkg.com/three-globe/example/img/earth-night.jpg");
        const dunya = new THREE.Mesh(
            new THREE.SphereGeometry(DUNYA_YARICAPI, 24, 24),
            new THREE.MeshLambertMaterial({
                map: dunyaDokusu,
                color: 0xaaaaaa
            })
        );
        sahne.add(dunya);

        // Işıklandırma
        sahne.add(new THREE.AmbientLight(0xffffff, 0.6));
        const gunes = new THREE.DirectionalLight(0xffffff, 1.5);
        gunes.position.set(100, 50, 100);
        sahne.add(gunes);

        // Yıldızlar (Arka Plan)
        const yildizGeo = new THREE.BufferGeometry();
        const yildizSayisi = 200;
        const yildizKonumlari = new Float32Array(yildizSayisi * 3);
        for (let i = 0; i < yildizSayisi * 3; i++) yildizKonumlari[i] = (Math.random() - 0.5) * 3000;
        yildizGeo.setAttribute("position", new THREE.BufferAttribute(yildizKonumlari, 3));
        const yildizlar = new THREE.Points(yildizGeo, new THREE.PointsMaterial({ color: 0x888888, size: 1.5 }));
        sahne.add(yildizlar);

        sahneHazir.current = true;
    }, []);

    // 5. OTOMATİK DÖNÜŞ KONTROLÜ
    useEffect(() => {
        const fg = grafikReferansi.current;
        if (!fg) return;
        const kontroller = fg.controls() as any;
        if (kontroller) {
            kontroller.autoRotate = otomatikDonus;
            kontroller.autoRotateSpeed = 0.6;
            kontroller.maxDistance = 600;
            kontroller.minDistance = 80;
            kontroller.enableDamping = true;
            kontroller.dampingFactor = 0.1;
        }
    }, [otomatikDonus]);

    // 6. MOUSE TOOLTIP ETKİLEŞİMİ
    const [ipucuBilgisi, setIpucuBilgisi] = useState<{ x: number, y: number, baglanti: any } | null>(null);
    const fareKonumu = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const fareTakip = (olay: MouseEvent) => {
            fareKonumu.current = { x: olay.clientX, y: olay.clientY };
        };
        window.addEventListener('mousemove', fareTakip);
        return () => window.removeEventListener('mousemove', fareTakip);
    }, []);

    // 7. YOL YÖNÜ NORMALİZASYONU
    // Graf kütüphanesi linkleri karıştırabilir, biz yolun akış yönünü (Source -> Target) garanti altına alıyoruz.
    useEffect(() => {
        if (!yolSonucu || yolSonucu.length < 2) return;

        for (let i = 0; i < yolSonucu.length - 1; i++) {
            const u = yolSonucu[i];
            const v = yolSonucu[i + 1];

            const baglanti = sabitVeri.links.find((l: any) => {
                const s = kimlikGetir(l.source);
                const t = kimlikGetir(l.target);
                return (String(s) === String(u) && String(t) === String(v)) ||
                    (String(s) === String(v) && String(t) === String(u));
            });

            if (baglanti) {
                const s = kimlikGetir(baglanti.source);
                // Eğer link TERS ise (v -> u), kalıcı olarak değiştir.
                if (String(s) === String(v)) {
                    const temp = baglanti.source;
                    baglanti.source = baglanti.target;
                    baglanti.target = temp;
                }
            }
        }
    }, [yolSonucu, sabitVeri]);

    // 8. PAKET ANİMASYONU (VERİ AKIŞI GÖRSELLEŞTİRME)
    useEffect(() => {
        if (!yolSonucu || yolSonucu.length < 2) return;
        const fg = grafikReferansi.current;
        if (!fg) return;

        const TREN_ARALIGI = 2000;
        const HOP_SURESI = 1000 / 60 / 0.02;

        const zamanlayici = setInterval(() => {
            for (let i = 0; i < yolSonucu.length - 1; i++) {
                const u = yolSonucu[i];
                const v = yolSonucu[i + 1];

                const baglanti = sabitVeri.links.find((l: any) => {
                    const s = kimlikGetir(l.source);
                    const t = kimlikGetir(l.target);
                    return (String(s) === String(u) && String(t) === String(v)) ||
                        (String(s) === String(v) && String(t) === String(u));
                });

                if (baglanti) {
                    const s = typeof baglanti.source === 'object' ? (baglanti.source as any).id : baglanti.source;
                    if (String(s) === String(yolSonucu[yolSonucu.length - 1])) continue;

                    setTimeout(() => {
                        fg.emitParticle(baglanti);
                    }, i * (HOP_SURESI * 0.85));
                }
            }
        }, TREN_ARALIGI);

        return () => clearInterval(zamanlayici);
    }, [yolSonucu, sabitVeri]);

    const parcacikHiziGetir = useCallback((baglanti: any) => {
        if (baglantiYoldaMi(baglanti)) return 0.02;
        return 0;
    }, [baglantiYoldaMi]);



    // FARE İLE ÜZERİNE GELME (HOVER) OLAYLARI
    const baglantiUzerineGelme = useMemo(() => hizSinirlayici((baglanti: any) => {
        if (baglanti && baglantiYoldaMi(baglanti)) {
            setIpucuBilgisi({
                x: fareKonumu.current.x,
                y: fareKonumu.current.y,
                baglanti: baglanti
            });
            document.body.style.cursor = 'pointer';
        } else {
            setIpucuBilgisi(null);
            document.body.style.cursor = 'default';
        }
    }, 10), [baglantiYoldaMi]);

    const dugumUzerineGelme = useMemo(() => hizSinirlayici((dugum: any) => {
        if (dugum && yolKumesi.has(dugum.id)) {
            setIpucuBilgisi({
                x: fareKonumu.current.x,
                y: fareKonumu.current.y,
                baglanti: { source: dugum.id, target: dugum.id } // Dummy
            });
            document.body.style.cursor = 'pointer';
        } else if (!ipucuBilgisi?.baglanti) {
            setIpucuBilgisi(null);
            document.body.style.cursor = 'default';
        }
    }, 10), [yolKumesi, ipucuBilgisi]);

    return (
        <div className="w-full h-full relative bg-black">
            <ForceGraph3D
                ref={grafikReferansi}
                graphData={sabitVeri}
                backgroundColor="rgba(0,0,0,0)"

                rendererConfig={{
                    antialias: false,
                    alpha: true,
                    powerPreference: "high-performance",
                    stencil: false,
                    depth: true
                }}

                warmupTicks={0}
                cooldownTicks={0}
                enableNodeDrag={false}
                enableNavigationControls={true}
                showNavInfo={false}
                linkOpacity={1}

                nodeRelSize={2.5}
                nodeColor={dugumRengiGetir}
                nodeLabel={(node: any) => `Node ${node.id}`}
                nodeResolution={6}

                linkWidth={baglantiGenisligiGetir}
                linkColor={baglantiRengiGetir}
                linkCurvature={baglantiEgrilikGetir}
                linkResolution={5}

                linkDirectionalParticles={0}
                linkDirectionalParticleWidth={5}
                linkDirectionalParticleResolution={8}
                linkDirectionalParticleColor={() => "#ffffff"}
                linkDirectionalParticleSpeed={parcacikHiziGetir}

                linkThreeObjectExtend={true}
                linkThreeObject={baglantiObjesiGetir}
                linkPositionUpdate={baglantiKonumGuncelle}
                onLinkHover={baglantiUzerineGelme}
                onNodeHover={dugumUzerineGelme}
            />

            {/* ÖZEL İPUCU KUTUSU (TOOLTIP) */}
            {ipucuBilgisi && ipucuBilgisi.baglanti && istatistikler && (
                <div style={{
                    position: 'fixed',
                    left: ipucuBilgisi.x + 10,
                    top: ipucuBilgisi.y + 10,
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    border: '1px solid #475569',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                    maxWidth: '240px'
                }}>
                    <div className="font-bold mb-1 text-yellow-400 border-b border-gray-700 pb-1">Seçili Rota Özeti</div>

                    <div className="flex flex-col gap-1 mb-2">
                        <div className="text-xs text-gray-400">Algoritma: <span className="text-gray-200 font-semibold">{algoritmaAdi}</span></div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-400">Toplam Gecikme:</span>
                            <span className="text-blue-400 font-mono font-bold">{istatistikler.totalDelay.toFixed(2)} ms</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-400">Toplam Güvenilirlik:</span>
                            <span className="text-green-400 font-mono font-bold">%{(istatistikler.totalReliability * 100).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-400">Kaynak Tüketimi:</span>
                            <span className="text-purple-400 font-mono font-bold">{istatistikler.resourceCost.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="text-[10px] text-gray-500 mb-1">ROTA (Node ID'leri):</div>
                        <div className="text-[10px] text-white font-mono leading-tight break-all bg-gray-900/50 p-1 rounded">
                            {yolSonucu.join(" → ")}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default DunyaHaritasi;
