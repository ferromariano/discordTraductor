/**
 * Discord Translator Pro
 * Refactorizado para cumplir con:
 * - Clean Code (SOLID)
 * - Seguridad (Evitar innerHTML)
 * - Eficiencia de Memoria
 */

(function() {
    'use strict';

    // --- CONFIGURACIÓN ---
    const CONFIG = {
        READ_TARGET: 'es',
        WRITE_TARGET: 'en',
        CACHE_PREFIX: 'tr_',
        SELECTORS: {
            MESSAGE_CONTENT: '[class*="messageContent"]',
            REPLIED_MESSAGE: '[class*="repliedMessage"]',
            TEXTBOX: '[role="textbox"]'
        }
    };

    // --- MÓDULO DE ESTILOS ---
    const StyleManager = {
        inject(customCSS) {
            const style = document.createElement('style');
            style.textContent = customCSS;
            document.head.appendChild(style);
        }
    };

    // --- MÓDULO DE TRADUCCIÓN Y CACHÉ ---
    const TranslationService = {
        _getHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash).toString(36);
        },

        async translate(text, target) {
            if (!text?.trim()) return text;

            const textHash = this._getHash(text);
            const cacheKey = `${CONFIG.CACHE_PREFIX}${target}_${textHash}`;

            try {
                // Intento desde caché
                const cache = await chrome.storage.local.get(cacheKey);
                if (cache[cacheKey]) return cache[cacheKey];

                // Llamada a API
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response error', { cause: response });

                const data = await response.json();
                const translatedText = data[0].map(item => item[0]).join('');

                // Guardar en caché
                await chrome.storage.local.set({ [cacheKey]: translatedText });
                return translatedText;

            } catch (error) {
                console.error("[Translator]: Error en traducción", error);
                return text;
            }
        }
    };

    // --- MÓDULO DE INTERFAZ (DOM) ---
    const DOMManager = {
        createTranslationElement(text) {
            const div = document.createElement('div');
            div.className = "discord-translator-wrapper";
            // Seguridad: Usamos textContent en lugar de innerHTML
            div.textContent = text; 
            return div;
        },

        async injectToInput(input, text) {
            input.focus();

            const range = document.createRange();
            range.selectNodeContents(input);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            await new Promise(resolve => setTimeout(resolve, 50));
            input.dispatchEvent(
                new InputEvent(
                    'beforeinput', 
                    {
                        inputType: 'deleteContentBackward',
                        bubbles: true,
                        cancelable: true
                    }
                )
            );
            await new Promise(resolve => setTimeout(resolve, 1000));
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);

            // 3. Disparamos un evento "Paste" idéntico al que hace el navegador
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(pasteEvent);
            input.focus();


        }
    };

    // --- LÓGICA DE OBSERVACIÓN Y EVENTOS ---
    const App = {
        async init() {

            const settings = await chrome.storage.local.get({
                readTarget: 'es',
                writeTarget: 'en',
                cachePrefix: 'tr_',
                customCSS: '' // El CSS que definiste antes
            });

            StyleManager.inject(settings.customCSS);
            this.initObserver();
            this.initInputHandler();
            console.log("[Translator]: Activo");
        },

        initObserver() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return;

                        const messages = node.querySelectorAll(CONFIG.SELECTORS.MESSAGE_CONTENT);
                        messages.forEach(msg => this.processMessage(msg));
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        },

        async processMessage(element) {
            // Filtros de salida rápida
            if (element.dataset.translated || element.closest(CONFIG.SELECTORS.REPLIED_MESSAGE)) return;

            element.dataset.translated = "true";
            const originalText = element.innerText.trim();

            if (originalText.length > 0) {
                const translated = await TranslationService.translate(originalText, CONFIG.READ_TARGET);
                if (translated && translated !== originalText) {
                    element.appendChild(DOMManager.createTranslationElement(translated));
                }
            }
        },

        initInputHandler() {
            document.addEventListener('keydown', async (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    const input = e.target.closest(CONFIG.SELECTORS.TEXTBOX);
                    if (!input) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const text = input.textContent.trim();
                    if (!text) return;

                    const translated = await TranslationService.translate(text, CONFIG.WRITE_TARGET);
                    await DOMManager.injectToInput(input, translated);
                }
            }, true);
        }
    };

    // Ejecución
    if (document.readyState === 'complete') {
        App.init();
    } else {
        window.addEventListener('load', () => App.init());
    }

})();