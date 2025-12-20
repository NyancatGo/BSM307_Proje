import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import * as d3 from "d3-force";
import { GraphData } from "../types";

interface WorldMapProps {
    graph: GraphData;
    pathResult: number[];
    startNode: number;
    endNode: number;
    autoRotate: boolean;
    algorithmName: string;
}

const EARTH_RADIUS = 60;
const ORBIT_RADIUS = 75;

const ALGO_COLORS: Record<string, string> = {
    GENETIC: "#ffd000",
    ACO: "#00e5ff",
    Q_LEARNING: "#b366ff",
    ABC: "#ff6b00",
    "Genetic Algorithm": "#ffd000",
    "Ant Colony Optimization": "#00e5ff",
    "Q-Learning (RL)": "#b366ff",
    "Artificial Bee Colony": "#ff6b00",
};

const WorldMap: React.FC<WorldMapProps> = ({
    graph,
    pathResult,
    startNode,
    endNode,
    autoRotate,
    algorithmName,
}) => {
    const fgRef = useRef<any>();
    const [hoveredLink, setHoveredLink] = useState<any>(null); // State tanımı eklendi
    const sceneInitialized = useRef(false);

    // 1. HIZLI ARAMA SETİ: Performans için yol üzerindeki node'ları Set'te tutuyoruz
    const pathSet = useMemo(() => new Set(pathResult), [pathResult]);
    const algoColor = useMemo(() => ALGO_COLORS[algorithmName] ?? "#ffffff", [algorithmName]);

    // 2. STABİL VERİ: Fizik motorunun sapıtmaması için koordinatları kilitliyoruz
    const stableData = useMemo(() => {
        if (!graph) return { nodes: [], links: [] };
        const nodes = graph.nodes.map((n, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / graph.nodes.length);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            return {
                ...n,
                fx: ORBIT_RADIUS * Math.sin(phi) * Math.cos(theta), // Fizik kilitlendi
                fy: ORBIT_RADIUS * Math.sin(phi) * Math.sin(theta),
                fz: ORBIT_RADIUS * Math.cos(phi)
            };
        });
        return { nodes, links: graph.links.map(l => ({ ...l })) };
    }, [graph]);

    // 3. YOL KONTROLÜ: Linkin yol üzerinde olup olmadığını kontrol eder
    const isLinkOnPath = useCallback((link: any) => {
        if (pathResult.length < 2) return false;
        const s = typeof link.source === "object" ? link.source.id : link.source;
        const t = typeof link.target === "object" ? link.target.id : link.target;
        if (!pathSet.has(s) || !pathSet.has(t)) return false;
        for (let i = 0; i < pathResult.length - 1; i++) {
            if ((s === pathResult[i] && t === pathResult[i + 1]) || (s === pathResult[i + 1] && t === pathResult[i])) return true;
        }
        return false;
    }, [pathResult, pathSet]);

    // 4. REFRESH: Görsel güncellemeleri tetikler
    useEffect(() => {
        if (fgRef.current) fgRef.current.refresh();
    }, [pathResult, algorithmName]);

    // 5. SAHNE KURULUMU (Dünya, Yıldızlar ve Işıklar)
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg || sceneInitialized.current) return;

        const renderer = fg.renderer() as THREE.WebGLRenderer; // Tip zorlaması hatayı çözer
        if (renderer) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        const scene = fg.scene();

        // Dünya Küresi
        const textureLoader = new THREE.TextureLoader();
        const earthTexture = textureLoader.load("//unpkg.com/three-globe/example/img/earth-night.jpg");
        const earth = new THREE.Mesh(
            new THREE.SphereGeometry(EARTH_RADIUS, 32, 32),
            new THREE.MeshPhongMaterial({
                map: earthTexture,
                specular: 0x111111,
                shininess: 10
            })
        );
        scene.add(earth);

        // Işıklandırma
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const sun = new THREE.DirectionalLight(0xffffff, 2);
        sun.position.set(100, 50, 100);
        scene.add(sun);

        // Yıldızlar
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(1500 * 3);
        for (let i = 0; i < 1500 * 3; i++) starPos[i] = (Math.random() - 0.5) * 3000;
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x888888, size: 1.5 }));
        scene.add(stars);

        sceneInitialized.current = true;
    }, []);

    // 6. KONTROL AYARLARI (Auto-rotate vb.)
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg) return;
        const controls = fg.controls() as any;
        if (controls) {
            controls.autoRotate = autoRotate;
            controls.autoRotateSpeed = 0.6;
            controls.maxDistance = 600;
            controls.minDistance = 80;
        }
    }, [autoRotate]);

    // 7. PATH OVERLAY (Yolların dünyanın içinden gözükmesi için)
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg) return;

        const scene = fg.scene();
        const overlayGroupName = "PathOverlayGroup";

        // Önce eski grubu temizle
        let overlayGroup = scene.getObjectByName(overlayGroupName);
        if (overlayGroup) {
            scene.remove(overlayGroup);
        }

        // Eğer yol yoksa çık
        if (pathResult.length < 2) return;

        overlayGroup = new THREE.Group();
        overlayGroup.name = overlayGroupName;

        // Yoldaki her link için çizgi oluştur
        for (let i = 0; i < pathResult.length - 1; i++) {
            const u = pathResult[i];
            const v = pathResult[i + 1];

            // Node pozisyonlarını bul (stableData'dan)
            const n1 = stableData.nodes.find((n: any) => n.id === u);
            const n2 = stableData.nodes.find((n: any) => n.id === v);

            if (n1 && n2) {
                const p1 = new THREE.Vector3(n1.fx, n1.fy, n1.fz);
                const p2 = new THREE.Vector3(n2.fx, n2.fy, n2.fz);

                // Bezier Eğrisi (Hafif bombeli olsun)
                const dist = p1.distanceTo(p2);
                const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                const midLen = mid.length();
                // Bombeyi artırarak daha belirgin yapıyoruz
                const scalar = (ORBIT_RADIUS + dist * 0.25) / midLen;
                const control = mid.clone().multiplyScalar(scalar);

                const curve = new THREE.QuadraticBezierCurve3(p1, control, p2);

                // WINDOWS FIX: LineBasicMaterial linewidth çalışmaz. TubeGeometry kullanıyoruz.
                // UYARI: Çok kalın yapma ("Çift yol" gibi duruyor). İnce ve net olsun (0.3 - 0.5 iyidir)
                const geometry = new THREE.TubeGeometry(curve, 20, 0.35, 8, false);

                const material = new THREE.MeshBasicMaterial({
                    color: algoColor,
                    depthTest: true,       // Depth test açık
                    depthWrite: true,      // Kendi derinliğini yazsın (Böylece tüpün önü arkasını kapatır, "çift" durmaz)
                    transparent: false,    // Şeffaflığı kapat (Net çizgi)
                    side: THREE.FrontSide, // Sadece dış yüzeyi çiz
                });

                // X-RAY MODU: Her zaman en üstte çiz (Duvar arkası görüş)
                material.depthFunc = THREE.AlwaysDepth;

                const tube = new THREE.Mesh(geometry, material);
                tube.renderOrder = 9999;
                overlayGroup.add(tube);
            }
        }

        scene.add(overlayGroup);

        return () => {
            if (overlayGroup) scene.remove(overlayGroup);
        };
    }, [pathResult, algoColor, stableData]);

    // 8. INTERACTION (PATH HOVER TOOLTIP)
    const [tooltipInfo, setTooltipInfo] = useState<{ x: number, y: number } | null>(null);
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());

    useEffect(() => {
        let lastCall = 0;
        const handleMouseMove = (event: MouseEvent) => {
            // OPTIMIZASYON: Throttle 40ms (~25 FPS)
            const now = Date.now();
            if (now - lastCall < 40) return;
            lastCall = now;

            const fg = fgRef.current;
            if (!fg) return;

            // 1. Mouse koordinatlarını hesapla (-1 to +1)
            const rect = fg.renderer().domElement.getBoundingClientRect();
            mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // 2. Raycaster'ı güncelle
            raycaster.current.setFromCamera(mouse.current, fg.camera());

            // 3. Overlay grubunu bul
            const scene = fg.scene();
            const overlayGroup = scene.getObjectByName("PathOverlayGroup");

            if (overlayGroup) {
                // 4. Kesişimleri kontrol et
                const intersects = raycaster.current.intersectObjects(overlayGroup.children);
                if (intersects.length > 0) {
                    setTooltipInfo({ x: event.clientX, y: event.clientY });
                    document.body.style.cursor = 'pointer';
                } else {
                    setTooltipInfo(null);
                    document.body.style.cursor = 'default';
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="w-full h-full relative bg-black">
            <ForceGraph3D
                ref={fgRef}
                graphData={stableData}
                backgroundColor="rgba(0,0,0,0)"
                warmupTicks={0}
                cooldownTicks={0}
                enableNodeDrag={false}

                // Düğümler
                nodeRelSize={2.5}
                nodeColor={n => n.id === startNode ? "#00ff44" : n.id === endNode ? "#ff3333" : pathSet.has(n.id) ? "#ffcc00" : "#0088ff"}
                nodeLabel={(node: any) => `Uydu ${node.id}`}

                // IDE Optimizasyon Planı: Native Çizgi Rendering (Yol için native'i kapatıyoruz)
                linkWidth={l => isLinkOnPath(l) ? 0 : 0.2}
                linkColor={l => isLinkOnPath(l) ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.05)"}
                linkCurvature={l => isLinkOnPath(l) ? 0.2 : 0} // Yol üzerindeki linkleri hafifçe bükerek belirginleştirir

                // Parçacık Efektleri
                linkDirectionalParticles={l => isLinkOnPath(l) ? 4 : 0}
                linkDirectionalParticleWidth={4}
                linkDirectionalParticleSpeed={0.01}

                onLinkHover={setHoveredLink}
            />
            {/* TOOLTIP UI */}
            {tooltipInfo && (
                <div style={{
                    position: 'absolute',
                    left: tooltipInfo.x + 15,
                    top: tooltipInfo.y + 15,
                    background: 'rgba(0,0,0,0.85)',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    border: `1px solid ${algoColor}`,
                    color: '#fff',
                    pointerEvents: 'none',
                    zIndex: 10000,
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)',
                    maxWidth: '300px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: algoColor }}>
                        {algorithmName}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        <span style={{ color: '#aaa' }}>Rota:</span><br />
                        <span style={{ color: '#fff', wordBreak: 'break-all' }}>
                            {pathResult.join(" -> ")}
                        </span>
                        <div style={{ marginTop: '5px' }}>
                            <span style={{ color: '#aaa' }}>Sekme Sayısı (Hops):</span> {pathResult.length - 1}
                        </div>
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: '#666', borderTop: '1px solid #333', paddingTop: '3px' }}>
                        Detaylar için tıkla
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorldMap;