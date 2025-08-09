/**
 * Gerencia carregamento lazy e cache de imagens
 */
export class ImageManager {
    constructor() {
        this.images = new Map(); // ID -> ImageInfo
        this.imageFiles = new Map(); // ID -> File original
        this.loadedImages = new Set(); // IDs carregadas
        this.loadingImages = new Set(); // IDs sendo carregadas
        this.nextImageId = 1;
        
        // Micro-otimização: controle de memória
        this.maxLoadedImages = 30; // Limite de imagens carregadas simultaneamente
        this.lastUsedTime = new Map(); // Para LRU cache
    }

    /**
     * Adiciona uma nova imagem (sem carregar ainda)
     */
    addImage(file, x, y) {
        const imageId = this.nextImageId++;
        
        const imageInfo = {
            id: imageId,
            name: file.name,
            image: null,
            imageData: null,
            x: x,
            y: y,
            width: 100, // Tamanho estimado
            height: 100,
            loaded: false
        };

        this.imageFiles.set(imageId, file);
        this.images.set(imageId, imageInfo);
        
        return imageId;
    }

    /**
     * Carrega uma imagem específica
     */
    async loadImage(imageId) {
        if (this.loadedImages.has(imageId) || this.loadingImages.has(imageId)) {
            return;
        }

        this.loadingImages.add(imageId);
        const file = this.imageFiles.get(imageId);
        const imageInfo = this.images.get(imageId);

        if (!file || !imageInfo) return;

        try {
            const dataUrl = await this.fileToDataUrl(file);
            const img = await this.loadImageFromUrl(dataUrl);

            // Crear imageData
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Atualizar info
            imageInfo.image = img;
            imageInfo.imageData = imageData;
            imageInfo.width = img.width;
            imageInfo.height = img.height;
            imageInfo.loaded = true;

            this.loadedImages.add(imageId);
            this.loadingImages.delete(imageId);
            this.lastUsedTime.set(imageId, Date.now());

            // Micro-otimização: limpar imagens antigas se exceder limite
            if (this.loadedImages.size > this.maxLoadedImages) {
                this.unloadOldestImages();
            }

            console.log(`Imagem carregada: ${imageInfo.name} (${this.loadedImages.size}/${this.images.size})`);
            
            return imageInfo;
        } catch (error) {
            console.error('Erro ao carregar imagem:', error);
            this.loadingImages.delete(imageId);
        }
    }

    /**
     * Descarrega uma imagem da memória
     */
    unloadImage(imageId) {
        const imageInfo = this.images.get(imageId);
        if (!imageInfo || !imageInfo.loaded) return;

        imageInfo.image = null;
        imageInfo.imageData = null;
        imageInfo.loaded = false;

        this.loadedImages.delete(imageId);
        this.lastUsedTime.delete(imageId);
        
        console.log(`Imagem descarregada: ${imageInfo.name} (${this.loadedImages.size}/${this.images.size})`);
    }

    /**
     * Atualiza posições das imagens
     */
    updateImagePositions(positions) {
        let index = 0;
        for (const [imageId, imageInfo] of this.images) {
            if (positions[index]) {
                imageInfo.x = positions[index].x;
                imageInfo.y = positions[index].y;
            }
            index++;
        }
    }

    /**
     * Micro-otimização: Remove imagens mais antigas da memória
     */
    unloadOldestImages() {
        if (this.loadedImages.size <= this.maxLoadedImages) return;

        // Encontrar imagens menos usadas
        const sortedByUsage = Array.from(this.lastUsedTime.entries())
            .sort((a, b) => a[1] - b[1]); // Ordenar por timestamp (mais antigo primeiro)

        // Descarregar 30% das imagens mais antigas
        const toUnload = Math.ceil(this.loadedImages.size * 0.3);
        
        for (let i = 0; i < toUnload && i < sortedByUsage.length; i++) {
            const imageId = sortedByUsage[i][0];
            this.unloadImage(imageId);
        }

        console.log(`Memória otimizada: descarregadas ${toUnload} imagens antigas`);
    }

    /**
     * Remove todas as imagens
     */
    clear() {
        this.images.clear();
        this.imageFiles.clear();
        this.loadedImages.clear();
        this.loadingImages.clear();
        this.lastUsedTime.clear();
    }

    /**
     * Utilitários privados
     */
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

    /**
     * Getters
     */
    get totalImages() {
        return this.images.size;
    }

    get loadedCount() {
        return this.loadedImages.size;
    }

    get loadingCount() {
        return this.loadingImages.size;
    }

    getImage(imageId) {
        const imageInfo = this.images.get(imageId);
        if (imageInfo && imageInfo.loaded) {
            // Marcar como usado recentemente
            this.lastUsedTime.set(imageId, Date.now());
        }
        return imageInfo;
    }

    getAllImages() {
        return this.images;
    }

    isLoaded(imageId) {
        return this.loadedImages.has(imageId);
    }

    isLoading(imageId) {
        return this.loadingImages.has(imageId);
    }
}