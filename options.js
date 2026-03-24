// Valores por defecto
const DEFAULTS = {
    readTarget: 'es',
    writeTarget: 'en',
    cachePrefix: 'tr_',
    customCSS: `.discord-translator-wrapper { color: #ddd; font-size: 0.95rem; margin: 4px 0 0 2px; border-left: 3px solid #5865F2; padding: 4px 10px; display: block; user-select: text; background-color: rgba(0, 0, 0, 0.2); border-radius: 4px; } .discord-translator-wrapper:hover { background: rgba(88, 101, 242, 0.1); }`
};

const statusEl = document.getElementById('status');

function showStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = 'status success';
    setTimeout(() => statusEl.className = 'status', 15000);
}

// Cargar datos
function loadSettings() {
    chrome.storage.local.get(DEFAULTS, (items) => {
        document.getElementById('readTarget').value = items.readTarget;
        document.getElementById('writeTarget').value = items.writeTarget;
        document.getElementById('cachePrefix').value = items.cachePrefix;
        document.getElementById('customCSS').value = items.customCSS;
    });
}

// Función para limpiar solo la caché de traducciones
document.getElementById('clearCache').addEventListener('click', async () => {
    const prefix = document.getElementById('cachePrefix').value || 'tr_';
    
    if (confirm(`¿Borrar todas las traducciones que empiecen con "${prefix}"?`)) {
        const allData = await chrome.storage.local.get(null);
        const keysToRemove = Object.keys(allData).filter(key => key.startsWith(prefix));

        chrome.storage.local.remove(keysToRemove, () => {
            showStatus(`🧹 Se eliminaron ${keysToRemove.length} traducciones de la caché`);
        });
    }
});

// Guardar datos
document.getElementById('save').addEventListener('click', () => {
    const settings = {
        readTarget: document.getElementById('readTarget').value || DEFAULTS.readTarget,
        writeTarget: document.getElementById('writeTarget').value || DEFAULTS.writeTarget,
        cachePrefix: document.getElementById('cachePrefix').value || DEFAULTS.cachePrefix,
        customCSS: document.getElementById('customCSS').value
    };

    chrome.storage.local.set(settings, () => {
        showStatus('✅ Configuración guardada correctamente');
    });
});

// Resetear datos
document.getElementById('reset').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres restablecer los valores por defecto?')) {
        chrome.storage.local.set(DEFAULTS, () => {
            loadSettings();
            showStatus('🔄 Valores restablecidos');
        });
    }
});

document.addEventListener('DOMContentLoaded', loadSettings);