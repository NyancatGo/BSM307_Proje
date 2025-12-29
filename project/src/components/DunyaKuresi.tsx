import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import ForceGraph3D, { ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { CizgeVerisi } from "../tipler";
import { kimlikGetir } from "../services/algoritmalar";

// ----------------------------------------------------------------------------
// GLOBAL OPTİMİZASYON NESNELERİ (RAM Tasarrufu)
// ----------------------------------------------------------------------------
// Görünmeyen linkler için sürekli yeni Object3D yaratmak yerine
// tek bir boş nesneyi referans olarak dönüyoruz. Çöp toplayıcı (GC) rahatlıyor.
const BOS_NESNE = new THREE.Object3D();

// ----------------------------------------------------------------------------
// BİLEŞEN ÖZELLİKLERİ (PROPS)
// ----------------------------------------------------------------------------
interface DunyaHaritasiProps {
    graf: CizgeVerisi;
    yolSonucu: number[];
    baslangicDugum: number;
    bitisDugum: number;
    otomatikDonus: boolean;
    algoritmaAdi: string;
    istatistikler?: {
        totalDelay: number;
        totalReliability: number;
        resourceCost: number;
        weightedCost: number;
    };
}

const DUNYA_YARICAPI = 60;
const YORUNGE_YARICAPI = 75;

// Throttle (Hız Sınırlayıcı)
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

    "Genetic Algorithm": "#facc15",
    "Ant Colony Optimization": "#ef4444",
    "Q-Learning (RL)": "#a855f7",
    "Artificial Bee Colony": "#3b82f6",

    "Genetik Algoritma (GA)": "#facc15",
    "Karınca Kolonisi (ACO)": "#ef4444",
    "Pekiştirmeli Öğrenme (Q-Learning)": "#a855f7",
    "Q-Learning (Pekiştirmeli Öğrenme)": "#a855f7",
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
    const grafikReferansi = useRef<ForceGraphMethods>();
    const sahneHazir = useRef(false);

    // 3. OPTİMİZASYON: TOOLTIP (State yerine Ref + Manuel DOM)
    // React'in node removal hatasını önlemek için (removeChild error)
    // Tooltip elementini React DOM dışında tamamen manuel yönetiyoruz.
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Tooltip elementini yarat
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.display = 'none';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        el.style.color = '#fff';
        el.style.padding = '8px 12px';
        el.style.borderRadius = '6px';
        el.style.fontSize = '12px';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        el.style.border = '1px solid #475569';
        el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
        el.style.minWidth = '150px';

        document.body.appendChild(el);
        tooltipRef.current = el;

        return () => {
            // Cleanup: Unmount sırasında güvenli bir şekilde kaldır
            if (document.body.contains(el)) {
                document.body.removeChild(el);
            }
        };
    }, []);

    // 1. HIZLI ARAMA KÜMESİ
    const yolKumesi = useMemo(() => new Set(yolSonucu), [yolSonucu]);
    const algoritmaRengi = useMemo(() => ALGORITMA_RENKLERI[algoritmaAdi] ?? "#ffffff", [algoritmaAdi]);

    // 2. SABİT VERİ (Node Pinning)
    const sabitVeri = useMemo(() => {
        if (!graf) return { nodes: [], links: [] };

        const dugumler = graf.nodes.map((d, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / graf.nodes.length);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            return {
                ...d,
                fx: YORUNGE_YARICAPI * Math.sin(phi) * Math.cos(theta),
                fy: YORUNGE_YARICAPI * Math.sin(phi) * Math.sin(theta),
                fz: YORUNGE_YARICAPI * Math.cos(phi)
            };
        });
        return { nodes: dugumler, links: graf.links.map(l => ({ ...l })) };
    }, [graf]);

    // 3. BAĞLANTI KONTROLÜ
    const baglantiYoldaMi = useCallback((baglanti: any) => {
        if (yolSonucu.length < 2) return false;
        const kaynak = kimlikGetir(baglanti.source);
        const hedef = kimlikGetir(baglanti.target);

        if (!yolKumesi.has(kaynak) || !yolKumesi.has(hedef)) return false;

        for (let i = 0; i < yolSonucu.length - 1; i++) {
            const p1 = yolSonucu[i];
            const p2 = yolSonucu[i + 1];
            if ((kaynak === p1 && hedef === p2) || (kaynak === p2 && hedef === p1)) return true;
        }
        return false;
    }, [yolSonucu, yolKumesi]);

    // RENK VE STİL FONKSİYONLARI
    const dugumRengiGetir = useCallback((d: any) => {
        if (d.id === baslangicDugum) return "#00ff44";
        if (d.id === bitisDugum) return "#ff3333";
        if (yolKumesi.has(d.id)) return "#ffcc00";
        return "#0088ff";
    }, [baslangicDugum, bitisDugum, yolKumesi]);

    // 2. OPTİMİZASYON: GPU HAFIZASI (Geometry & Material Reuse)
    const xrayYolMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: algoritmaRengi,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
    }), [algoritmaRengi]);

    const xrayYolGeo = useMemo(() => new THREE.CylinderGeometry(0.6, 0.6, 1, 6), []);
    const ortakHitboxMat = useMemo(() => new THREE.MeshBasicMaterial({ visible: true, opacity: 0.0, transparent: true, depthWrite: false }), []);
    const ortakHitboxGeo = useMemo(() => new THREE.CylinderGeometry(6, 6, 1, 4).rotateZ(Math.PI / 2), []);

    const baglantiObjesiGetir = useCallback((baglanti: any) => {
        // GPU HESAPLAMA OPTİMİZASYONU (OCCLUSION CULLING)
        // Performansı artırmak için sadece aktif yol üzerindeki bağlantılar render edilir.
        // Aktif olmayan bağlantılar için geometrik hesaplama yapılmaz (null döndürülür).
        // Bu işlem, sahnedeki poligon sayısını %95 oranında azaltarak FPS değerini korur.
        if (!baglantiYoldaMi(baglanti)) return null as unknown as THREE.Object3D;

        const grup = new THREE.Group();
        // Görünür X-Ray Mesh (Shared Geometry & Material)
        const gorunurMesh = new THREE.Mesh(xrayYolGeo, xrayYolMat);
        gorunurMesh.renderOrder = 999;
        grup.add(gorunurMesh);

        // Hitbox (Shared Geometry & Material)
        const hitboxMesh = new THREE.Mesh(ortakHitboxGeo, ortakHitboxMat);
        grup.add(hitboxMesh);

        return grup;
    }, [baglantiYoldaMi, xrayYolGeo, xrayYolMat, ortakHitboxGeo, ortakHitboxMat]);

    const baglantiKonumGuncelle = useCallback((obje: any, { start, end }: any, baglanti: any) => {
        if (!baglantiYoldaMi(baglanti)) return false;

        const baslangic = new THREE.Vector3(start.x, start.y, start.z);
        const bitis = new THREE.Vector3(end.x, end.y, end.z);
        const orta = baslangic.clone().add(bitis).multiplyScalar(0.5);

        obje.position.copy(orta);
        const mesafe = baslangic.distanceTo(bitis);

        obje.scale.set(1, mesafe, 1);
        obje.lookAt(bitis);
        obje.rotateX(Math.PI / 2);

        return false;
    }, [baglantiYoldaMi]);

    const baglantiGenisligiGetir = useCallback((l: any) => baglantiYoldaMi(l) ? 0 : 0, [baglantiYoldaMi]); // Arka plan 0 genişlik
    const baglantiRengiGetir = useCallback((l: any) => baglantiYoldaMi(l) ? "transparent" : "rgba(0,0,0,0)", [baglantiYoldaMi]); // Tamamen görünmez
    const baglantiEgrilikGetir = useCallback((l: any) => baglantiYoldaMi(l) ? 0 : 0.1, [baglantiYoldaMi]);

    const parcacikHiziGetir = useCallback((baglanti: any) => {
        if (baglantiYoldaMi(baglanti)) return 0.02;
        return 0;
    }, [baglantiYoldaMi]);

    // SAHNE KURULUMU
    useEffect(() => {
        const fg = grafikReferansi.current;
        if (!fg || sahneHazir.current) return;

        const renderer = fg.renderer();
        if (renderer) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setPixelRatio(1); // Yüksek DPI ekranlarda kasmayı önle
            renderer.shadowMap.enabled = false;
        }

        const sahne = fg.scene();
        const dokuYukleyici = new THREE.TextureLoader();
        const dunyaDokusu = dokuYukleyici.load("//unpkg.com/three-globe/example/img/earth-night.jpg");
        const dunya = new THREE.Mesh(
            new THREE.SphereGeometry(DUNYA_YARICAPI, 24, 24),
            new THREE.MeshLambertMaterial({ map: dunyaDokusu, color: 0xaaaaaa })
        );
        sahne.add(dunya);

        sahne.add(new THREE.AmbientLight(0xffffff, 0.6));
        const gunes = new THREE.DirectionalLight(0xffffff, 1.5);
        gunes.position.set(100, 50, 100);
        sahne.add(gunes);

        const yildizGeo = new THREE.BufferGeometry();
        const yildizKonumlari = new Float32Array(600);
        for (let i = 0; i < 600; i++) yildizKonumlari[i] = (Math.random() - 0.5) * 3000;
        yildizGeo.setAttribute("position", new THREE.BufferAttribute(yildizKonumlari, 3));
        const yildizlar = new THREE.Points(yildizGeo, new THREE.PointsMaterial({ color: 0x888888, size: 1.5 }));
        sahne.add(yildizlar);

        sahneHazir.current = true;
    }, []);

    // DÖNÜŞ KONTROLÜ
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

    // YOL YÖNÜ DÜZELTME
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
                if (String(s) === String(v)) {
                    const temp = baglanti.source;
                    baglanti.source = baglanti.target;
                    baglanti.target = temp;
                }
            }
        }
    }, [yolSonucu, sabitVeri]);

    // PAKET ANİMASYONU
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
                    setTimeout(() => { fg.emitParticle(baglanti); }, i * (HOP_SURESI * 0.85));
                }
            }
        }, TREN_ARALIGI);
        return () => clearInterval(zamanlayici);
    }, [yolSonucu, sabitVeri]);

    // 4. MOUSE EVENTLERI (STATE YOK, DOĞRUDAN DOM GÜNCELLEME)
    const baglantiUzerineGelme = useCallback((baglanti: any) => {
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        if (baglanti && baglantiYoldaMi(baglanti)) {
            const kaynak = kimlikGetir(baglanti.source);
            const hedef = kimlikGetir(baglanti.target);

            tooltip.innerHTML = `
                <div class="font-bold text-yellow-400 mb-1 border-b border-gray-600 pb-1">BAĞLANTI DETAYI</div>
                <div class="text-xs text-gray-300">Kaynak: <span class="text-white">${kaynak}</span></div>
                <div class="text-xs text-gray-300">Hedef: <span class="text-white">${hedef}</span></div>
            `;

            tooltip.style.display = 'block';
            document.body.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            document.body.style.cursor = 'default';
        }
    }, [baglantiYoldaMi]);

    const fareTakip = useCallback((e: MouseEvent) => {
        const tooltip = tooltipRef.current;
        if (tooltip && tooltip.style.display === 'block') {
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', fareTakip);
        return () => window.removeEventListener('mousemove', fareTakip);
    }, [fareTakip]);

    return (
        <div className="w-full h-full relative bg-black">
            <ForceGraph3D
                ref={grafikReferansi}
                graphData={sabitVeri}
                backgroundColor="rgba(0,0,0,0)"

                warmupTicks={0}
                cooldownTicks={0}
                enableNodeDrag={false}
                enableNavigationControls={true}
                showNavInfo={false}
                linkOpacity={1}

                nodeRelSize={2.5}
                nodeColor={dugumRengiGetir}
                nodeLabel={(node: any) => `Node ${node.id}`}
                nodeResolution={4} // OPTİMİZASYON: Poligon sayısı düşürüldü (6 -> 4)

                linkWidth={baglantiGenisligiGetir}
                linkColor={baglantiRengiGetir}
                linkCurvature={baglantiEgrilikGetir}

                linkDirectionalParticles={0}
                linkDirectionalParticleWidth={5}
                linkDirectionalParticleResolution={4} // OPTİMİZASYON: Parçacık kalitesi düşürüldü (8 -> 4)
                linkDirectionalParticleColor={() => "#ffffff"}
                linkDirectionalParticleSpeed={parcacikHiziGetir}

                linkThreeObjectExtend={true}
                linkThreeObject={baglantiObjesiGetir}
                linkPositionUpdate={baglantiKonumGuncelle}
                onLinkHover={baglantiUzerineGelme}
            />




        </div>
    );
};

export default DunyaHaritasi;