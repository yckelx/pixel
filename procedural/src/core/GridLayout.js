/**
 * Gerencia posicionamento em grid fixo como no projeto Place
 */
export class GridLayout {
    constructor() {
        this.gridSize = 32; // Tamanho do pixel/célula do grid
        this.gridWidth = 1000; // Largura do grid em pixels
        this.gridHeight = 1000; // Altura do grid em pixels
        this.gridCols = Math.floor(this.gridWidth / this.gridSize);
        this.gridRows = Math.floor(this.gridHeight / this.gridSize);
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
     * Converte coordenadas do mundo para coordenadas de grid
     */
    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.gridSize),
            y: Math.floor(worldY / this.gridSize)
        };
    }

    /**
     * Verifica se uma posição de grid é válida
     */
    isValidGridPosition(gridX, gridY) {
        return gridX >= 0 && gridX < this.gridCols && 
               gridY >= 0 && gridY < this.gridRows;
    }

    /**
     * Calcula posição para uma nova imagem diretamente na tela
     */
    calculatePosition(imageCount) {
        // Posicionar imagens em sequência no grid da tela (800x600 canvas)
        const screenGridCols = Math.floor(800 / this.gridSize); // ~25 colunas
        const index = imageCount - 1;
        const gridX = index % screenGridCols;
        const gridY = Math.floor(index / screenGridCols);
        
        return {
            x: gridX * this.gridSize,
            y: gridY * this.gridSize
        };
    }

    /**
     * Atualiza espaçamento baseado no estágio (para compatibilidade)
     */
    updateSpacing(displaySize) {
        // No grid fixo, o espaçamento é sempre o tamanho do grid
        this.currentSpacing = this.gridSize;
    }

    /**
     * Recalcula posições de todas as imagens na tela
     */
    repositionAll(imageCount) {
        const positions = [];
        const screenGridCols = Math.floor(800 / this.gridSize); // ~25 colunas
        
        for (let index = 0; index < imageCount; index++) {
            const gridX = index % screenGridCols;
            const gridY = Math.floor(index / screenGridCols);
            positions.push({
                x: gridX * this.gridSize,
                y: gridY * this.gridSize
            });
        }

        return positions;
    }

    /**
     * Getters
     */
    get spacing() {
        return this.gridSize;
    }
}