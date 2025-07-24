// Script pour gérer l'affichage des résultats dans le panneau latéral
document.addEventListener('DOMContentLoaded', function() {
    // Éléments du DOM
    const rightPanel = document.getElementById('right-panel');
    const panelOverlay = document.getElementById('panel-overlay');
    const closeBtn = document.getElementById('panel-close-btn');
    const resultsWrapper = document.getElementById('results-wrapper');
    
    // Fonction pour afficher le panneau latéral
    function openRightPanel() {
        // Afficher l'overlay
        panelOverlay.classList.add('show');
        
        // Afficher le panneau
        rightPanel.classList.add('show');
        
        // Afficher les résultats
        resultsWrapper.style.display = 'block';
        setTimeout(() => {
            resultsWrapper.classList.add('show');
        }, 300);
        
        // Désactiver le défilement du corps
        document.body.style.overflow = 'hidden';
    }
    
    // Fonction pour fermer le panneau latéral
    function closeRightPanel() {
        // Masquer l'overlay
        panelOverlay.classList.remove('show');
        
        // Masquer le panneau
        rightPanel.classList.remove('show');
        
        // Réactiver le défilement du corps
        document.body.style.overflow = 'auto';
    }
    
    // Écouter les clics sur le bouton de fermeture
    closeBtn.addEventListener('click', closeRightPanel);
    
    // Écouter les clics sur l'overlay
    panelOverlay.addEventListener('click', closeRightPanel);
    
    // Observer les changements dans le DOM pour détecter quand les résultats sont prêts à être affichés
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.target.id === 'results-container' && mutation.addedNodes.length > 0) {
                // Les résultats ont été ajoutés au conteneur, ouvrir le panneau
                openRightPanel();
            }
        });
    });
    
    // Observer les changements sur l'élément results-container
    const resultsContainer = document.getElementById('results-container');
    observer.observe(resultsContainer, { childList: true });
});
