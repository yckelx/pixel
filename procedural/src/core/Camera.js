/**
 * Gerencia a posição da câmera e viewport
 */
export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = -canvas.width / 2;
        this.y = -canvas.height / 2;
    }

    /**
     * Move a câmera por um delta
     */
    moveBy(deltaX, deltaY) {
        this.x -= deltaX; // Inverter para movimento natural
        this.y -= deltaY;
    }

    /**
     * Define posição absoluta da câmera
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Reseta câmera para posição central
     */
    reset() {
        this.x = -this.canvas.width / 2;
        this.y = -this.canvas.height / 2;
    }

    /**
     * Calcula bounds do viewport para culling
     */
    getViewportBounds(padding = 0) {
        return {
            left: this.x - padding,
            right: this.x + this.canvas.width + padding,
            top: this.y - padding,
            bottom: this.y + this.canvas.height + padding
        };
    }

    /**
     * Converte coordenadas do mundo para coordenadas da tela
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y
        };
    }

    /**
     * Verifica se um objeto está visível no viewport
     */
    isVisible(worldX, worldY, size) {
        const halfSize = size / 2;
        const bounds = this.getViewportBounds(halfSize);
        
        return !(worldX + halfSize < bounds.left ||
                worldX - halfSize > bounds.right ||
                worldY + halfSize < bounds.top ||
                worldY - halfSize > bounds.bottom);
    }
}