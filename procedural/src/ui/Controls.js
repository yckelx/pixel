/**
 * Gerencia controles da UI (upload, botões, displays)
 */
export class Controls {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.clearAllBtn = document.getElementById('clearAll');
        this.imageCountDiv = document.getElementById('imageCount');
        this.zoomInfo = document.getElementById('zoomInfo');
        
        this.onFileUpload = null;
        this.onClearAll = null;
        
        this.setupEventListeners();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Upload de múltiplas imagens
        this.fileInput.addEventListener('change', (e) => {
            if (this.onFileUpload) {
                const files = Array.from(e.target.files);
                this.onFileUpload(files);
            }
        });

        // Botão limpar todas
        this.clearAllBtn.addEventListener('click', () => {
            if (this.onClearAll) {
                this.onClearAll();
            }
        });
    }

    /**
     * Atualiza contador de imagens
     */
    updateImageCount(total, loaded) {
        this.imageCountDiv.textContent = `${total} imagens (${loaded} carregadas)`;
    }

    /**
     * Atualiza informações de zoom
     */
    updateZoomInfo(stage, description, totalImages) {
        this.zoomInfo.textContent = `Estágio: ${stage}/4 (${description}) | ${totalImages} imagens | Arraste para navegar`;
    }

    /**
     * Configura callbacks
     */
    setCallbacks(callbacks) {
        this.onFileUpload = callbacks.onFileUpload;
        this.onClearAll = callbacks.onClearAll;
    }

    /**
     * Habilita/desabilita controles
     */
    setEnabled(enabled) {
        this.fileInput.disabled = !enabled;
        this.clearAllBtn.disabled = !enabled;
    }

    /**
     * Limpa input de arquivo
     */
    clearFileInput() {
        this.fileInput.value = '';
    }
}