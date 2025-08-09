/**
 * Gerencia o canvas base com pixels de cor (como no projeto Place)
 */
export class BaseCanvas {
    constructor(width = 1000, height = 1000, gridSize = 32) {
        this.width = width;
        this.height = height;
        this.gridSize = gridSize;
        this.canvas = this.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        this.pixels = new Map(); // Armazena pixels de cor por posição de grid
        
        this.initializeCanvas();
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        return canvas;
    }

    initializeCanvas() {
        // Fundo transparente para não aparecer como bloco branco
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Define um pixel de cor usando coordenadas de grid
     */
    setPixel(gridX, gridY, color) {
        const maxGridX = Math.floor(this.width / this.gridSize);
        const maxGridY = Math.floor(this.height / this.gridSize);
        
        if (gridX < 0 || gridX >= maxGridX || gridY < 0 || gridY >= maxGridY) return;
        
        this.pixels.set(`${gridX},${gridY}`, color);
        
        // Renderizar como um quadrado do tamanho do grid
        this.ctx.fillStyle = color;
        this.ctx.fillRect(gridX * this.gridSize, gridY * this.gridSize, this.gridSize, this.gridSize);
    }

    /**
     * Obtém a cor de um pixel do grid
     */
    getPixel(gridX, gridY) {
        return this.pixels.get(`${gridX},${gridY}`) || null;
    }

    /**
     * Converte coordenadas do mundo para coordenadas de grid
     */
    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.gridSize),
            y: Math.floor(worldY / this.gridSize)
        };
    }

    /**
     * Converte coordenadas de grid para coordenadas do mundo
     */
    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.gridSize,
            y: gridY * this.gridSize
        };
    }

    /**
     * Limpa o canvas
     */
    clear() {
        this.pixels.clear();
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Renderiza o canvas base em outro contexto
     */
    renderTo(targetCtx, x, y, width, height) {
        targetCtx.drawImage(this.canvas, x, y, width, height);
    }

    /**
     * Getters
     */
    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }
}