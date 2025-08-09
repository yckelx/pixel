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
        
        // Micro-otimizações: controle de memória
        this.maxCachedImages = 50; // Limite de imagens em cache
        this.lastAccessTime = new Map(); // imageId -> timestamp
        
        this.stages = [
            { stage: 1, size: 1, description: "1 pixel" },
            { stage: 2, size: 4, description: "4x4 pixels" },
            { stage: 3, size: 64, description: "64x64 pixels" },
            { stage: 4, size: 96, description: "96x96 pixels" }
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
                // Estágio 4: Tamanho fixo para máxima performance
                canvas.width = 96;
                canvas.height = 96;
                ctx.imageSmoothingEnabled = false; // Mesma performance que stage 3
                ctx.drawImage(imageInfo.image, 0, 0, 96, 96);
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
        this.lastAccessTime.set(imageId, Date.now());
        
        // Micro-otimização: limpeza automática se exceder limite
        if (this.stageCache.size > this.maxCachedImages) {
            this.cleanupOldCache();
        }
    }

    /**
     * Obtém o canvas do estágio atual para uma imagem
     */
    getStageCanvas(imageId) {
        const stageMap = this.stageCache.get(imageId);
        if (stageMap) {
            // Marcar como acessado recentemente
            this.lastAccessTime.set(imageId, Date.now());
            return stageMap.get(this.currentStage);
        }
        return null;
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
        this.lastAccessTime.clear();
    }

    /**
     * Micro-otimização: Remove imagens antigas do cache
     */
    cleanupOldCache() {
        if (this.stageCache.size <= this.maxCachedImages) return;

        // Encontrar as imagens mais antigas
        const sortedByAccess = Array.from(this.lastAccessTime.entries())
            .sort((a, b) => a[1] - b[1]); // Ordenar por timestamp (mais antigo primeiro)

        // Remover 25% das imagens mais antigas
        const toRemove = Math.floor(this.stageCache.size * 0.25);
        
        for (let i = 0; i < toRemove && i < sortedByAccess.length; i++) {
            const imageId = sortedByAccess[i][0];
            this.stageCache.delete(imageId);
            this.lastAccessTime.delete(imageId);
        }

        console.log(`Cache cleanup: removidas ${toRemove} imagens antigas`);
    }

    /**
     * Micro-otimização: Preload inteligente do próximo estágio
     */
    preloadAdjacentStages(imageId, imageManager) {
        // Só precarregar se não estiver animando (evitar overhead)
        if (this.isAnimating) return;

        const imageInfo = imageManager.getImage(imageId);
        if (!imageInfo || !imageInfo.loaded) return;

        // Precarregar estágio +1 e -1 se não existirem
        const adjacentStages = [this.currentStage - 1, this.currentStage + 1]
            .filter(stage => stage >= 1 && stage <= 4);

        const stageMap = this.stageCache.get(imageId);
        if (!stageMap) return;

        for (const stage of adjacentStages) {
            if (!stageMap.has(stage)) {
                // Gerar estágio faltante de forma assíncrona (com fallback)
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => {
                        this.generateSingleStage(imageId, imageInfo, stage);
                    });
                } else {
                    // Fallback para navegadores antigos
                    setTimeout(() => {
                        this.generateSingleStage(imageId, imageInfo, stage);
                    }, 16); // ~1 frame de delay
                }
            }
        }
    }

    /**
     * Micro-otimização: Gera apenas um estágio específico
     */
    generateSingleStage(imageId, imageInfo, targetStage) {
        if (!imageInfo.loaded || !imageInfo.image) return;

        const stageInfo = this.stages.find(s => s.stage === targetStage);
        if (!stageInfo) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (stageInfo.stage === 1) {
            canvas.width = 1;
            canvas.height = 1;
            const avgColor = this.imageProcessor.getAverageColor(imageInfo.imageData);
            ctx.fillStyle = `rgba(${avgColor[0]}, ${avgColor[1]}, ${avgColor[2]}, ${avgColor[3] / 255})`;
            ctx.fillRect(0, 0, 1, 1);
        } else if (stageInfo.stage === 4) {
            // Estágio 4: Tamanho fixo para máxima performance
            canvas.width = 96;
            canvas.height = 96;
            ctx.imageSmoothingEnabled = false; // Mesma performance que stage 3
            ctx.drawImage(imageInfo.image, 0, 0, 96, 96);
        } else {
            canvas.width = stageInfo.size;
            canvas.height = stageInfo.size;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(imageInfo.image, 0, 0, stageInfo.size, stageInfo.size);
        }

        // Adicionar ao cache existente
        let stageMap = this.stageCache.get(imageId);
        if (!stageMap) {
            stageMap = new Map();
            this.stageCache.set(imageId, stageMap);
        }
        stageMap.set(targetStage, canvas);
        
        console.log(`Preloaded stage ${targetStage} for image ${imageId}`);
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