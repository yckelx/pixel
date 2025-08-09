/**
 * Gerencia animações suaves e transições
 */
export class AnimationManager {
    constructor() {
        this.activeAnimations = new Map();
        this.animationId = 0;
    }

    /**
     * Anima transição de estágio com interpolação suave
     */
    animateStageTransition(fromStage, toStage, duration = 300) {
        return new Promise((resolve) => {
            const animId = this.animationId++;
            const startTime = performance.now();
            
            const animation = {
                id: animId,
                type: 'stage',
                fromStage,
                toStage,
                duration,
                startTime,
                onUpdate: null,
                onComplete: resolve
            };

            this.activeAnimations.set(animId, animation);
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function (ease-out)
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                
                // Interpolar entre estágios
                const currentStage = fromStage + (toStage - fromStage) * easedProgress;
                
                if (animation.onUpdate) {
                    animation.onUpdate(currentStage, progress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.activeAnimations.delete(animId);
                    resolve(toStage);
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    /**
     * Anima transição de câmera suave
     */
    animateCamera(fromX, fromY, toX, toY, duration = 500) {
        return new Promise((resolve) => {
            const animId = this.animationId++;
            const startTime = performance.now();
            
            const animation = {
                id: animId,
                type: 'camera',
                fromX, fromY, toX, toY,
                duration,
                startTime,
                onUpdate: null,
                onComplete: resolve
            };

            this.activeAnimations.set(animId, animation);
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function (ease-in-out)
                const easedProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                const currentX = fromX + (toX - fromX) * easedProgress;
                const currentY = fromY + (toY - fromY) * easedProgress;
                
                if (animation.onUpdate) {
                    animation.onUpdate(currentX, currentY, progress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.activeAnimations.delete(animId);
                    resolve({ x: toX, y: toY });
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    /**
     * Anima fade in/out
     */
    animateFade(element, fromOpacity, toOpacity, duration = 200) {
        return new Promise((resolve) => {
            const animId = this.animationId++;
            const startTime = performance.now();
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const currentOpacity = fromOpacity + (toOpacity - fromOpacity) * progress;
                element.style.opacity = currentOpacity;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    /**
     * Define callback para animação ativa
     */
    setAnimationCallback(animId, onUpdate) {
        const animation = this.activeAnimations.get(animId);
        if (animation) {
            animation.onUpdate = onUpdate;
        }
    }

    /**
     * Cancela todas as animações
     */
    cancelAll() {
        for (const [animId, animation] of this.activeAnimations) {
            if (animation.onComplete) {
                animation.onComplete();
            }
        }
        this.activeAnimations.clear();
    }

    /**
     * Cancela animação específica
     */
    cancel(animId) {
        const animation = this.activeAnimations.get(animId);
        if (animation) {
            if (animation.onComplete) {
                animation.onComplete();
            }
            this.activeAnimations.delete(animId);
        }
    }

    /**
     * Verifica se há animações ativas
     */
    get hasActiveAnimations() {
        return this.activeAnimations.size > 0;
    }
}