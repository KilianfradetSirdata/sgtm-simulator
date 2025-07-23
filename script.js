// Script pour le simulateur GTM Server Side
// Pondération par tag
const tagImpact = {
    "Google Analytics": 4,
    "GTM Web": 4,
    "Google Ads": 5,
    "Meta Pixel": 7,
    "Matomo": 2,
    "TikTok Pixel": 5,
    "Criteo": 6,
    "LinkedIn Insight": 4,
    "Hotjar": 4,
    "Clarity": 2,
    "Consent CMP": 2
};

// Pondération par tag pour la conformité RGPD
const tagPrivacyImpact = {
    "Google Analytics": 10,
    "GTM Web": 10,
    "Google Ads": 15,
    "Meta Pixel": 25,
    "Matomo": -20,
    "TikTok Pixel": 25,
    "Criteo": 20,
    "LinkedIn Insight": 10,
    "Hotjar": 15,
    "Clarity": 15,
    "Consent CMP": -30
};

// Pondération par secteur
const sectorMultipliers = {
    "e-commerce": 1.3,
    "media": 1.2,
    "finance": 1.1,
    "travel": 1.15,
    "automotive": 1.1,
    "real-estate": 1.05,
    "other": 1.0
};

// Coefficient de réduction de base par tag (impact sur les requêtes)
const tagRequestImpact = {
    "Google Analytics": 10,
    "GTM Web": 10,
    "Google Ads": 12,
    "Meta Pixel": 12,
    "Matomo": 2,
    "TikTok Pixel": 12,
    "Criteo": 12,
    "LinkedIn Insight": 6,
    "Hotjar": 6,
    "Clarity": 4,
    "Consent CMP": 3
};

// Réducteurs par secteur (pondèrent l'impact général des tags)
const sectorRequestModifier = {
    "e-commerce": 1.2,
    "media": 1.2,
    "finance": 0.9,
    "travel": 1.1,
    "automotive": 1.0,
    "real-estate": 0.9,
    "other": 1.0
};

// Pondération par secteur pour la conformité RGPD
const sectorPrivacyImpact = {
    "e-commerce": 20,
    "media": 20,
    "finance": 25,
    "travel": 15,
    "automotive": 10,
    "real-estate": 10,
    "other": 5
};

// Pondération par secteur pour le gain de temps de chargement
const loadTimeImprovementBySector = {
    "e-commerce": 0.40,  // Fort usage de tags marketing (Meta, Ads, GA...)
    "media": 0.40,      // Très lourd en pub, tracking, scripts tiers
    "finance": 0.20,    // Moins de marketing, plus de first-party, forte contrainte RGPD
    "travel": 0.30,     // Tracking + moteur de réservation, souvent lourd
    "automotive": 0.30,  // Forte présence de scripts mais moins que e-commerce
    "real-estate": 0.20, // Usage intermédiaire, tracking modéré
    "other": 0.20       // Valeur par défaut pour les autres secteurs
};

// Pondération par volume de hits
const hitVolumeMultipliers = {
    "less-than-10k": 1.0,
    "10k-50k": 1.1,
    "50k-100k": 1.25,
    "100k-500k": 1.4,
    "more-than-1m": 1.6
};

// Fonction pour obtenir les métriques de base selon le secteur d'activité
function getBaseMetricsBySector(sector) {
    const metrics = {
        'e-commerce':      { data: 65, conv: 70 },
        'media':           { data: 50, conv: 60 },
        'finance':         { data: 60, conv: 65 },
        'travel':          { data: 60, conv: 68 },
        'automotive':      { data: 55, conv: 62 },
        'real-estate':     { data: 50, conv: 58 },
        'other':           { data: 60, conv: 65 }
    };
    return metrics[sector] || metrics['other'];
}

// Fonction pour obtenir le ROAS de base selon le secteur d'activité
function getBaseROASBySector(sector) {
    const roasMap = {
        'e-commerce': 4.0,
        'media': 2.5,
        'finance': 3.2,
        'travel': 3.8,
        'automotive': 2.7,
        'real-estate': 2.4,
        'other': 3.0
    };
    return roasMap[sector] || 3.0;
}

