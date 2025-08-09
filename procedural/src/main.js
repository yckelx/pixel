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
        
        this.setupCallbacks();
        
        // Adicionar alguns pixels de teste para demonstrar o sistema híbrido
        this.addTestPixels();
        
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

    async handleStageChange(direction, absoluteStage) {
        let newStage;
        if (absoluteStage !== undefined) {
            newStage = absoluteStage;
        } else {
            newStage = this.stageRenderer.stage + direction;
        }

        // Limitar entre 1 e 4
        newStage = Math.max(1, Math.min(4, newStage));
        
        if (newStage !== this.stageRenderer.stage) {
            const fromStage = this.stageRenderer.stage;
            
            // Iniciar animação
            this.stageRenderer.setAnimating(true);
            
            // Animar transição suave
            const animation = this.animationManager.animateStageTransition(fromStage, newStage, 400);
            
            // Configurar callback para atualizar durante a animação
            let animId = null;
            for (const [id, anim] of this.animationManager.activeAnimations) {
                if (anim.type === 'stage') {
                    animId = id;
                    break;
                }
            }
            
            if (animId) {
                this.animationManager.setAnimationCallback(animId, (currentStage, progress) => {
                    this.stageRenderer.setAnimatedStage(currentStage);
                    this.updateLayout();
                    this.requestRender();
                });
            }
            
            await animation;
            
            // Finalizar
            this.stageRenderer.setStage(newStage);
            this.stageRenderer.setAnimating(false);
            this.updateLayout();
            this.requestRender();
        }
    }

    handleCameraMove(deltaX, deltaY) {
        this.camera.moveBy(deltaX, deltaY);
        this.requestRender();
    }

    async handleReset() {
        // Animar volta para estágio 1 e posição central
        const promises = [];
        
        if (this.stageRenderer.stage !== 1) {
            this.stageRenderer.setAnimating(true);
            const stageAnimation = this.animationManager.animateStageTransition(this.stageRenderer.stage, 1, 400);
            
            // Configurar callback para stage
            setTimeout(() => {
                let animId = null;
                for (const [id, anim] of this.animationManager.activeAnimations) {
                    if (anim.type === 'stage') {
                        animId = id;
                        break;
                    }
                }
                
                if (animId) {
                    this.animationManager.setAnimationCallback(animId, (currentStage, progress) => {
                        this.stageRenderer.setAnimatedStage(currentStage);
                        this.updateLayout();
                        this.requestRender();
                    });
                }
            }, 10);
            
            promises.push(stageAnimation);
        }
        
        const currentX = this.camera.x;
        const currentY = this.camera.y;
        const targetX = -this.canvas.width / 2;
        const targetY = -this.canvas.height / 2;
        
        if (currentX !== targetX || currentY !== targetY) {
            const cameraAnimation = this.animationManager.animateCamera(currentX, currentY, targetX, targetY);
            
            // Configurar callback para câmera
            setTimeout(() => {
                let animId = null;
                for (const [id, anim] of this.animationManager.activeAnimations) {
                    if (anim.type === 'camera') {
                        animId = id;
                        break;
                    }
                }
                
                if (animId) {
                    this.animationManager.setAnimationCallback(animId, (currentX, currentY, progress) => {
                        this.camera.setPosition(currentX, currentY);
                        this.requestRender();
                    });
                }
            }, 10);
            
            promises.push(cameraAnimation);
        }
        
        // Aguardar ambas as animações
        await Promise.all(promises);
        
        this.stageRenderer.setStage(1);
        this.stageRenderer.setAnimating(false);
        this.camera.reset();
        this.updateLayout();
        this.requestRender();
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
     */
    updateLayout() {
        const displaySize = this.stageRenderer.getDisplaySize(this.stageRenderer.isAnimating);
        this.gridLayout.updateSpacing(displaySize);
        
        const positions = this.gridLayout.repositionAll(this.imageManager.totalImages);
        this.imageManager.updateImagePositions(positions);
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
     */
    async render() {
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

        await this.renderImages();
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
     */
    drawGrid() {
        const gridSize = 32;
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        // Linhas verticais
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Linhas horizontais
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
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
     */
    async renderImages() {
        const gridSize = 32;
        let renderedCount = 0;

        // Renderizar imagens alinhadas ao grid
        for (const [imageId, imageInfo] of this.imageManager.getAllImages()) {
            // Alinhar posição da imagem ao grid
            const gridX = Math.floor(imageInfo.x / gridSize) * gridSize;
            const gridY = Math.floor(imageInfo.y / gridSize) * gridSize;

            // Verificar se está visível na tela
            if (gridX >= -gridSize && gridX <= this.canvas.width &&
                gridY >= -gridSize && gridY <= this.canvas.height) {

                // Lazy loading
                if (!this.imageManager.isLoaded(imageId) && !this.imageManager.isLoading(imageId)) {
                    const loadedImageInfo = await this.imageManager.loadImage(imageId);
                    if (loadedImageInfo) {
                        this.stageRenderer.generateStages(imageId, loadedImageInfo);
                        this.updateUI();
                    }
                }

                const stageCanvas = this.stageRenderer.getStageCanvas(imageId);
                if (stageCanvas) {
                    this.ctx.imageSmoothingEnabled = false;
                    // Renderizar a imagem preenchendo completamente a célula do grid
                    this.ctx.drawImage(stageCanvas, gridX, gridY, gridSize, gridSize);

                    // Nome da imagem em estágios maiores
                    if (this.stageRenderer.stage >= 3) {
                        this.ctx.fillStyle = '#fff';
                        this.ctx.font = '10px Arial';
                        this.ctx.fillText(imageInfo.name.substring(0, 10), gridX, gridY - 2);
                    }
                } else {
                    // Placeholder como quadrado cinza na célula do grid
                    this.ctx.fillStyle = '#444';
                    this.ctx.fillRect(gridX, gridY, gridSize, gridSize);
                    
                    if (this.imageManager.isLoading(imageId)) {
                        this.ctx.fillStyle = '#666';
                        this.ctx.fillRect(gridX + 4, gridY + 4, gridSize - 8, gridSize - 8);
                    }
                }

                renderedCount++;
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
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new ProceduralZoomViewer();
});