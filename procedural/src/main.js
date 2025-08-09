// Imports dos módulos
import { Camera } from './core/Camera.js';
import { ImageManager } from './core/ImageManager.js';
import { StageRenderer } from './core/StageRenderer.js';
import { GridLayout } from './core/GridLayout.js';
import { BaseCanvas } from './core/BaseCanvas.js';
import { Controls } from './ui/Controls.js';
import { EventHandler } from './ui/EventHandler.js';
import { AnimationManager } from './ui/AnimationManager.js';
import { FullscreenViewer } from './ui/FullscreenViewer.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';

/**
 * Classe principal que coordena todos os módulos
 */
class ProceduralZoomViewer {
    constructor() {
        // Canvas e contexto
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Inicializar módulos
        this.camera = new Camera(this.canvas);
        this.imageManager = new ImageManager();
        this.stageRenderer = new StageRenderer();
        this.gridLayout = new GridLayout();
        this.baseCanvas = new BaseCanvas(1000, 1000, 32); // Canvas base para pixels de cor com grid de 32px
        this.controls = new Controls();
        this.eventHandler = new EventHandler(this.canvas);
        this.animationManager = new AnimationManager();
        this.fullscreenViewer = new FullscreenViewer();
        this.performanceMonitor = new PerformanceMonitor();
        
        // Estado de renderização
        this.isRendering = false;
        this.needsRender = false;
        
        // Performance: cache de posições calculadas
        this.gridPositions = new Map(); // imageId -> {gridX, gridY, isVisible}
        this.gridSize = 32;
        
        // Performance: dirty rectangle system
        this.lastRenderedStage = -1;
        this.frameCounter = 0;
        
        this.setupCallbacks();
        
        // Adicionar alguns pixels de teste para demonstrar o sistema híbrido
        this.addTestPixels();
        
        // Performance: iniciar loading em background
        this.startBackgroundLoader();
        
        this.requestRender();
    }

    /**
     * Configura callbacks entre módulos
     */
    setupCallbacks() {
        // Callbacks dos controles
        this.controls.setCallbacks({
            onFileUpload: (files) => this.handleFileUpload(files),
            onClearAll: () => this.handleClearAll()
        });

        // Callbacks dos eventos
        this.eventHandler.setCallbacks({
            onStageChange: (direction, absoluteStage) => this.handleStageChange(direction, absoluteStage),
            onCameraMove: (deltaX, deltaY) => this.handleCameraMove(deltaX, deltaY),
            onReset: () => this.handleReset(),
            onImageDoubleClick: (imageId) => this.handleImageDoubleClick(imageId),
            getImageAtPosition: (screenX, screenY) => this.getImageAtPosition(screenX, screenY)
        });

        // Callbacks do fullscreen
        this.fullscreenViewer.setCallbacks({
            onClose: () => this.handleFullscreenClose(),
            onImageChange: (imageInfo) => this.handleFullscreenImageChange(imageInfo)
        });
    }

    /**
     * Handlers de eventos
     */
    async handleFileUpload(files) {
        for (const file of files) {
            const position = this.gridLayout.calculatePosition(this.imageManager.totalImages + 1);
            this.imageManager.addImage(file, position.x, position.y);
        }
        
        this.updateLayout();
        this.updateUI();
        this.requestRender();
    }

    handleClearAll() {
        this.imageManager.clear();
        this.stageRenderer.clearCache();
        this.updateUI();
        this.requestRender();
    }

    handleStageChange(direction, absoluteStage) {
        let newStage;
        if (absoluteStage !== undefined) {
            newStage = absoluteStage;
        } else {
            newStage = this.stageRenderer.stage + direction;
        }

        // Limitar entre 1 e 4
        newStage = Math.max(1, Math.min(4, newStage));
        
        if (newStage !== this.stageRenderer.stage) {
            // Performance: Transição instantânea sem animações pesadas
            this.stageRenderer.setStage(newStage);
            
            // Performance: Preload estágios adjacentes para próximas transições
            this.preloadAdjacentStagesForAllImages();
            
            // Performance: NÃO recalcular layout! Posições são as mesmas
            // this.updateLayout(); // <- REMOVIDO!
            this.requestRender();
            
            console.log(`Stage changed to ${newStage} instantly - NO LAYOUT RECALC`);
        }
    }

