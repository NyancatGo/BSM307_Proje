import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GraphData, Node as GraphNode } from '../types';

interface WorldMapProps {
  graph: GraphData;
  pathResult: number[] | null;
  startNode: number;
  endNode: number;
  autoRotate: boolean;
}

interface NodeMeshProps {
  node: GraphNode;
  isStart: boolean;
  isEnd: boolean;
  isPath: boolean;
}

const NodeMesh: React.FC<NodeMeshProps> = ({ node, isStart, isEnd, isPath }) => {
    const [hovered, setHover] = useState(false);
    
    const color = isStart ? '#00ff00' : isEnd ? '#ff0000' : isPath ? '#ffff00' : '#4488ff';
    const size = (isStart || isEnd) ? 0.4 : isPath ? 0.3 : 0.15;

    return (
        <group position={[node.x, node.y, node.z]}>
            <mesh 
                onPointerOver={() => setHover(true)} 
                onPointerOut={() => setHover(false)}
            >
                <sphereGeometry args={[size, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 2 : 0.5} />
            </mesh>
            {hovered && (
                <Html distanceFactor={15}>
                    <div className="bg-black/80 text-white text-xs p-1 rounded whitespace-nowrap border border-blue-500">
                        Node {node.id}<br/>
                        Rel: {node.reliability.toFixed(4)}
                    </div>
                </Html>
            )}
        </group>
    );
};

const Connections = ({ graph, pathResult }: { graph: GraphData, pathResult: number[] | null }) => {
    const lines = useMemo(() => {
        const points: THREE.Vector3[] = [];
        
        graph.links.forEach(link => {
            const n1 = graph.nodes[link.source];
            const n2 = graph.nodes[link.target];
            points.push(new THREE.Vector3(n1.x, n1.y, n1.z));
            points.push(new THREE.Vector3(n2.x, n2.y, n2.z));
        });
        
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [graph]);

    return (
        <lineSegments geometry={lines}>
            <lineBasicMaterial color="#1f3a5e" opacity={0.15} transparent />
        </lineSegments>
    );
};

const ActivePath = ({ graph, path }: { graph: GraphData, path: number[] }) => {
    const points = useMemo(() => {
        if (!path || path.length < 2) return null;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < path.length - 1; i++) {
            const n1 = graph.nodes[path[i]];
            const n2 = graph.nodes[path[i+1]];
            pts.push(new THREE.Vector3(n1.x, n1.y, n1.z));
            pts.push(new THREE.Vector3(n2.x, n2.y, n2.z));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, [graph, path]);

    if (!points) return null;

    return (
        <lineSegments geometry={points}>
            <lineBasicMaterial color="#ffff00" linewidth={3} opacity={1} transparent />
        </lineSegments>
    );
}

const EarthSphere = () => {
    // High res earth texture
    const texture = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
    
    return (
        <mesh rotation={[0, 0, 0]}>
            <sphereGeometry args={[9.9, 64, 64]} />
            <meshStandardMaterial 
                map={texture} 
                metalness={0.2} 
                roughness={0.7} 
            />
        </mesh>
    );
}

const Atmosphere = () => {
     return (
        <mesh>
            <sphereGeometry args={[10.1, 64, 64]} />
             <meshStandardMaterial
                color="#4488ff"
                transparent
                opacity={0.1}
                side={THREE.BackSide}
                blending={THREE.AdditiveBlending}
             />
        </mesh>
    )
}

export const WorldMap: React.FC<WorldMapProps> = ({ graph, pathResult, startNode, endNode, autoRotate }) => {
  const pathSet = useMemo(() => new Set(pathResult || []), [pathResult]);

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 26], fov: 45 }}>
        <OrbitControls enablePan={false} minDistance={14} maxDistance={45} autoRotate={autoRotate} autoRotateSpeed={0.5} />
        
        {/* Lighting for Realism */}
        <ambientLight intensity={0.2} />
        <directionalLight position={[15, 10, 5]} intensity={2.5} />
        <directionalLight position={[-15, -10, -5]} intensity={0.5} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <Suspense fallback={null}>
            <group>
                <EarthSphere />
                <Atmosphere />
                
                {/* Links */}
                <Connections graph={graph} pathResult={pathResult} />
                
                {/* Highlight Path */}
                {pathResult && <ActivePath graph={graph} path={pathResult} />}

                {/* Nodes */}
                {graph.nodes.map(node => (
                    <NodeMesh 
                        key={node.id} 
                        node={node} 
                        isStart={node.id === startNode}
                        isEnd={node.id === endNode}
                        isPath={pathSet.has(node.id)}
                    />
                ))}
            </group>
        </Suspense>
      </Canvas>
    </div>
  );
};