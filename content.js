const READ_TARGET = 'es';
const WRITE_TARGET = 'en';

// --- 1. INYECCIÓN DE ESTILOS CUSTOM ---
const style = document.createElement('style');
style.innerHTML = `
    /* Clase principal para el contenedor de la traducción */
    .discord-translator-wrapper {
        color: #ddd;
        font-size: 1rem;
        margin: 0 0 0 2px;
        border-left: 4px solid rgba(255, 255, 255, 0.1);
        padding: 0.3rem 0.3rem 0.3rem 1rem;
        display: block;
        user-select: text;
        float: right;
        width: 60%;
        background-color: #333;
        border-radius: 2px;
    }

    /* Prefijo (el emoji o texto "Trad:") */
    .discord-translator-prefix {
        display: none;
        margin-right: 4px;
        opacity: 0.8;
    }

    /* Efecto cuando pasas el mouse (opcional) */
    .discord-translator-wrapper:hover {
        background: rgba(0, 168, 252, 0.05);
        border-radius: 4px;
    }
`;
document.head.appendChild(style);

// --- UTILIDAD DE HASHING ---
// Convierte un texto largo en un identificador corto (ej: "1a2b3c4")
function getTextHash(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convierte a entero de 32 bits
    }
    // Math.abs para evitar signos negativos y toString(36) para comprimirlo en alfanumérico
    return Math.abs(hash).toString(36); 
}

// --- UTILIDAD DE TRADUCCIÓN CON CACHÉ Y HASH ---
async function translate(text, target) {
    if (!text || text.trim().length === 0) return text;
    
    // Generamos el hash del texto
    const textHash = getTextHash(text);
    // Llave corta, ej: "tr_es_1xyz9"
    const cacheKey = `tr_${target}_${textHash}`; 

    try {
        const cacheResult = await chrome.storage.local.get([cacheKey]);
        
        if (cacheResult[cacheKey]) {
            console.log("[Discord-Translator]: ⚡ CACHÉ HIT", textHash, "->", cacheResult[cacheKey]);
            return cacheResult[cacheKey]; 
        }

        console.log("[Discord-Translator]: ☁️ API CALL", textHash);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        const translatedText = data[0].map(item => item[0]).join('');
        
        console.log("[Discord-Translator]: RESULTADO API (textHash)\n", text, "\n", target, "\n", translatedText);

        // Guardamos usando la llave hasheada
        await chrome.storage.local.set({ [cacheKey]: translatedText });

        return translatedText;

    } catch (e) {
        console.log("[Discord-Translator]: ERROR", text, target);
        console.error("Error en traducción:", e);
        return text; 
    }
}

// --- TRADUCIR MENSAJES ENTRANTES ---
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                // Buscamos todos los posibles contenedores de mensaje en el nodo insertado
                const messages = node.querySelectorAll('[class*="messageContent"]');
                
                messages.forEach(messageContent => {
                    // --- FILTRO CRÍTICO ---
                    // Si el mensaje está dentro de una respuesta (preview), lo ignoramos
                    if (messageContent.closest('[class*="repliedMessage"]')) {
                        // console.log("[Discord-Translator]: Ignorando preview de respuesta");
                        return; 
                    }

                    if (!messageContent.dataset.translated) {
                        messageContent.dataset.translated = "true";
                        const text = messageContent.innerText.trim();

                        if (text.length > 0) {
                            translate(text, READ_TARGET).then(translated => {
                                if (translated && translated !== text) {
                                    const div = document.createElement('div');
                                    div.className = "discord-translator-wrapper"; 
                                    div.innerHTML = `${translated}`;
                                    console.log("[Discord-Translator]: Traduciendo mensaje real", text);
                                    messageContent.appendChild(div);
                                }
                            });
                        }
                    }
                });
            }
        });
    }
});

// Aseguramos que el body existe antes de observar
if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[Discord-Translator]:body:exists");
} else {
    window.addEventListener('load', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        console.log("[Discord-Translator]:windows:load");
    });
}

// Corrección aplicada aquí:
observer.observe(document.body, { childList: true, subtree: true });

// --- TRADUCIR MENSAJE SALIENTE (CTRL + ENTER) ---
document.addEventListener('keydown', async (e) => {
    // Si presionas Ctrl + Enter en el cuadro de texto
    if (e.ctrlKey && e.key === 'Enter') {
        const input = document.querySelector('[role="textbox"]');
        
        if (input && input.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();

            // Usamos textContent en lugar de innerText para evitar bugs de Slate con espacios
            const textToTranslate = input.textContent.trim();
            if (!textToTranslate) return;

            // Traducimos al inglés
            const translatedText = await translate(textToTranslate, WRITE_TARGET); 

            await injectTextinput(input, translatedText);

            console.log("[Discord-Translator]:input():CTRL+ENTER\n", textToTranslate, "\n", translatedText);
        }
    }
}, true);

const deleteEvent = new InputEvent('beforeinput', {
inputType: 'deleteContentBackward',
bubbles: true,
cancelable: true
});


// Inserta la traducción en el input usando el portapapeles virtual para que Slate lo detecte correctamente
async function injectTextinput(input, text) {
    input.focus();

    // 1. Alternativa moderna a execCommand('selectAll')
    const range = document.createRange();
    range.selectNodeContents(input); // Selecciona todo el contenido dentro del input
    console.log("range::", range.toString());

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    console.log("selection::", selection);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log("borrado::",
        input.dispatchEvent(
            new InputEvent(
                'beforeinput', 
                {
                    inputType: 'deleteContentBackward',
                    bubbles: true,
                    cancelable: true
                }
            )
        )
    );
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("ahoraa pega::")
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);

    // 3. Disparamos un evento "Paste" idéntico al que hace el navegador
    const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
    });
    console.log("pegadoo", input.dispatchEvent(pasteEvent));
    input.focus();
}





