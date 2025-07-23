// Script pour gérer l'affichage du logo et des résultats
document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour afficher les résultats et ajuster l'alignement
    function showResults() {
        const rightPanelContent = document.querySelector('.right-panel-content');
        const sgtmLogoContainer = document.querySelector('.sgtm-logo-container');
        const resultsWrapper = document.getElementById('results-wrapper');
        
        // Masquer le logo
        sgtmLogoContainer.classList.add('hide');
        
        // Changer l'alignement vertical du contenu
        rightPanelContent.style.justifyContent = 'flex-start';
        
        // Afficher les résultats
        resultsWrapper.style.display = 'block';
        setTimeout(() => {
            resultsWrapper.classList.add('show');
        }, 500);
    }
    
    // Observer les changements dans le DOM pour détecter quand les résultats sont affichés
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const resultsWrapper = document.getElementById('results-wrapper');
                if (resultsWrapper.style.display === 'block') {
                    // Les résultats sont en train d'être affichés
                    const rightPanelContent = document.querySelector('.right-panel-content');
                    rightPanelContent.style.justifyContent = 'flex-start';
                }
            }
        });
    });
    
    // Observer les changements sur l'élément results-wrapper
    const resultsWrapper = document.getElementById('results-wrapper');
    observer.observe(resultsWrapper, { attributes: true });
});
