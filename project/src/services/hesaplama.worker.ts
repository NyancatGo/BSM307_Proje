/* eslint-disable no-restricted-globals */
import { genetikAlgoritmayiCalistir, karincaKolonisiCalistir, pekisirmeliOgrenmeCalistir, yapayAriKolonisiCalistir } from "./algoritmalar";
import { AlgoritmaTipi } from "../tipler";

// Web Worker Mesaj Dinleyicisi
self.onmessage = (e: MessageEvent) => {
    const { algo, cizge, src, dst, params } = e.data;
    let sonuc;
    let isim = "Bilinmiyor";

    try {
        const t0 = performance.now();

        switch (algo) {
            case AlgoritmaTipi.GENETIC:
                sonuc = genetikAlgoritmayiCalistir(cizge, src, dst, params);
                isim = "Genetik Algoritma (GA)";
                break;
            case AlgoritmaTipi.ACO:
                sonuc = karincaKolonisiCalistir(cizge, src, dst, params);
                isim = "Karınca Kolonisi (ACO)";
                break;
            case AlgoritmaTipi.Q_LEARNING:
                sonuc = pekisirmeliOgrenmeCalistir(cizge, src, dst, params);
                isim = "Q-Learning";
                break;
            case AlgoritmaTipi.ABC:
                sonuc = yapayAriKolonisiCalistir(cizge, src, dst, params);
                isim = "Yapay Arı Kolonisi (ABC)";
                break;
            default:
                throw new Error("Geçersiz Algoritma Tipi");
        }

        const t1 = performance.now();
        // Sonuca ekstra bilgi ekle (Worker tarafında olduğunu belli etmek için gerekirse)
        const finalSonuc = { ...sonuc, algorithmName: isim, workerTime: t1 - t0 };

        self.postMessage({ success: true, data: finalSonuc });
    } catch (err: any) {
        self.postMessage({ success: false, error: err.message || "Hesaplama Hatası" });
    }
};
