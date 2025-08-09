/**
 * Utilitários para processamento de imagens
 */
export class ImageProcessor {
    /**
     * Calcula cor média de ImageData
     */
    getAverageColor(imageData) {
        if (!imageData) return [128, 128, 128, 255];

        const data = imageData.data;
        let r = 0, g = 0, b = 0, a = 0;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            a += data[i + 3];
        }

        return [
            Math.floor(r / pixelCount),
            Math.floor(g / pixelCount),
            Math.floor(b / pixelCount),
            Math.floor(a / pixelCount)
        ];
    }

    /**
     * Sample pixel em posição específica
     */
    samplePixelAt(imageData, x, y, sampleSize = 1) {
        if (!imageData) return [0, 0, 0, 255];

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Garantir que estamos dentro dos limites
        x = Math.max(0, Math.min(width - 1, Math.floor(x)));
        y = Math.max(0, Math.min(height - 1, Math.floor(y)));

        if (sampleSize <= 1) {
            // Sample direto
            const index = (y * width + x) * 4;
            return [data[index], data[index + 1], data[index + 2], data[index + 3]];
        } else {
            // Sample médio de uma área
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            const halfSize = Math.floor(sampleSize / 2);

            for (let dy = -halfSize; dy <= halfSize; dy++) {
                for (let dx = -halfSize; dx <= halfSize; dx++) {
                    const px = Math.max(0, Math.min(width - 1, x + dx));
                    const py = Math.max(0, Math.min(height - 1, y + dy));
                    const index = (py * width + px) * 4;

                    r += data[index];
                    g += data[index + 1];
                    b += data[index + 2];
                    a += data[index + 3];
                    count++;
                }
            }

            return [r / count, g / count, b / count, a / count];
        }
    }

    /**
     * Redimensiona imagem mantendo aspect ratio
     */
    resizeImage(sourceCanvas, targetWidth, targetHeight, maintainAspectRatio = true) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (maintainAspectRatio) {
            const aspectRatio = sourceCanvas.width / sourceCanvas.height;
            if (targetWidth / targetHeight > aspectRatio) {
                targetWidth = targetHeight * aspectRatio;
            } else {
                targetHeight = targetWidth / aspectRatio;
            }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

        return canvas;
    }
}