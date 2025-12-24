import { AlgoritmaTipi, YolSonucu } from '../tipler';

export const arkaUçIleDogrula = async (algoritma: AlgoritmaTipi, sonuc: YolSonucu) => {
    try {
        const veri = {
            algoritma: algoritma,
            baslangic: sonuc.path[0],
            bitis: sonuc.path[sonuc.path.length - 1],
            metrikler: {
                maliyet: sonuc.metrics.weightedCost
            },
            // Varsayılan ağırlıklar, eğer sonuc içinde varsa oradan da alınabilir
            agirliklar: {
                wGecikme: 0.33,
                wGuvenilirlik: 0.33,
                wKaynak: 0.34
            }
        };

        const yanit = await fetch('http://localhost:5000/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(veri),
        });

        const veriYanit = await yanit.json();
        console.log('Arka Uç Doğrulaması:', veriYanit);
        return veriYanit;
    } catch (hata) {
        console.error('Arka uç bağlantısı başarısız:', hata);
        return null;
    }
};
