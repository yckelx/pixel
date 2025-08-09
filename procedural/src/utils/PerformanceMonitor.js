/**
 * Monitor de performance e debug
 */
export class PerformanceMonitor {
    constructor() {
        this.stats = {
            renderedImages: 0,
            totalImages: 0,
            loadedImages: 0,
            loadingImages: 0,
            fps: 0,
            renderTime: 0
        };
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.renderStartTime = 0;
    }

    /**
     * Inicia medição de render
     */
    startRender() {
        this.renderStartTime = performance.now();
    }

    /**
     * Finaliza medição de render
     */
    endRender() {
        this.stats.renderTime = performance.now() - this.renderStartTime;
        this.updateFPS();
    }

    /**
     * Atualiza FPS
     */
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.stats.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    /**
     * Atualiza estatísticas de imagens
     */
    updateImageStats(rendered, total, loaded, loading) {
        this.stats.renderedImages = rendered;
        this.stats.totalImages = total;
        this.stats.loadedImages = loaded;
        this.stats.loadingImages = loading;
    }

    /**
     * Renderiza debug info na tela
     */
    renderDebugInfo(ctx, camera, spacing) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';

        const lines = [
            `Renderizadas: ${this.stats.renderedImages}/${this.stats.totalImages}`,
            `Carregadas: ${this.stats.loadedImages} | Carregando: ${this.stats.loadingImages}`,
            `Espaçamento: ${spacing}px | FPS: ${this.stats.fps}`,
            `Câmera: (${Math.round(camera.x)}, ${Math.round(camera.y)})`,
            `Render: ${this.stats.renderTime.toFixed(1)}ms`
        ];

        lines.forEach((line, index) => {
            ctx.fillText(line, 10, 20 + (index * 15));
        });
    }

    /**
     * Log de performance no console
     */
    logPerformance() {
        console.log('Performance Stats:', {
            fps: this.stats.fps,
            renderTime: this.stats.renderTime,
            memoryUsage: this.getMemoryUsage(),
            imageStats: {
                total: this.stats.totalImages,
                loaded: this.stats.loadedImages,
                rendered: this.stats.renderedImages
            }
        });
    }

    /**
     * Estima uso de memória
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    /**
     * Getters
     */
    get currentStats() {
        return { ...this.stats };
    }
}