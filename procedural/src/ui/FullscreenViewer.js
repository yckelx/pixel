/**
 * Gerencia visualização fullscreen de imagens
 */
export class FullscreenViewer {
    constructor() {
        this.isActive = false;
        this.currentImageId = null;
        this.overlay = null;
        this.imageElement = null;
        this.closeButton = null;
        
        this.onClose = null;
        this.onImageChange = null;
        
        this.createOverlay();
        this.setupEventListeners();
    }

    /**
     * Cria overlay do fullscreen
     */
    createOverlay() {
        // Overlay principal
        this.overlay = document.createElement('div');
        this.overlay.id = 'fullscreen-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            z-index: 10000;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        `;

        // Container da imagem
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // Elemento da imagem
        this.imageElement = document.createElement('img');
        this.imageElement.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            transition: transform 0.3s ease;
        `;

        // Botão de fechar
        this.closeButton = document.createElement('button');
        this.closeButton.innerHTML = '✕';
        this.closeButton.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
            z-index: 10001;
        `;

        // Info da imagem
        this.infoPanel = document.createElement('div');
        this.infoPanel.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            backdrop-filter: blur(10px);
        `;

        // Controles de navegação
        this.prevButton = this.createNavButton('‹', 'left');
        this.nextButton = this.createNavButton('›', 'right');

        // Montar estrutura
        imageContainer.appendChild(this.imageElement);
        this.overlay.appendChild(imageContainer);
        this.overlay.appendChild(this.closeButton);
        this.overlay.appendChild(this.infoPanel);
        this.overlay.appendChild(this.prevButton);
        this.overlay.appendChild(this.nextButton);
        
        document.body.appendChild(this.overlay);
    }

    /**
     * Cria botões de navegação
     */
    createNavButton(text, side) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.style.cssText = `
            position: absolute;
            top: 50%;
            ${side}: 20px;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
            z-index: 10001;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        return button;
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Fechar com botão
        this.closeButton.addEventListener('click', () => this.close());
        
        // Fechar clicando fora da imagem
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (this.isActive && e.key === 'Escape') {
                this.close();
            }
        });

        // Navegação com setas
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigateImage('prev');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.navigateImage('next');
            }
        });

        // Botões de navegação
        this.prevButton.addEventListener('click', () => this.navigateImage('prev'));
        this.nextButton.addEventListener('click', () => this.navigateImage('next'));

        // Hover effects
        this.closeButton.addEventListener('mouseenter', () => {
            this.closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        
        this.closeButton.addEventListener('mouseleave', () => {
            this.closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
        });
    }

    /**
     * Abre fullscreen com uma imagem
     */
    async open(imageInfo, imageManager) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentImageId = imageInfo.id;
        this.imageManager = imageManager;
        
        // Configurar imagem
        if (imageInfo.image) {
            this.imageElement.src = imageInfo.image.src;
        } else {
            // Se não carregada, carregar primeiro
            await imageManager.loadImage(imageInfo.id);
            const loadedInfo = imageManager.getImage(imageInfo.id);
            if (loadedInfo && loadedInfo.image) {
                this.imageElement.src = loadedInfo.image.src;
            }
        }
        
        // Atualizar info
        this.updateImageInfo(imageInfo);
        
        // Mostrar overlay
        this.overlay.style.display = 'flex';
        this.overlay.style.opacity = '0';
        
        // Animar entrada
        requestAnimationFrame(() => {
            this.overlay.style.transition = 'opacity 0.3s ease';
            this.overlay.style.opacity = '1';
        });
        
        // Desabilitar scroll da página
        document.body.style.overflow = 'hidden';
    }

    /**
     * Fecha fullscreen
     */
    close() {
        if (!this.isActive) return;
        
        // Animar saída
        this.overlay.style.opacity = '0';
        
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.isActive = false;
            this.currentImageId = null;
            
            // Reabilitar scroll
            document.body.style.overflow = '';
            
            if (this.onClose) {
                this.onClose();
            }
        }, 300);
    }

    /**
     * Navega entre imagens
     */
    navigateImage(direction) {
        if (!this.imageManager || !this.onImageChange) return;
        
        const allImages = Array.from(this.imageManager.getAllImages().values());
        const currentIndex = allImages.findIndex(img => img.id === this.currentImageId);
        
        let newIndex;
        if (direction === 'prev') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : allImages.length - 1;
        } else {
            newIndex = currentIndex < allImages.length - 1 ? currentIndex + 1 : 0;
        }
        
        const newImageInfo = allImages[newIndex];
        if (newImageInfo) {
            this.onImageChange(newImageInfo);
            this.open(newImageInfo, this.imageManager);
        }
    }

    /**
     * Atualiza informações da imagem
     */
    updateImageInfo(imageInfo) {
        const info = `
            <div style="font-weight: bold; margin-bottom: 8px;">${imageInfo.name}</div>
            <div style="font-size: 12px; opacity: 0.8;">
                ${imageInfo.width}x${imageInfo.height} pixels
                ${imageInfo.loaded ? '• Carregada' : '• Carregando...'}
            </div>
        `;
        this.infoPanel.innerHTML = info;
    }

    /**
     * Define callbacks
     */
    setCallbacks(callbacks) {
        this.onClose = callbacks.onClose;
        this.onImageChange = callbacks.onImageChange;
    }

    /**
     * Verifica se está ativo
     */
    get active() {
        return this.isActive;
    }
}