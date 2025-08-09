import { ImageProcessor } from '../utils/ImageProcessor.js';

/**
 * Gerencia o sistema de 4 estágios de zoom
 */
export class StageRenderer {
    constructor() {
        this.currentStage = 1;
        this.animatedStage = 1; // Para animações suaves
        this.isAnimating = false;
        this.stageCache = new Map(); // imageId -> Map(stage -> canvas)
        this.imageProcessor = new ImageProcessor();
        
        this.stages = [
            { stage: 1, size: 1, description: "1 pixel" },
            { stage: 2, size: 4, description: "4x4 pixels" },
            { stage: 3, size: 32, description: "32x32 pixels" },
            { stage: 4, size: 0, description: "Resolução completa" }
        ];
    }

    /**
     * Muda para um estágio específico
     */
    setStage(newStage) {
        newStage = Math.max(1, Math.min(4, newStage));
        
        if (newStage !== this.currentStage) {
            this.currentStage = newStage;
            return true; // Indica que mudou
        }
        return false;
    }

    /**
     * Calcula tamanho de exibição baseado no estágio
     */
    getDisplaySize(useAnimatedStage = false) {
        const baseSize = 100;
        const stage = useAnimatedStage ? this.animatedStage : this.currentStage;
        return baseSize * Math.pow(2, stage - 1);
    }

    /**
     * Atualiza estágio animado para transições suaves
     */
    setAnimatedStage(stage) {
        this.animatedStage = stage;
    }

    /**
     * Define se está animando
     */
    setAnimating(isAnimating) {
        this.isAnimating = isAnimating;
    }

    /**
     * Gera todos os estágios para uma imagem
     */
    generateStages(imageId, imageInfo) {
        if (!imageInfo.loaded || !imageInfo.image) {
            return;
        }

        const stageMap = new Map();

        for (const stageInfo of this.stages) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (stageInfo.stage === 1) {
                // Estágio 1: 1 pixel (cor média)
                canvas.width = 1;
                canvas.height = 1;
                const avgColor = this.imageProcessor.getAverageColor(imageInfo.imageData);
                ctx.fillStyle = `rgba(${avgColor[0]}, ${avgColor[1]}, ${avgColor[2]}, ${avgColor[3] / 255})`;
                ctx.fillRect(0, 0, 1, 1);
            } else if (stageInfo.stage === 4) {
                // Estágio 4: Resolução completa
                canvas.width = imageInfo.image.width;
                canvas.height = imageInfo.image.height;
                ctx.drawImage(imageInfo.image, 0, 0);
            } else {
                // Estágios 2 e 3: Resoluções intermediárias
                canvas.width = stageInfo.size;
                canvas.height = stageInfo.size;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(imageInfo.image, 0, 0, stageInfo.size, stageInfo.size);
            }

            stageMap.set(stageInfo.stage, canvas);
        }

        this.stageCache.set(imageId, stageMap);
    }

    /**
     * Obtém o canvas do estágio atual para uma imagem
     */
    getStageCanvas(imageId) {
        const stageMap = this.stageCache.get(imageId);
        return stageMap ? stageMap.get(this.currentStage) : null;
    }

    /**
     * Remove estágios de uma imagem do cache
     */
    removeStages(imageId) {
        this.stageCache.delete(imageId);
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.stageCache.clear();
    }

    /**
     * Renderiza placeholder para imagem não carregada
     */
    renderPlaceholder(ctx, x, y, size, imageName, isLoading = false) {
        // Placeholder cinza
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, size, size);

        // Borda
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);

        // Nome do arquivo (se couber)
        if (size > 40) {
            ctx.fillStyle = '#aaa';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                imageName.substring(0, 15) + '...',
                x + size / 2,
                y + size / 2
            );
        }

        // Indicador de carregamento
        if (isLoading) {
            ctx.fillStyle = '#4a4';
            ctx.fillRect(x + 2, y + 2, 8, 8);
        }
    }

    /**
     * Getters
     */
    get stage() {
        return this.currentStage;
    }

    getStageInfo() {
        return this.stages.find(s => s.stage === this.currentStage);
    }

    hasStages(imageId) {
        return this.stageCache.has(imageId);
    }
}