    handleCameraMove(deltaX, deltaY) {
        this.camera.moveBy(deltaX, deltaY);
        this.requestRender();
    }

    handleReset() {
        // Performance: Reset instantâneo
        this.stageRenderer.setStage(1);
        this.camera.reset();
        // this.updateLayout(); // <- REMOVIDO! Não precisamos recalcular
        this.requestRender();
        
        console.log('Reset to stage 1 and center camera instantly - NO LAYOUT RECALC');
    }

    handleImageDoubleClick(imageId) {
        const imageInfo = this.imageManager.getImage(imageId);
        if (imageInfo) {
            this.fullscreenViewer.open(imageInfo, this.imageManager);
        }
    }

    handleFullscreenClose() {
        // Fullscreen fechado, nada específico a fazer
        console.log('Fullscreen fechado');
    }

    handleFullscreenImageChange(imageInfo) {
        // Imagem mudou no fullscreen, poderiar atualizar algo se necessário
        console.log('Imagem mudou no fullscreen:', imageInfo.name);
    }

    /**
     * Detecta qual imagem está na posição do clique
     */
    getImageAtPosition(screenX, screenY) {
        const displaySize = this.stageRenderer.getDisplaySize();
        
        for (const [imageId, imageInfo] of this.imageManager.getAllImages()) {
            const isVisible = this.camera.isVisible(imageInfo.x, imageInfo.y, displaySize);
            if (!isVisible) continue;
            
            const screenPos = this.camera.worldToScreen(imageInfo.x, imageInfo.y);
            const imageScreenX = screenPos.x - displaySize / 2;
            const imageScreenY = screenPos.y - displaySize / 2;
            
            // Verificar se o clique está dentro da imagem
            if (screenX >= imageScreenX && screenX <= imageScreenX + displaySize &&
                screenY >= imageScreenY && screenY <= imageScreenY + displaySize) {
                return imageId;
            }
        }
        
        return null;
    }

    /**
     * Atualiza layout baseado no estágio atual
     * Performance: otimizado para mudanças de stage
     */
    updateLayout() {
        const displaySize = this.stageRenderer.getDisplaySize(this.stageRenderer.isAnimating);
        this.gridLayout.updateSpacing(displaySize);
        
        const positions = this.gridLayout.repositionAll(this.imageManager.totalImages);
        this.imageManager.updateImagePositions(positions);
        
        // Performance: invalidar cache apenas quando necessário
        // (mudanças de stage não afetam grid positions, só display size)
        if (!this.stageRenderer.isAnimating) {
            this.gridPositions.clear();
        }
    }

    /**
     * Atualiza UI
     */
    updateUI() {
        this.controls.updateImageCount(this.imageManager.totalImages, this.imageManager.loadedCount);
        const stageInfo = this.stageRenderer.getStageInfo();
        this.controls.updateZoomInfo(this.stageRenderer.stage, stageInfo.description, this.imageManager.totalImages);
    }

    /**
     * Solicita renderização
     */
    requestRender() {
        if (!this.isRendering) {
            this.needsRender = true;
            requestAnimationFrame(() => this.render());
        }
    }

    /**
     * Renderização principal
     * Performance: NUNCA await durante render loop
     */
    render() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.needsRender = false;
        this.performanceMonitor.startRender();

        // Limpar canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Desenhar grid simples
        this.drawGrid();
        
        // Renderizar canvas base (pixels de cor) primeiro
        this.renderBaseCanvas();

        // Performance: renderização síncrona apenas
        this.renderImages();
        this.renderDebugInfo();
        
        this.performanceMonitor.endRender();
        this.isRendering = false;

