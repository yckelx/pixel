class ProceduralZoomViewer {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.fileInput = document.getElementById('fileInput');
        this.clearAllBtn = document.getElementById('clearAll');
        this.imageCountDiv = document.getElementById('imageCount');
        this.zoomInfo = document.getElementById('zoomInfo');
        
        // Sistema de 4 estágios de zoom
        this.currentStage = 1; // 1, 2, 3, 4
        this.zoomStages = [
            { stage: 1, size: 1, description: "1 pixel" },
            { stage: 2, size: 4, description: "4x4 pixels" },
            { stage: 3, size: 32, description: "32x32 pixels" },
            { stage: 4, size: 0, description: "Resolução completa" } // 0 = tamanho original
        ];
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Estado do mouse
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Múltiplas imagens
        this.images = new Map(); // Map de ID -> dados da imagem
        this.imageFiles = new Map(); // Map de ID -> File object original
        this.nextImageId = 1;
        
        // Cache global de estágios
        this.globalStageCache = new Map(); // imageId -> Map(stage -> canvas)
        this.loadedImages = new Set(); // IDs das imagens já carregadas
        this.loadingImages = new Set(); // IDs das imagens sendo carregadas
        
        // Controle de renderização
        this.isRendering = false;
        this.needsRender = false;
        
        // Posição da "câmera" no espaço (centralizada)
        this.cameraX = -this.canvas.width / 2;
        this.cameraY = -this.canvas.height / 2;
        
        // Espaçamento entre imagens (adaptativo)
        this.baseImageSpacing = 120; // Espaçamento base
        this.currentSpacing = this.baseImageSpacing;
        
        this.setupEventListeners();
        this.requestRender();
    }
    
    setupEventListeners() {
        // Upload de múltiplas imagens
        this.fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            for (let i = 0; i < files.length; i++) {
                this.loadImage(files[i]);
            }
        });
        
        // Botão limpar todas
        this.clearAllBtn.addEventListener('click', () => {
            this.clearAllImages();
        });
        
        // Controles de zoom com mouse wheel - mudança de estágio
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY > 0) {
                // Zoom out
                this.changeStage(this.currentStage - 1);
            } else {
                // Zoom in
                this.changeStage(this.currentStage + 1);
            }
        });
        
        // Controles de arraste
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.offsetX;
            this.lastMouseY = e.offsetY;
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.offsetX - this.lastMouseX;
                const deltaY = e.offsetY - this.lastMouseY;
                this.cameraX -= deltaX; // Inverter para movimento natural
                this.cameraY -= deltaY;
                this.lastMouseX = e.offsetX;
                this.lastMouseY = e.offsetY;
                this.requestRender();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        // Controles de teclado
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    this.changeStage(this.currentStage + 1);
                    break;
                case '-':
                    e.preventDefault();
                    this.changeStage(this.currentStage - 1);
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault();
                    this.changeStage(parseInt(e.key));
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.reset();
                    break;
            }
        });
    }
    
    loadImage(file) {
        const imageId = this.nextImageId++;
        
        // Calcular posição em grid com espaçamento base (centrada na origem)
        const gridSize = Math.ceil(Math.sqrt(this.images.size + 1));
        const col = (this.images.size) % gridSize;
        const row = Math.floor(this.images.size / gridSize);
        // Centralizar o grid na origem (0,0)
        const gridOffsetX = -((gridSize - 1) * this.baseImageSpacing) / 2;
        const gridOffsetY = -((gridSize - 1) * this.baseImageSpacing) / 2;
        const x = col * this.baseImageSpacing + gridOffsetX;
        const y = row * this.baseImageSpacing + gridOffsetY;
        
        // Criar placeholder da imagem (não carregada ainda)
        const imageInfo = {
            id: imageId,
            name: file.name,
            image: null,        // Será carregada quando necessário
            imageData: null,
            baseX: x,
            baseY: y,
            x: x,
            y: y,
            width: 100,         // Tamanho estimado
            height: 100,
            loaded: false       // Flag para controle
        };
        
        // Armazenar arquivo original e info da imagem
        this.imageFiles.set(imageId, file);
        this.images.set(imageId, imageInfo);
        
        this.updateImageSpacing(); // Reposicionar todas após adicionar nova
        this.updateImageCount();
        this.requestRender();
    }
    
    async loadImageData(imageId) {
        if (this.loadedImages.has(imageId) || this.loadingImages.has(imageId)) {
            return; // Já carregada ou carregando
        }
        
        this.loadingImages.add(imageId);
        const file = this.imageFiles.get(imageId);
        const imageInfo = this.images.get(imageId);
        
        if (!file || !imageInfo) return;
        
        try {
            const dataUrl = await this.fileToDataUrl(file);
            const img = await this.loadImageFromUrl(dataUrl);
            
            // Criar imageData para manipulação pixel por pixel
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
            
            // Atualizar informações da imagem
            imageInfo.image = img;
            imageInfo.imageData = imageData;
            imageInfo.width = img.width;
            imageInfo.height = img.height;
            imageInfo.loaded = true;
            
            // Gerar estágios
            this.generateStagesForImage(imageId, imageInfo);
            
            this.loadedImages.add(imageId);
            this.loadingImages.delete(imageId);
            
            console.log(`Imagem carregada: ${imageInfo.name} (${this.loadedImages.size}/${this.images.size})`);
            this.updateImageCount();
            this.requestRender();
        } catch (error) {
            console.error('Erro ao carregar imagem:', error);
            this.loadingImages.delete(imageId);
        }
    }
    
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }
    
    unloadImageData(imageId) {
        const imageInfo = this.images.get(imageId);
        if (!imageInfo || !imageInfo.loaded) return;
        
        // Remover dados da imagem para liberar memória
        imageInfo.image = null;
        imageInfo.imageData = null;
        imageInfo.loaded = false;
        
        // Remover do cache de estágios
        this.globalStageCache.delete(imageId);
        this.loadedImages.delete(imageId);
        
        console.log(`Imagem descarregada: ${imageInfo.name} (${this.loadedImages.size}/${this.images.size})`);
        this.updateImageCount();
    }
    
    clearAllImages() {
        this.images.clear();
        this.imageFiles.clear();
        this.globalStageCache.clear();
        this.loadedImages.clear();
        this.loadingImages.clear();
        this.updateImageCount();
        this.requestRender();
    }
    
    updateImageCount() {
        this.imageCountDiv.textContent = `${this.images.size} imagens (${this.loadedImages.size} carregadas)`;
    }
    
    generateStagesForImage(imageId, imageInfo) {
        if (!imageInfo.loaded || !imageInfo.image) {
            return; // Só gerar estágios se a imagem estiver carregada
        }
        
        const stageMap = new Map();
        
        // Gerar todas as 4 versões da imagem
        this.zoomStages.forEach(stageInfo => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (stageInfo.stage === 1) {
                // Estágio 1: 1 pixel (cor média)
                canvas.width = 1;
                canvas.height = 1;
                const avgColor = this.getAverageColorFromData(imageInfo.imageData);
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
                ctx.imageSmoothingEnabled = false; // Pixelated effect
                ctx.drawImage(imageInfo.image, 0, 0, stageInfo.size, stageInfo.size);
            }
            
            stageMap.set(stageInfo.stage, canvas);
        });
        
        // Salvar no cache global
        this.globalStageCache.set(imageId, stageMap);
    }
    
    changeStage(newStage) {
        // Limitar entre 1 e 4
        newStage = Math.max(1, Math.min(4, newStage));
        
        if (newStage !== this.currentStage) {
            this.currentStage = newStage;
            this.updateImageSpacing();
            this.requestRender();
        }
    }
    
    updateImageSpacing() {
        // Calcular espaçamento baseado no tamanho atual das imagens
        const displaySize = this.getStageDisplaySize();
        const padding = 20; // Espaço mínimo entre imagens
        this.currentSpacing = Math.max(this.baseImageSpacing, displaySize + padding);
        
        // Reposicionar todas as imagens
        this.repositionAllImages();
    }
    
    repositionAllImages() {
        // Recalcular posições de todas as imagens baseado no espaçamento atual
        const gridSize = Math.ceil(Math.sqrt(this.images.size));
        let index = 0;
        
        // Centralizar o grid na origem (0,0)
        const gridOffsetX = -((gridSize - 1) * this.currentSpacing) / 2;
        const gridOffsetY = -((gridSize - 1) * this.currentSpacing) / 2;
        
        for (const [imageId, imageInfo] of this.images) {
            const col = index % gridSize;
            const row = Math.floor(index / gridSize);
            
            imageInfo.x = col * this.currentSpacing + gridOffsetX;
            imageInfo.y = row * this.currentSpacing + gridOffsetY;
            
            index++;
        }
    }
    
    getCurrentStageInfo() {
        return this.zoomStages.find(s => s.stage === this.currentStage);
    }
    
    reset() {
        this.currentStage = 1;
        this.cameraX = -this.canvas.width / 2;
        this.cameraY = -this.canvas.height / 2;
        this.requestRender();
    }
    
    getStageDisplaySize() {
        // Calcular tamanho de exibição baseado no estágio
        const baseSize = 100; // Tamanho base em pixels
        return baseSize * Math.pow(2, this.currentStage - 1);
    }
    
    samplePixelAt(x, y, sampleSize) {
        if (!this.imageData) return [0, 0, 0, 255];
        
        // Cache key para evitar recálculos
        const cacheKey = `${x},${y},${sampleSize}`;
        if (this.pixelCache.has(cacheKey)) {
            return this.pixelCache.get(cacheKey);
        }
        
        const data = this.imageData.data;
        const width = this.imageData.width;
        const height = this.imageData.height;
        
        // Garantir que estamos dentro dos limites
        x = Math.max(0, Math.min(width - 1, Math.floor(x)));
        y = Math.max(0, Math.min(height - 1, Math.floor(y)));
        
        let result;
        
        if (sampleSize <= 1) {
            // Sample direto
            const index = (y * width + x) * 4;
            result = [data[index], data[index + 1], data[index + 2], data[index + 3]];
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
            
            result = [r / count, g / count, b / count, a / count];
        }
        
        // Cache o resultado (limitar cache a 10000 entradas para evitar vazamento de memória)
        if (this.pixelCache.size < 10000) {
            this.pixelCache.set(cacheKey, result);
        }
        
        return result;
    }
    
    requestRender() {
        if (!this.isRendering) {
            this.needsRender = true;
            requestAnimationFrame(() => this.render());
        }
    }
    
    render() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.needsRender = false;
        
        // Limpar canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.images.size === 0) {
            // Desenhar placeholder
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(this.canvas.width / 2 - 1, this.canvas.height / 2 - 1, 2, 2);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Carregue imagens para começar', this.canvas.width / 2, this.canvas.height / 2 + 30);
            this.isRendering = false;
            return;
        }
        
        // Renderizar todas as imagens visíveis
        this.renderAllImages();
        
        // Atualizar info do zoom
        const stageInfo = this.getCurrentStageInfo();
        this.zoomInfo.textContent = `Estágio: ${this.currentStage}/4 (${stageInfo.description}) | ${this.images.size} imagens | Arraste para navegar`;
    }
    
    getAverageColorFromData(imageData) {
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
    
    renderAllImages() {
        const displaySize = this.getStageDisplaySize();
        
        // Calcular bounds da tela para culling (considerando que imagens crescem do centro)
        const halfSize = displaySize / 2;
        const screenLeft = this.cameraX - halfSize;
        const screenRight = this.cameraX + this.canvas.width + halfSize;
        const screenTop = this.cameraY - halfSize;
        const screenBottom = this.cameraY + this.canvas.height + halfSize;
        
        let renderedCount = 0;
        
        // Primeiro, verificar quais imagens devem ser descarregadas (fora da tela)
        for (const [imageId, imageInfo] of this.images) {
            const isVisible = !(imageInfo.x + halfSize < screenLeft ||
                              imageInfo.x - halfSize > screenRight ||
                              imageInfo.y + halfSize < screenTop ||
                              imageInfo.y - halfSize > screenBottom);
            
            // Se a imagem não está visível e está carregada, descarregar
            if (!isVisible && imageInfo.loaded) {
                console.log(`Descarregando imagem fora da tela: ${imageInfo.name}`);
                this.unloadImageData(imageId);
            }
        }
        
        // Renderizar apenas imagens visíveis
        for (const [imageId, imageInfo] of this.images) {
            // Verificar se a imagem está visível na tela (considerando centro da imagem)
            const isVisible = !(imageInfo.x + halfSize < screenLeft ||
                               imageInfo.x - halfSize > screenRight ||
                               imageInfo.y + halfSize < screenTop ||
                               imageInfo.y - halfSize > screenBottom);
            
            if (!isVisible) {
                continue; // Skip imagens fora da tela
            }
            
            // Carregar imagem se ainda não foi carregada (lazy loading)
            if (!imageInfo.loaded && !this.loadingImages.has(imageId)) {
                console.log(`Iniciando carregamento da imagem: ${imageInfo.name}`);
                this.loadImageData(imageId);
            }
            
            const stageMap = this.globalStageCache.get(imageId);
            if (!stageMap) {
                // Renderizar placeholder enquanto carrega
                this.renderImagePlaceholder(imageInfo, displaySize);
                continue;
            }
            
            const stageCanvas = stageMap.get(this.currentStage);
            if (!stageCanvas) {
                this.renderImagePlaceholder(imageInfo, displaySize);
                continue;
            }
            
            // Calcular posição na tela (centralizada na posição da imagem)
            const screenX = imageInfo.x - this.cameraX - displaySize / 2;
            const screenY = imageInfo.y - this.cameraY - displaySize / 2;
            
            // Renderizar a imagem do estágio
            this.ctx.imageSmoothingEnabled = false; // Manter pixelated
            this.ctx.drawImage(stageCanvas, screenX, screenY, displaySize, displaySize);
            
            // Debug: desenhar nome da imagem (opcional)
            if (this.currentStage >= 3) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(imageInfo.name, screenX, screenY - 5);
            }
            
            renderedCount++;
        }
        
        // Debug info mais detalhado
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Renderizadas: ${renderedCount}/${this.images.size} | Carregadas: ${this.loadedImages.size} | Carregando: ${this.loadingImages.size}`, 10, 20);
        this.ctx.fillText(`Espaçamento: ${this.currentSpacing}px | Câmera: (${Math.round(this.cameraX)}, ${Math.round(this.cameraY)})`, 10, 35);
        
        this.isRendering = false;
        
        // Se houve nova solicitação de render durante o processo
        if (this.needsRender) {
            this.requestRender();
        }
    }
    
    renderImagePlaceholder(imageInfo, displaySize) {
        // Calcular posição na tela
        const screenX = imageInfo.x - this.cameraX - displaySize / 2;
        const screenY = imageInfo.y - this.cameraY - displaySize / 2;
        
        // Desenhar placeholder cinza
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(screenX, screenY, displaySize, displaySize);
        
        // Desenhar borda
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenX, screenY, displaySize, displaySize);
        
        // Desenhar nome do arquivo (se couber)
        if (displaySize > 40) {
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                imageInfo.name.substring(0, 15) + '...', 
                screenX + displaySize / 2, 
                screenY + displaySize / 2
            );
        }
        
        // Indicador de carregamento
        if (this.loadingImages.has(imageInfo.id)) {
            this.ctx.fillStyle = '#4a4';
            this.ctx.fillRect(screenX + 2, screenY + 2, 8, 8);
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new ProceduralZoomViewer();
});