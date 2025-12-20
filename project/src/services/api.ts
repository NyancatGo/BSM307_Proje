import { AlgorithmType, PathResult } from '../types';

export const verifyWithBackend = async (algorithm: AlgorithmType, result: PathResult) => {
    try {
        const payload = {
            algorithm: algorithm,
            start: result.path[0],
            end: result.path[result.path.length - 1],
            metrics: {
                cost: result.metrics.weightedCost
            },
            // Varsayılan ağırlıklar, eğer result içinde varsa oradan da alınabilir
            weights: {
                wDelay: 0.33,
                wReliability: 0.33,
                wResource: 0.34
            }
        };

        const response = await fetch('http://localhost:5000/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        console.log('Backend Verification:', data);
        return data;
    } catch (error) {
        console.error('Backend connection failed:', error);
        return null;
    }
};