        // Renderizar novamente se necessário
        if (this.needsRender) {
            this.requestRender();
        }
    }

    /**
     * Desenha um grid simples no canvas
     * Performance: Batching de linhas
     */
    drawGrid() {
        // Performance: Desabilitar grid temporariamente para debug
        // return;
        
        const gridSize = 32;
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        // Performance: Desenhar todas as linhas em um único path
        // Linhas verticais
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }

        // Linhas horizontais
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        
        // Uma única chamada de stroke para todas as linhas
        this.ctx.stroke();
    }

    /**
     * Renderiza pixels coloridos diretamente no grid da tela
     */
    renderBaseCanvas() {
        const gridSize = 32;
        
        // Desenhar alguns pixels de teste diretamente
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(64, 64, gridSize, gridSize); // Vermelho na posição (2,2)
        
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(96, 64, gridSize, gridSize); // Verde na posição (3,2)
        
        this.ctx.fillStyle = '#0000FF';
        this.ctx.fillRect(64, 96, gridSize, gridSize); // Azul na posição (2,3)
        
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.fillRect(96, 96, gridSize, gridSize); // Amarelo na posição (3,3)
        
        // Desenhar padrão no centro da tela
        const centerX = Math.floor(this.canvas.width / 2 / gridSize) * gridSize;
        const centerY = Math.floor(this.canvas.height / 2 / gridSize) * gridSize;
        
        this.ctx.fillStyle = '#FF00FF';
        this.ctx.fillRect(centerX, centerY, gridSize, gridSize); // Magenta no centro
        
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.fillRect(centerX + gridSize, centerY, gridSize, gridSize); // Ciano
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(centerX, centerY + gridSize, gridSize, gridSize); // Branco
    }

    /**
     * Renderiza placeholder quando não há imagens
     */
    renderPlaceholder() {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.canvas.width / 2 - 1, this.canvas.height / 2 - 1, 2, 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Carregue imagens para começar', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    /**
     * Renderiza todas as imagens alinhadas ao grid
     * Performance: Batching de operações canvas + frame limiting
     */
    renderImages() {
        let renderedCount = 0;
        this.frameCounter++;
        
        // Performance: configurar canvas UMA vez antes do loop
        this.ctx.imageSmoothingEnabled = false;
        
        // Arrays para batching
        const imagesToDraw = [];
        const placeholdersToFill = [];
        const textsToRender = [];
        
        // Performance: limitar imagens por frame se muitas
        const totalImages = this.imageManager.totalImages;
        const maxImagesPerFrame = totalImages > 15 ? 10 : 50;

        // FASE 1: Coletar operações (sem executar)
        let processedCount = 0;
        for (const [imageId, imageInfo] of this.imageManager.getAllImages()) {
            // Performance: usar cache de posições
            let position = this.gridPositions.get(imageId);
            if (!position) {
                // Calcular posição apenas uma vez
                const gridX = Math.floor(imageInfo.x / this.gridSize) * this.gridSize;
                const gridY = Math.floor(imageInfo.y / this.gridSize) * this.gridSize;
                const isVisible = gridX >= -this.gridSize && gridX <= this.canvas.width &&
                                gridY >= -this.gridSize && gridY <= this.canvas.height;
                
                position = { gridX, gridY, isVisible };
                this.gridPositions.set(imageId, position);
            }

            // Só processar se visível
            if (position.isVisible) {
                // Performance: limitar quantas imagens por frame
                if (processedCount >= maxImagesPerFrame) {
                    break;
                }
                
                const stageCanvas = this.stageRenderer.getStageCanvas(imageId);
                if (stageCanvas) {
                    // Coletar imagem para desenhar
                    imagesToDraw.push({
                        canvas: stageCanvas,
                        x: position.gridX,
                        y: position.gridY,
                        name: imageInfo.name
                    });
                } else {
                    // Coletar placeholder para desenhar
                    placeholdersToFill.push({
                        x: position.gridX,
                        y: position.gridY,
                        isLoading: this.imageManager.isLoading(imageId)
                    });
                    
                    // Performance: solicitar loading em background (sem await!)
                    this.requestBackgroundLoad(imageId);
                }

                processedCount++;
                renderedCount++;
            }
        }

        // FASE 2: Executar operações em batch
        
        // Performance: Desenhar imagens com batching ainda mais agressivo
        if (imagesToDraw.length > 0) {
            // Otimização: usar todas as mesmas configurações
            this.ctx.imageSmoothingEnabled = false;
            
            for (const img of imagesToDraw) {
                this.ctx.drawImage(img.canvas, img.x, img.y, this.gridSize, this.gridSize);
            }
        }
        
        // Debug: contar operações
        if (imagesToDraw.length > 15) {
            console.log(`🔍 Stage ${this.stageRenderer.stage}: ${imagesToDraw.length} imagens renderizadas`);
        }

        // Desenhar todos os placeholders
        if (placeholdersToFill.length > 0) {
            this.ctx.fillStyle = '#444';
            for (const ph of placeholdersToFill) {
                this.ctx.fillRect(ph.x, ph.y, this.gridSize, this.gridSize);
                
                if (ph.isLoading) {
                    this.ctx.fillStyle = '#666';
                    this.ctx.fillRect(ph.x + 4, ph.y + 4, this.gridSize - 8, this.gridSize - 8);
                    this.ctx.fillStyle = '#444'; // Restaurar para próximo placeholder
                }
            }
        }

        // Desenhar textos apenas se necessário (stage >= 3)
        if (this.stageRenderer.stage >= 3 && imagesToDraw.length > 0) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px Arial';
            for (const img of imagesToDraw) {
                this.ctx.fillText(img.name.substring(0, 10), img.x, img.y - 2);
            }
        }

        // Atualizar estatísticas
        this.performanceMonitor.updateImageStats(
            renderedCount,
            this.imageManager.totalImages,
            this.imageManager.loadedCount,
            this.imageManager.loadingCount
        );
    }

    /**
     * Adiciona pixels de teste para demonstrar o sistema híbrido
     */
    addTestPixels() {
        console.log("Adicionando pixels de teste no grid...");
        
        // Calcular centro do grid (31x31 grid para canvas 1000x1000 com gridSize 32)
        const gridCols = Math.floor(this.baseCanvas.width / this.baseCanvas.gridSize);
        const gridRows = Math.floor(this.baseCanvas.height / this.baseCanvas.gridSize);
        const centerGridX = Math.floor(gridCols / 2);
        const centerGridY = Math.floor(gridRows / 2);
        
        console.log(`Centro do grid: (${centerGridX}, ${centerGridY}) - Grid ${gridCols}x${gridRows}`);
        
        // Criar um quadrado colorido no centro (3x3 pixels do grid)
        for (let x = centerGridX - 1; x <= centerGridX + 1; x++) {
            for (let y = centerGridY - 1; y <= centerGridY + 1; y++) {
                const red = Math.floor(Math.random() * 255);
                const green = Math.floor(Math.random() * 255);
                const blue = Math.floor(Math.random() * 255);
                this.baseCanvas.setPixel(x, y, `rgb(${red}, ${green}, ${blue})`);
            }
        }
        
        // Adicionar alguns pixels vermelhos espalhados
        for (let i = 0; i < 20; i++) {
            const x = centerGridX - 5 + Math.floor(Math.random() * 10);
            const y = centerGridY - 5 + Math.floor(Math.random() * 10);
            this.baseCanvas.setPixel(x, y, '#FF0000');
        }
        
        // Adicionar pixel verde no centro exato
        this.baseCanvas.setPixel(centerGridX, centerGridY, '#00FF00');
        
        // Adicionar uma linha azul horizontal para referência
        for (let x = centerGridX - 3; x <= centerGridX + 3; x++) {
            this.baseCanvas.setPixel(x, centerGridY - 2, '#0000FF');
        }
        
        // Adicionar uma linha azul vertical para referência
        for (let y = centerGridY - 3; y <= centerGridY + 3; y++) {
            this.baseCanvas.setPixel(centerGridX - 2, y, '#0000FF');
        }
        
        // Adicionar pixels nas bordas para testar visualização
        this.baseCanvas.setPixel(0, 0, '#FFFF00'); // Amarelo no canto superior esquerdo
        this.baseCanvas.setPixel(gridCols - 1, 0, '#FF00FF'); // Magenta no canto superior direito
        this.baseCanvas.setPixel(0, gridRows - 1, '#00FFFF'); // Ciano no canto inferior esquerdo
        this.baseCanvas.setPixel(gridCols - 1, gridRows - 1, '#FFFFFF'); // Branco no canto inferior direito
        
        console.log(`Pixels adicionados: ${this.baseCanvas.pixels.size}`);
    }

    /**
     * Adiciona um pixel de cor ao canvas base
     */
    addColorPixel(x, y, color) {
        this.baseCanvas.setPixel(x, y, color);
        this.requestRender();
    }

    /**
     * Remove um pixel do canvas base
     */
    removePixel(x, y) {
        this.baseCanvas.setPixel(x, y, '#FFFFFF'); // Volta para branco
        this.requestRender();
    }

    /**
     * Renderiza informações de debug
     */
    renderDebugInfo() {
        this.performanceMonitor.renderDebugInfo(
            this.ctx, 
            this.camera, 
            this.gridLayout.spacing
        );
    }

    /**
     * Performance: Sistema de loading em background
     */
    startBackgroundLoader() {
        this.loadingQueue = new Set();
        this.isLoadingInBackground = false;
        
        // Processar queue a cada 100ms
        this.backgroundLoader = setInterval(() => {
            this.processLoadingQueue();
        }, 100);
    }

    /**
     * Performance: Solicita carregamento sem bloquear render
     */
    requestBackgroundLoad(imageId) {
        if (!this.imageManager.isLoaded(imageId) && !this.imageManager.isLoading(imageId)) {
            this.loadingQueue.add(imageId);
        }
    }

    /**
     * Performance: Processa queue de loading em background
     */
    async processLoadingQueue() {
        if (this.isLoadingInBackground || this.loadingQueue.size === 0) return;
        
        this.isLoadingInBackground = true;
        
        // Carregar apenas 1 imagem por vez para não sobrecarregar
        const imageId = this.loadingQueue.values().next().value;
        this.loadingQueue.delete(imageId);
        
        try {
            const loadedImageInfo = await this.imageManager.loadImage(imageId);
            if (loadedImageInfo) {
                this.stageRenderer.generateStages(imageId, loadedImageInfo);
                
                // Preload estágios adjacentes
                this.stageRenderer.preloadAdjacentStages(imageId, this.imageManager);
                
                // Solicitar nova renderização (agora que temos nova imagem)
                this.requestRender();
            }
        } catch (error) {
            console.error('Erro no background loading:', error);
        } finally {
            this.isLoadingInBackground = false;
        }
    }

    /**
     * Performance: Preload estágios adjacentes para todas as imagens visíveis
     */
    preloadAdjacentStagesForAllImages() {
        // Usar requestIdleCallback para não bloquear a transição
        const preloadBatch = () => {
            let processed = 0;
            const batchSize = 5; // Processar 5 imagens por vez
            
            for (const [imageId, imageInfo] of this.imageManager.getAllImages()) {
                if (processed >= batchSize) break;
                
                // Só precarregar imagens já carregadas
                if (this.imageManager.isLoaded(imageId)) {
                    this.stageRenderer.preloadAdjacentStages(imageId, this.imageManager);
                    processed++;
                }
            }
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(preloadBatch);
        } else {
            setTimeout(preloadBatch, 50); // Pequeno delay para não bloquear transição
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new ProceduralZoomViewer();
});