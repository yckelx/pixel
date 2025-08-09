/**
 * Gerencia eventos de mouse e teclado
 */
export class EventHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Callbacks
        this.onStageChange = null;
        this.onCameraMove = null;
        this.onReset = null;
        this.onImageDoubleClick = null;
        
        // Estado do duplo clique
        this.lastClickTime = 0;
        this.lastClickX = 0;
        this.lastClickY = 0;
        this.doubleClickThreshold = 300; // ms
        
        this.setupEventListeners();
    }

    /**
     * Configura todos os event listeners
     */
    setupEventListeners() {
        this.setupMouseEvents();
        this.setupKeyboardEvents();
    }

    /**
     * Eventos de mouse
     */
    setupMouseEvents() {
        // Zoom com mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.onStageChange) {
                const direction = e.deltaY > 0 ? -1 : 1;
                this.onStageChange(direction);
            }
        });

        // Drag para mover câmera + detecção de duplo clique
        this.canvas.addEventListener('mousedown', (e) => {
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastClickTime;
            const deltaX = Math.abs(e.offsetX - this.lastClickX);
            const deltaY = Math.abs(e.offsetY - this.lastClickY);
            
            // Verificar duplo clique
            if (deltaTime < this.doubleClickThreshold && deltaX < 10 && deltaY < 10) {
                // É um duplo clique, verificar se há imagem na posição
                if (this.onImageDoubleClick) {
                    const imageId = this.getImageAtPosition(e.offsetX, e.offsetY);
                    if (imageId) {
                        this.onImageDoubleClick(imageId);
                        return; // Não iniciar drag
                    }
                }
            }
            
            // Salvar estado do clique
            this.lastClickTime = currentTime;
            this.lastClickX = e.offsetX;
            this.lastClickY = e.offsetY;
            
            // Iniciar drag
            this.isDragging = true;
            this.lastMouseX = e.offsetX;
            this.lastMouseY = e.offsetY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.onCameraMove) {
                const deltaX = e.offsetX - this.lastMouseX;
                const deltaY = e.offsetY - this.lastMouseY;
                this.onCameraMove(deltaX, deltaY);
                this.lastMouseX = e.offsetX;
                this.lastMouseY = e.offsetY;
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
    }

    /**
     * Eventos de teclado
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    if (this.onStageChange) this.onStageChange(1);
                    break;
                case '-':
                    e.preventDefault();
                    if (this.onStageChange) this.onStageChange(-1);
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault();
                    if (this.onStageChange) this.onStageChange(0, parseInt(e.key));
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    if (this.onReset) this.onReset();
                    break;
            }
        });
    }

    /**
     * Método para detectar imagem na posição do clique
     * Precisa ser configurado externamente com referência para os dados das imagens
     */
    getImageAtPosition(screenX, screenY) {
        // Este método será implementado externamente
        // Retorna o ID da imagem na posição ou null
        if (this.getImageAtPositionCallback) {
            return this.getImageAtPositionCallback(screenX, screenY);
        }
        return null;
    }

    /**
     * Configura callbacks
     */
    setCallbacks(callbacks) {
        this.onStageChange = callbacks.onStageChange;
        this.onCameraMove = callbacks.onCameraMove;
        this.onReset = callbacks.onReset;
        this.onImageDoubleClick = callbacks.onImageDoubleClick;
        this.getImageAtPositionCallback = callbacks.getImageAtPosition;
    }

    /**
     * Limpa event listeners
     */
    destroy() {
        // Remove event listeners se necessário
        this.canvas.style.cursor = 'default';
    }
}