document.addEventListener('DOMContentLoaded', function() {
    const analyzerForm = document.getElementById('analyzer-form');
    const submitButton = document.querySelector('button[type="submit"]');
    const sgtmLogoContainer = document.querySelector('.sgtm-logo-container');
    
    // Masquer les résultats par défaut
    const resultsWrapper = document.getElementById('results-wrapper');
    resultsWrapper.style.display = 'none';
    
    // Récupérer le conteneur de résultats existant
    const resultsContainer = document.getElementById('results-container');
    
    // Ajouter un message d'erreur pour les tags
    const tagsContainer = document.querySelector('.tags-container');
    let tagsErrorMessage = document.getElementById('tags-error-message');
    
    if (!tagsErrorMessage) {
        tagsErrorMessage = document.createElement('div');
        tagsErrorMessage.id = 'tags-error-message';
        tagsErrorMessage.className = 'text-danger mt-2';
        tagsErrorMessage.style.display = 'none';
        tagsErrorMessage.textContent = 'Veuillez sélectionner au moins un tag';
        tagsContainer.appendChild(tagsErrorMessage);
    }
    
    analyzerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Récupération des valeurs du formulaire
        const siteUrl = document.getElementById('site-url').value;
        const businessSector = document.getElementById('business-sector').value;
        const hitCount = document.getElementById('hit-count').value;
        
        // Récupérer les tags sélectionnés
        const selectedTags = [];
        document.querySelectorAll('input[name="selectedTags"]:checked').forEach(checkbox => {
            selectedTags.push(checkbox.value);
        });
        
        // Vérifier qu'au moins un tag est sélectionné
        if (selectedTags.length === 0) {
            tagsErrorMessage.style.display = 'block';
            return; // Arrêter la soumission du formulaire
        } else {
            tagsErrorMessage.style.display = 'none';
        }
        
        // Afficher un indicateur de chargement
        showLoading();
        
        // Appeler l'API d'analyse
        fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: siteUrl,
                sector: businessSector,
                hitCount: hitCount,
                selectedTags: selectedTags
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors de l\'analyse du site');
            }
            return response.json();
        })
        .then(data => {
            // Masquer l'indicateur de chargement
            hideLoading();
            
            // Afficher les résultats
            displayResults(data);
        })
        .catch(error => {
            // Masquer l'indicateur de chargement
            hideLoading();
            
            // Afficher l'erreur
            showError(error.message);
        });
    });
    
    // Fonction pour afficher l'indicateur de chargement
    function showLoading() {
        // Mettre le bouton en état de chargement
        submitButton.classList.add('btn-loading');
        submitButton.disabled = true;
        
        // Garder l'image visible pendant le chargement
        sgtmLogoContainer.classList.remove('hide');
        
        // Masquer la carte de résultats pendant le chargement
        const resultsWrapper = document.getElementById('results-wrapper');
        resultsWrapper.classList.remove('show');
        resultsWrapper.style.display = 'none';
        
        resultsContainer.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="mt-2">Analyse en cours, veuillez patienter...</p>
            </div>
        `;
    }
    
    // Fonction pour masquer l'indicateur de chargement
    function hideLoading() {
        // Rétablir le bouton à son état normal
        submitButton.classList.remove('btn-loading');
        submitButton.disabled = false;
    }
    
    // Fonction pour afficher une erreur
    function showError(message) {
        // Rétablir le bouton à son état normal
        hideLoading();
        
        // Faire disparaitre l'image en fondu
        sgtmLogoContainer.classList.add('hide');
        
        const resultsWrapper = document.getElementById('results-wrapper');
        
        resultsContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">Erreur!</h4>
                <p>${message}</p>
                <hr>
                <p class="mb-0">Veuillez vérifier l'URL et réessayer.</p>
            </div>
        `;
        
        // Ajouter un délai pour l'animation de fondu
        resultsWrapper.style.display = 'block';
        setTimeout(() => {
            resultsWrapper.classList.add('show');
        }, 500);
    }
    
    // Fonction pour afficher les résultats
    function displayResults(data) {
        // Rétablir le bouton à son état normal
        hideLoading();
        
        // Faire disparaitre l'image en fondu
        sgtmLogoContainer.classList.add('hide');
        
        // Référence au wrapper pour l'animation
        const resultsWrapper = document.getElementById('results-wrapper');
        // Calculer les économies potentielles avec GTM Server Side
        const totalSize = data.stats.totalSize;
        const thirdPartyCount = data.stats.resourcesByDomain.thirdParty;
        
        // Récupérer les valeurs du formulaire pour les métriques business
        const selectedSector = document.getElementById('business-sector').value;
        const selectedHitRange = document.getElementById('hit-count').value;
        
        // Récupérer les tags sélectionnés pour le calcul du temps de chargement
        const selectedTagsForLoadTime = [];
        document.querySelectorAll('input[name="selectedTags"]:checked').forEach(checkbox => {
            selectedTagsForLoadTime.push(checkbox.value);
        });
        
        // Calcul direct basé sur les tags sélectionnés pour le temps de chargement
        let tagLoadTimeImpact = 0;
        
        if (selectedTagsForLoadTime.length > 0) {
            // Somme directe des impacts de tous les tags sélectionnés
            tagLoadTimeImpact = selectedTagsForLoadTime.reduce((sum, tag) => sum + (tagRequestImpact[tag] || 0), 0);
        } else {
            // Valeur par défaut si aucun tag n'est sélectionné
            tagLoadTimeImpact = 5;
        }
        
        // Facteur de base selon le secteur
        const baseSectorLoadTimeFactor = loadTimeImprovementBySector[selectedSector] || loadTimeImprovementBySector['other'];
        
        // Calcul du facteur d'amélioration du temps de chargement
        // Formule: facteur de base + (0.3% par point d'impact de tag)
        const tagBasedLoadTimeFactor = (tagLoadTimeImpact * 0.003);
        const combinedLoadTimeFactor = Math.min(baseSectorLoadTimeFactor + tagBasedLoadTimeFactor, 0.75);
        
        // Estimer les économies
        const sizeReduction = Math.round(totalSize * 0.3); // 30% de réduction estimée
        const loadTimeReduction = data.stats.loadTime * combinedLoadTimeFactor;
        const estimatedLoadTime = Math.max(data.stats.loadTime - loadTimeReduction, data.stats.loadTime * 0.3).toFixed(2); // Minimum 30% du temps original
        
        // Calcul du gain sur le nombre de requêtes scripts basé sur les données du site, les tags et le secteur
        const baseRequests = data.stats.totalRequests || 100; // Nombre de requêtes de base ou valeur par défaut
        
        // Déterminer le ratio de requêtes tierces
        let thirdPartyRatio = 0.5; // Valeur par défaut si les données ne sont pas disponibles
        
        if (data.stats.resourcesByDomain && data.stats.totalRequests > 0) {
            thirdPartyRatio = Math.min(data.stats.resourcesByDomain.thirdParty / data.stats.totalRequests, 0.8);
        }
        
        // Récupérer les tags sélectionnés pour le calcul des requêtes
        const selectedTagsForRequests = [];
        document.querySelectorAll('input[name="selectedTags"]:checked').forEach(checkbox => {
            selectedTagsForRequests.push(checkbox.value);
        });
        
        // Valeurs de référence pour le calcul
        const baseReductionRate = 0.15; // 15% de réduction minimale
        const maxReductionRate = 0.65; // 65% de réduction maximale
        
        // Calcul direct basé sur les tags sélectionnés
        let tagImpactTotal = 0;
        
        if (selectedTagsForRequests.length > 0) {
            // Somme directe des impacts de tous les tags sélectionnés
            tagImpactTotal = selectedTagsForRequests.reduce((sum, tag) => sum + (tagRequestImpact[tag] || 0), 0);
        } else {
            // Valeur par défaut si aucun tag n'est sélectionné (impact équivalent à un petit tag)
            tagImpactTotal = 5;
        }
        
        // Facteur de réduction basé sur le secteur (directement depuis sectorRequestModifier)
        const sectorModifier = sectorRequestModifier[selectedSector] || 1.0;
        
        // Calcul du coefficient de réduction
        // Formule: 0.5% de réduction par point d'impact de tag, multiplié par le modificateur sectoriel
        const tagBasedReduction = (tagImpactTotal * 0.005) * sectorModifier;
        
        // Ajout du facteur de requêtes tierces
        const thirdPartyContribution = thirdPartyRatio * 0.15; // Max 15% de contribution
        
        // Calcul du taux final avec limites min/max
        const adjustedReductionRate = Math.min(
            Math.max(baseReductionRate + tagBasedReduction + thirdPartyContribution, baseReductionRate),
            maxReductionRate
        );
        
        // Calcul des requêtes optimisées et du gain
        const optimizedRequests = Math.round(baseRequests * (1 - adjustedReductionRate));
        const requestsSaved = baseRequests - optimizedRequests;
        const requestGainPercent = Math.round((requestsSaved / baseRequests) * 100);
        
        // Récupérer les tags sélectionnés
        const selectedTags = [];
        document.querySelectorAll('input[name="selectedTags"]:checked').forEach(checkbox => {
            selectedTags.push(checkbox.value);
        });
        
        // Calcul du gain global pondéré
        const baseGain = selectedTags.reduce((sum, tag) => sum + (tagImpact[tag] || 0), 0);
        const sectorFactor = sectorMultipliers[selectedSector] || 1.0;
        const hitFactor = hitVolumeMultipliers[selectedHitRange] || 1.0;
        
        const gainFinal = Math.round(baseGain * sectorFactor * hitFactor); // en %
        
        // Obtenir les métriques de base selon le secteur
        const { data: baseDataCollection, conv: baseConversionRate } = getBaseMetricsBySector(selectedSector);
        
        // Calcul des indicateurs business
        // Collecte de données
        const estimatedDataCollection = Math.min(baseDataCollection + gainFinal, 95);
        
        // Conversions mesurées
        const conversionGain = Math.round(gainFinal * 0.3);
        const estimatedConversions = Math.min(baseConversionRate + conversionGain, 95);
        
        // ROAS estimé
        const baseROAS = getBaseROASBySector(selectedSector);
        const roasGainFactor = 1 + (gainFinal * 0.2) / 100;
        const estimatedROAS = +(baseROAS * roasGainFactor).toFixed(2);
        
        // Calcul des métriques de conformité RGPD
        // Score par tag sélectionné
        const tagPrivacyScore = selectedTags.reduce((sum, tag) => sum + (tagPrivacyImpact[tag] || 0), 0);
        // Score par secteur
        const sectorPrivacyScore = sectorPrivacyImpact[selectedSector] || sectorPrivacyImpact['other'];
        // Score total RGPD
        const totalPrivacyScore = tagPrivacyScore + sectorPrivacyScore;
        // Gain estimé en conformité RGPD (capé à 80%)
        const estimatedPrivacyGain = Math.min(totalPrivacyScore, 80);
        // Réduction du trafic non conforme RGPD
        const nonCompliantTrafficReduction = Math.round(estimatedPrivacyGain * 0.9);
        
        // La section des ressources détectées a été supprimée
        
        // Afficher les résultats complets
        resultsContainer.innerHTML = `
            <div>
                <div class="rounded-top">
                    <h2>Résultats de l'analyse</h2>
                </div>
                <div class="results-container">
                    <div class="card shadow my-4">
                        <div class="card-header bg-primary text-white">
                            <h3><i class="fas fa-tachometer-alt"></i> Performance</h3>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body text-center">
                                            <h4>Temps de chargement</h4>
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <span>Actuel :</span>
                                                <span class="fw-bold">${data.stats.loadTime.toFixed(2)} s</span>
                                            </div>
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span>Avec sGTM :</span>
                                                <span class="fw-bold text-success">${estimatedLoadTime} s</span>
                                            </div>
                                            <div class="mt-3">
                                                <span class="badge bg-success p-2">Gain : -${Math.round(combinedLoadTimeFactor * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body text-center">
                                            <h4>Nombre requêtes scripts</h4>
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <span>Actuel :</span>
                                                <span class="fw-bold">${baseRequests}</span>
                                            </div>
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span>Avec sGTM :</span>
                                                <span class="fw-bold text-success">${optimizedRequests}</span>
                                            </div>
                                            <div class="mt-3">
                                                <span class="badge bg-success p-2">Gain : -${requestGainPercent}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body text-center">
                                            <h4>Poids total des scripts</h4>
                                            <h2>${formatBytes(data.stats.jsSize)}</h2>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card shadow my-4">
                        <div class="card-header bg-success text-white">
                            <h3><i class="fas fa-chart-line"></i> Gain business</h3>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body">
                                            <h4 class="text-center">Collecte de données</h4>
                                            <div class="mt-4">
                                                <div class="position-relative mb-1">
                                                    <div style="width: ${estimatedDataCollection}%" class="d-flex justify-content-end">
                                                        <span>${estimatedDataCollection}%</span>
                                                    </div>
                                                </div>
                                                <div class="progress mb-3" style="height: 25px;">
                                                    <div class="progress-bar" role="progressbar" style="width: ${baseDataCollection}%" aria-valuenow="${baseDataCollection}" aria-valuemin="0" aria-valuemax="100"></div>
                                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${Math.min(gainFinal, 95 - baseDataCollection)}%" aria-valuenow="${Math.min(gainFinal, 95 - baseDataCollection)}" aria-valuemin="0" aria-valuemax="100"></div>
                                                </div>
                                                
                                                <div class="text-center mt-3">
                                                    <span class="badge bg-success p-2">Gain : +${Math.min(gainFinal, 95 - baseDataCollection)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body">
                                            <h4 class="text-center">Conversions mesurées</h4>
                                            <div class="mt-4">
                                                <div class="position-relative mb-1">
                                                    <div style="width: ${estimatedConversions}%" class="d-flex justify-content-end">
                                                        <span>${estimatedConversions}%</span>
                                                    </div>
                                                </div>
                                                <div class="progress mb-3" style="height: 25px;">
                                                    <div class="progress-bar" role="progressbar" style="width: ${baseConversionRate}%" aria-valuenow="${baseConversionRate}" aria-valuemin="0" aria-valuemax="100"></div>
                                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${Math.min(conversionGain, 95 - baseConversionRate)}%" aria-valuenow="${Math.min(conversionGain, 95 - baseConversionRate)}" aria-valuemin="0" aria-valuemax="100"></div>
                                                </div>
                                                
                                                <div class="text-center mt-3">
                                                    <span class="badge bg-success p-2">Gain : +${Math.min(conversionGain, 95 - baseConversionRate)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="card bg-light h-100">
                                        <div class="card-body">
                                            <h4 class="text-center">ROAS estimé</h4>
                                            <div class="mt-4">
                                                <div class="position-relative mb-1">
                                                    <div style="width: ${Math.min((baseROAS * 10) + Math.min((estimatedROAS - baseROAS) * 10, 100), 100)}%" class="d-flex justify-content-end">
                                                        <span>${estimatedROAS}</span>
                                                    </div>
                                                </div>
                                                <div class="progress mb-3" style="height: 25px;">
                                                    <div class="progress-bar" role="progressbar" style="width: ${Math.min(baseROAS * 10, 100)}%" aria-valuenow="${baseROAS}" aria-valuemin="0" aria-valuemax="10"></div>
                                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${Math.min((estimatedROAS - baseROAS) * 10, 100)}%" aria-valuenow="${estimatedROAS - baseROAS}" aria-valuemin="0" aria-valuemax="10"></div>
                                                </div>
                                                
                                                <div class="text-center mt-3">
                                                    <span class="badge bg-success p-2">Gain : +${((roasGainFactor - 1) * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card shadow my-4">
                        <div class="card-header bg-warning text-dark">
                            <h3><i class="fas fa-lock"></i> Conformité & Privacy</h3>
                        </div>
                        <div class="card-body">
                            <ul class="list-group">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Réduction des cookies tiers
                                    <span class="badge bg-success rounded-pill">–55 à –75%</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Tags à risque RGPD réduits
                                    <span class="badge bg-danger rounded-pill">–${estimatedPrivacyGain}%</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Trafic non conforme RGPD réduit
                                    <span class="badge bg-success rounded-pill">–${nonCompliantTrafficReduction}%</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="card shadow my-4">
                        <div class="card-header bg-info text-white">
                            <h3><i class="fas fa-shield-alt"></i> Fiabilité & Contrôle</h3>
                        </div>
                        <div class="card-body">
                            <ul class="list-group">
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1"><strong>🚫 Résilience aux Adblockers</strong></h6>
                                    </div>
                                    <p class="mb-1">Les données essentielles continuent à remonter même en cas de bloqueurs (AdBlock, uBlock, Brave, etc.).</p>
                                </li>
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1"><strong>🧰 Flexibilité technique</strong></h6>
                                    </div>
                                    <p class="mb-1">Intégration de middlewares, logique métier, ou filtrage sur les événements en entrée.</p>
                                </li>
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1"><strong>🧠 Enrichissement des données</strong></h6>
                                    </div>
                                    <p class="mb-1">Ajout d'éléments CRM, hashing, scoring client ou ID login dans les événements envoyés aux plateformes.</p>
                                </li>
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1"><strong>🔐 Surcouche de sécurité</strong></h6>
                                    </div>
                                    <p class="mb-1">Traitement des données côté serveur uniquement, avec isolation, validation, et auditabilité complète.</p>
                                </li>
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1"><strong>🇪🇺 Hébergement 100% Européen</strong></h6>
                                    </div>
                                    <p class="mb-1">Les serveurs sont basés dans l'UE, aucune donnée ne transite vers des infrastructures américaines (RGPD compliant).</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Ajouter un délai pour l'animation de fondu
        resultsWrapper.style.display = 'block';
        setTimeout(() => {
            resultsWrapper.classList.add('show');
        }, 500);
    }
    
    // Fonction pour formater les octets en format lisible
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        if (!bytes) return 'N/A';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
