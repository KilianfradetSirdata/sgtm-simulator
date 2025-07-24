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
            
            // Vérifier si l'analyse a réussi
            if (data.success === false) {
                // Afficher l'erreur spécifique
                showError(data.message || 'Erreur lors de l\'analyse du site');
                return;
            }
            
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
        
        // Préparer le conteneur de résultats pour l'affichage du chargement
        const resultsWrapper = document.getElementById('results-wrapper');
        resultsWrapper.classList.remove('show');
        resultsWrapper.style.display = 'block';
        
        // Afficher l'indicateur de chargement dans le conteneur de résultats
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
        
        // Préparer le message d'erreur
        resultsContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">Erreur!</h4>
                <p>${message}</p>
                <hr>
                <p class="mb-0">Veuillez vérifier l'URL et réessayer.</p>
            </div>
        `;
        
        // Le panneau latéral s'ouvrira automatiquement grâce à l'observateur dans right-panel.js
        // qui détecte les changements dans le contenu du resultsContainer
    }
    
    // Fonction pour afficher les résultats
    function displayResults(data) {
        // Rétablir le bouton à son état normal
        hideLoading();
        
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
                    <h2>Résultats de l'analyse <span style="font-style: italic; font-size: 0.4em; color: #64b5f6; cursor: pointer; text-decoration: none; margin-left: 15px;" onclick="showCalculationRules()" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Voir les règles de calcul</span></h2>
                </div>
                <div class="results-container">
                    <div class="performance-section">
                        <div class="section-header-performance">
                            <i class="fas fa-tachometer-alt section-icon-performance"></i>
                            <h2 class="section-title-performance">Performance</h2>
                        </div>
                        <div class="performance-cards-container">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <div class="performance-card">
                                        <i class="fas fa-tachometer-alt performance-icon"></i>
                                        <h3 class="performance-title">Temps de chargement</h3>
                                        <div class="metric-comparison">
                                            <div class="metric-current-section">
                                                <div class="metric-label-modern">Actuel</div>
                                                <div class="metric-value-current">${data.stats.loadTime.toFixed(2)} <span class="metric-unit">s</span></div>
                                            </div>
                                            <div class="vs-separator">
                                                <div class="vs-text">VS</div>
                                                <div class="vs-line"></div>
                                            </div>
                                            <div class="metric-improved-section">
                                                <div class="metric-label-modern">Avec sGTM</div>
                                                <div class="metric-value-improved">${estimatedLoadTime} <span class="metric-unit">s</span></div>
                                            </div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-enhanced">Gain : -${Math.round(combinedLoadTimeFactor * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <div class="performance-card">
                                        <i class="fas fa-code performance-icon"></i>
                                        <h3 class="performance-title">Nombre requêtes scripts</h3>
                                        <div class="metric-comparison">
                                            <div class="metric-current-section">
                                                <div class="metric-label-modern">Actuel</div>
                                                <div class="metric-value-current">${baseRequests}</div>
                                            </div>
                                            <div class="vs-separator">
                                                <div class="vs-text">VS</div>
                                                <div class="vs-line"></div>
                                            </div>
                                            <div class="metric-improved-section">
                                                <div class="metric-label-modern">Avec sGTM</div>
                                                <div class="metric-value-improved">${optimizedRequests}</div>
                                            </div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-enhanced">Gain : -${requestGainPercent}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <div class="performance-card">
                                        <i class="fas fa-weight-hanging performance-icon"></i>
                                        <h3 class="performance-title">Poids total des scripts</h3>
                                        <div class="metric-comparison">
                                            <div class="metric-current-section">
                                                <div class="metric-label-modern">Actuel</div>
                                                <div class="metric-value-current">${formatBytes(data.stats.jsSize)}</div>
                                            </div>
                                            <div class="vs-separator">
                                                <div class="vs-text">VS</div>
                                                <div class="vs-line"></div>
                                            </div>
                                            <div class="metric-improved-section">
                                                <div class="metric-label-modern">Avec sGTM</div>
                                                <div class="metric-value-improved">${formatBytes(Math.round(data.stats.jsSize * (optimizedRequests / baseRequests)))}</div>
                                            </div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-enhanced">Gain : -${requestGainPercent}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="business-section">
                        <div class="section-header-business">
                            <i class="fas fa-chart-line section-icon-business"></i>
                            <h2 class="section-title-business">Gain business</h2>
                        </div>
                        <div class="business-cards-container">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <div class="business-card">
                                        <i class="fas fa-database business-icon"></i>
                                        <h3 class="business-title">Collecte de données</h3>
                                        <div class="metric-display">
                                            <div class="metric-section">
                                                <div class="metric-label-business">Actuel</div>
                                                <div class="current-value">${baseDataCollection}<span class="unit">%</span></div>
                                            </div>
                                            <div class="metric-section">
                                                <div class="metric-label-business">Avec sGTM</div>
                                                <div class="improved-value">${estimatedDataCollection}<span class="unit">%</span></div>
                                            </div>
                                        </div>
                                        <div class="progress-modern mb-3">
                                            <div class="progress-bar-base" style="width: ${baseDataCollection}%"></div>
                                            <div class="progress-bar-gain" style="width: ${Math.min(gainFinal, 95 - baseDataCollection)}%; margin-left: ${baseDataCollection}%"></div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-business">Gain : +${Math.min(gainFinal, 95 - baseDataCollection)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="business-card">
                                        <i class="fas fa-chart-line business-icon"></i>
                                        <h3 class="business-title">Conversions mesurées</h3>
                                        <div class="metric-display">
                                            <div class="metric-section">
                                                <div class="metric-label-business">Actuel</div>
                                                <div class="current-value">${baseConversionRate}<span class="unit">%</span></div>
                                            </div>
                                            <div class="metric-section">
                                                <div class="metric-label-business">Avec sGTM</div>
                                                <div class="improved-value">${estimatedConversions}<span class="unit">%</span></div>
                                            </div>
                                        </div>
                                        <div class="progress-modern mb-3">
                                            <div class="progress-bar-base" style="width: ${baseConversionRate}%"></div>
                                            <div class="progress-bar-gain" style="width: ${Math.min(conversionGain, 95 - baseConversionRate)}%; margin-left: ${baseConversionRate}%"></div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-business">Gain : +${Math.min(conversionGain, 95 - baseConversionRate)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="business-card">
                                        <i class="fas fa-dollar-sign business-icon"></i>
                                        <h3 class="business-title">ROAS estimé</h3>
                                        <div class="metric-display">
                                            <div class="metric-section">
                                                <div class="metric-label-business">Actuel</div>
                                                <div class="current-value">${baseROAS.toFixed(1)}<span class="unit">x</span></div>
                                            </div>
                                            <div class="metric-section">
                                                <div class="metric-label-business">Avec sGTM</div>
                                                <div class="improved-value">${estimatedROAS}<span class="unit">x</span></div>
                                            </div>
                                        </div>
                                        <div class="progress-modern mb-3">
                                            <div class="progress-bar-base" style="width: ${Math.min(baseROAS * 10, 100)}%"></div>
                                            <div class="progress-bar-gain" style="width: ${Math.min((estimatedROAS - baseROAS) * 10, 100)}%; margin-left: ${Math.min(baseROAS * 10, 100)}%"></div>
                                        </div>
                                        <div class="text-center">
                                            <span class="gain-badge-business">Gain : +${((roasGainFactor - 1) * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="privacy-section">
                        <div class="section-header-privacy">
                            <i class="fas fa-shield-alt section-icon-privacy"></i>
                            <h2 class="section-title-privacy">Conformité & Privacy</h2>
                        </div>
                        <div class="privacy-cards-container">
                            <div class="privacy-card">
                                <i class="fas fa-cookie-bite privacy-icon"></i>
                                <h3 class="privacy-title">Cookies tiers</h3>
                                <div class="privacy-metric">
                                    <div class="privacy-value">-65<span class="privacy-unit">%</span></div>
                                    <div class="privacy-label">De réduction moyenne des cookies tiers</div>
                                </div>
                            </div>
                            <div class="privacy-card">
                                <i class="fas fa-exclamation-triangle privacy-icon"></i>
                                <h3 class="privacy-title">Tags à risque RGPD</h3>
                                <div class="privacy-metric">
                                    <div class="privacy-value">-${estimatedPrivacyGain}<span class="privacy-unit">%</span></div>
                                    <div class="privacy-label">De tags à risque</div>
                                </div>
                            </div>
                            <div class="privacy-card">
                                <i class="fas fa-user-shield privacy-icon"></i>
                                <h3 class="privacy-title">Trafic non conforme</h3>
                                <div class="privacy-metric">
                                    <div class="privacy-value">-${nonCompliantTrafficReduction}<span class="privacy-unit">%</span></div>
                                    <div class="privacy-label">De trafic non conforme</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="reliability-section">
                        <div class="section-header-reliability">
                            <i class="fas fa-cogs section-icon-reliability"></i>
                            <h2 class="section-title-reliability">Fiabilité & Contrôle</h2>
                        </div>
                        <div class="reliability-cards-container">
                            <div class="reliability-card">
                                <div class="reliability-icon-wrapper">
                                    <i class="fas fa-shield-alt reliability-icon"></i>
                                </div>
                                <h3 class="reliability-title">Résilience aux Adblockers</h3>
                                <p class="reliability-description">Les données essentielles continuent à remonter même en cas de bloqueurs (AdBlock, uBlock, Brave, etc.).</p>
                                <div class="reliability-feature-badge">Protection garantie</div>
                            </div>
                            <div class="reliability-card">
                                <div class="reliability-icon-wrapper">
                                    <i class="fas fa-tools reliability-icon"></i>
                                </div>
                                <h3 class="reliability-title">Flexibilité technique</h3>
                                <p class="reliability-description">Intégration de middlewares, logique métier, ou filtrage sur les événements en entrée.</p>
                                <div class="reliability-feature-badge">Personnalisable</div>
                            </div>
                            <div class="reliability-card">
                                <div class="reliability-icon-wrapper">
                                    <i class="fas fa-database reliability-icon"></i>
                                </div>
                                <h3 class="reliability-title">Enrichissement des données</h3>
                                <p class="reliability-description">Ajout d'éléments CRM, hashing, scoring client ou ID login dans les événements envoyés aux plateformes.</p>
                                <div class="reliability-feature-badge">Données enrichies</div>
                            </div>
                            <div class="reliability-card">
                                <div class="reliability-icon-wrapper">
                                    <i class="fas fa-lock reliability-icon"></i>
                                </div>
                                <h3 class="reliability-title">Surcouche de sécurité</h3>
                                <p class="reliability-description">Traitement des données côté serveur uniquement, avec isolation, validation, et auditabilité complète.</p>
                                <div class="reliability-feature-badge">Sécurisé</div>
                            </div>
                            <div class="reliability-card">
                                <div class="reliability-icon-wrapper">
                                    <i class="fas fa-flag reliability-icon"></i>
                                </div>
                                <h3 class="reliability-title">Hébergement 100% Européen</h3>
                                <p class="reliability-description">Les serveurs sont basés dans l'UE, aucune donnée ne transite vers des infrastructures américaines (RGPD compliant).</p>
                                <div class="reliability-feature-badge">RGPD compliant</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bouton Export Image -->
                    <div class="export-section">
                        <button id="exportImageBtn" class="export-image-btn">
                            <i class="fas fa-image"></i>
                            <span>Exporter en Image</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Ajouter un délai pour l'animation de fondu
        resultsWrapper.style.display = 'block';
        setTimeout(() => {
            resultsWrapper.classList.add('show');
            
            // Ajouter l'event listener pour le bouton Image après l'affichage
            const exportBtn = document.getElementById('exportImageBtn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => exportToImage(data));
            }
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
    
    // Fonction pour exporter les résultats en image PNG
    async function exportToImage(data) {
        const exportBtn = document.getElementById('exportImageBtn');
        const originalText = exportBtn.innerHTML;
        
        // Changer le texte du bouton pendant l'export
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Génération...</span>';
        exportBtn.disabled = true;
        
        try {
            // Créer une copie du panneau pour l'export (sans le bouton export)
            const panel = document.getElementById('right-panel');
            const clonedPanel = panel.cloneNode(true);
            
            // Supprimer le bouton export de la copie
            const exportSection = clonedPanel.querySelector('.export-section');
            if (exportSection) {
                exportSection.remove();
            }
            
            // Supprimer le bouton de fermeture
            const closeBtn = clonedPanel.querySelector('.panel-close-btn');
            if (closeBtn) {
                closeBtn.remove();
            }
            
            // Ajuster les styles pour l'export
            clonedPanel.style.position = 'relative';
            clonedPanel.style.right = 'auto';
            clonedPanel.style.width = '800px';
            clonedPanel.style.height = 'auto';
            clonedPanel.style.maxHeight = 'none';
            clonedPanel.style.overflow = 'visible';
            clonedPanel.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)';
            clonedPanel.style.padding = '2rem';
            
            // Ajouter la copie au body temporairement
            clonedPanel.style.position = 'absolute';
            clonedPanel.style.left = '-9999px';
            clonedPanel.style.top = '0';
            document.body.appendChild(clonedPanel);
            
            // Attendre que les styles soient appliqués
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Capturer avec html2canvas
            const canvas = await html2canvas(clonedPanel, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#0f172a',
                width: 800,
                height: clonedPanel.scrollHeight
            });
            
            // Supprimer la copie
            document.body.removeChild(clonedPanel);
            
            // Convertir le canvas en image et télécharger
            const imgData = canvas.toDataURL('image/png', 1.0);
            
            // Créer un lien de téléchargement
            const link = document.createElement('a');
            link.download = `Rapport_GTM_ServerSide_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.png`;
            link.href = imgData;
            
            // Déclencher le téléchargement
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error('Erreur lors de l\'export image:', error);
            alert('Erreur lors de la génération de l\'image. Veuillez réessayer.');
        } finally {
            // Restaurer le bouton
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }
    }
});

// Fonction pour afficher les règles de calcul
function showCalculationRules() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
        border-radius: 15px;
        max-width: 90vw;
        width: 800px;
        max-height: 90vh;
        overflow: hidden;
        color: white;
        box-shadow: -5px 0 15px rgba(0, 0, 0, 0.3);
        position: relative;
        display: flex;
        flex-direction: column;
    `;
    

    
    modalContent.innerHTML = `
        <!-- Header sticky -->
        <div style="
            position: sticky;
            top: 0;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            padding: 2rem 4rem 1rem 2rem;
            border-bottom: 1px solid rgba(6, 182, 212, 0.2);
            z-index: 10;
            border-radius: 15px 15px 0 0;
            position: relative;
        ">
            <h2 style="color:rgb(255, 255, 255); font-weight: 700; margin: 0; font-size: 2.2rem;">Règles de calcul du simulateur</h2>
            <button onclick="this.closest('.modal').remove()" style="
                position: absolute;
                top: 15px;
                right: 15px;
                font-size: 1.5rem;
                cursor: pointer;
                color: #ffffff;
                background: rgba(6, 182, 212, 0.1);
                border: 1px solid rgb(255, 255, 255);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            " onmouseover="this.style.color='#ffffff9e'; this.style.background='#ffffff78'; this.style.borderColor='#ffffff';" onmouseout="this.style.color='#ffffff'; this.style.background='rgba(6, 182, 212, 0.1)'; this.style.borderColor='rgb(255, 255, 255)'">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <!-- Body scrollable -->
        <div style="
            flex: 1;
            overflow-y: auto;
            padding: 1rem 2rem 2rem 2rem;
        ">
        
        <div style="line-height: 1.6; font-size: 14px;">
            <p>Le simulateur estime les gains techniques, marketing et réglementaires qu'un site pourrait obtenir en passant de Google Tag Manager Web (client-side) à GTM Server Side (sGTM).</p>
            <p>Le simulateur croise :</p>
            <p>✅ les tags utilisés par le site<br>
            🏭 le secteur d'activité<br>
            📈 le volume de trafic<br>
            🔎 les données techniques détectées (poids JS, requêtes, temps de chargement…)</p>
            <p>… avec des pondérations précises pour estimer :</p>
            <p>⚡ la performance technique<br>
            📀 les gains business<br>
            🛡️ la conformité RGPD<br>
            🔐 la fiabilité et le contrôle</p>
            
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 2rem 0;
                padding: 1.5rem;
                background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%);
                border-radius: 20px;
                border: 1px solid rgba(6, 182, 212, 0.3);
                position: relative;
                overflow: hidden;
            " class="modal-section-header-performance">
                <i class="fas fa-tachometer-alt" style="
                    color: #06b6d4;
                    font-size: 2rem;
                    margin-right: 1rem;
                    filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.4));
                "></i>
                <h2 style="
                    color: white;
                    font-size: 1.8rem;
                    font-weight: 900;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
                ">PERFORMANCE</h2>
            </div>
            <p><strong>Objectif :</strong> estimer les gains techniques avec sGTM.</p>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 1. Temps de chargement</h4>
            <p><strong>Calculé selon :</strong><br>
            • Base du secteur (poids moyen des scripts marketing)<br>
            • Impact total des tags sélectionnés</p>
            <p><strong>Formule :</strong><br>
            Gain = Base secteur + (Impact tags × 0.3%), capé à 75%</p>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(6, 182, 212, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-performance-card">
                <h5 style="color: #06b6d4; font-weight: 700; margin-bottom: 1rem;">Pondération par secteur</h5>
                <table style="width: 100%; color: white; font-size: 14px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid rgba(6, 182, 212, 0.2);">
                        <td style="padding: 8px 0; font-weight: 700; color: #06b6d4;">Secteur</td>
                        <td style="padding: 8px 0; font-weight: 700; color: #06b6d4; text-align: right;">Base (%)</td>
                    </tr>
                    <tr><td style="padding: 6px 0;">E-commerce</td><td style="padding: 6px 0; text-align: right;">40</td></tr>
                    <tr><td style="padding: 6px 0;">Media</td><td style="padding: 6px 0; text-align: right;">40</td></tr>
                    <tr><td style="padding: 6px 0;">Travel</td><td style="padding: 6px 0; text-align: right;">30</td></tr>
                    <tr><td style="padding: 6px 0;">Automotive</td><td style="padding: 6px 0; text-align: right;">30</td></tr>
                    <tr><td style="padding: 6px 0;">Finance</td><td style="padding: 6px 0; text-align: right;">20</td></tr>
                    <tr><td style="padding: 6px 0;">Real-estate</td><td style="padding: 6px 0; text-align: right;">20</td></tr>
                    <tr><td style="padding: 6px 0;">Other</td><td style="padding: 6px 0; text-align: right;">20</td></tr>
                </table>
            </div>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(6, 182, 212, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-performance-card">
                <h5 style="color: #06b6d4; margin-top: 0; font-weight: 700;">Impact des tags (Load Time)</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Tag</strong></td><td><strong>Impact</strong></td></tr>
                    <tr><td>Google Analytics</td><td>10</td></tr>
                    <tr><td>GTM Web</td><td>10</td></tr>
                    <tr><td>Google Ads</td><td>12</td></tr>
                    <tr><td>Meta Pixel</td><td>12</td></tr>
                    <tr><td>Matomo</td><td>2</td></tr>
                    <tr><td>TikTok Pixel</td><td>12</td></tr>
                    <tr><td>Criteo</td><td>12</td></tr>
                    <tr><td>LinkedIn Insight</td><td>6</td></tr>
                    <tr><td>Hotjar</td><td>6</td></tr>
                    <tr><td>Clarity</td><td>4</td></tr>
                    <tr><td>Consent CMP</td><td>3</td></tr>
                </table>
            </div>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 2. Requêtes scripts</h4>
            <p><strong>Formule :</strong><br>
            Taux de réduction = 15% + (Impact tags × 0.5%) × modif secteur + 15% × ratio tiers, capé à 65%</p>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(6, 182, 212, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-performance-card">
                <h5 style="color: #06b6d4; margin-top: 0; font-weight: 700;">Modificateur par secteur</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Secteur</strong></td><td><strong>Modif. requêtes</strong></td></tr>
                    <tr><td>E-commerce</td><td>1.2</td></tr>
                    <tr><td>Media</td><td>1.2</td></tr>
                    <tr><td>Travel</td><td>1.1</td></tr>
                    <tr><td>Automotive</td><td>1.0</td></tr>
                    <tr><td>Finance</td><td>0.9</td></tr>
                    <tr><td>Real-estate</td><td>0.9</td></tr>
                    <tr><td>Other</td><td>1.0</td></tr>
                </table>
            </div>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 3. Poids total des scripts</h4>
            <p>Estimé à -30%, réajusté selon le gain sur les requêtes.</p>
            
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 2rem 0;
                padding: 1.5rem;
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(34, 197, 94, 0.1) 100%);
                border-radius: 20px;
                border: 1px solid rgba(16, 185, 129, 0.3);
                position: relative;
                overflow: hidden;
            " class="modal-section-header-business">
                <i class="fas fa-chart-line" style="
                    color: #10b981;
                    font-size: 2rem;
                    margin-right: 1rem;
                    filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.4));
                "></i>
                <h2 style="
                    color: white;
                    font-size: 1.8rem;
                    font-weight: 900;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
                ">GAIN BUSINESS</h2>
            </div>
            <p><strong>Objectif :</strong> traduire les gains techniques en bénéfices concrets pour le marketing.</p>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 1. Gain global pondéré</h4>
            <p><strong>Formule :</strong><br>
            Gain = Σ(Impact Tags) × coef secteur × coef trafic</p>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-business-card">
                <h5 style="color: #10b981; margin-top: 0; font-weight: 700;">Impact business des tags</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Tag</strong></td><td><strong>Impact</strong></td></tr>
                    <tr><td>Google Analytics</td><td>4</td></tr>
                    <tr><td>GTM Web</td><td>4</td></tr>
                    <tr><td>Google Ads</td><td>5</td></tr>
                    <tr><td>Meta Pixel</td><td>7</td></tr>
                    <tr><td>Matomo</td><td>2</td></tr>
                    <tr><td>TikTok Pixel</td><td>5</td></tr>
                    <tr><td>Criteo</td><td>6</td></tr>
                    <tr><td>LinkedIn Insight</td><td>4</td></tr>
                    <tr><td>Hotjar</td><td>4</td></tr>
                    <tr><td>Clarity</td><td>2</td></tr>
                    <tr><td>Consent CMP</td><td>2</td></tr>
                </table>
            </div>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-business-card">
                <h5 style="color: #10b981; margin-top: 0; font-weight: 700;">Coefficient par secteur</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Secteur</strong></td><td><strong>Coef</strong></td></tr>
                    <tr><td>E-commerce</td><td>1.3</td></tr>
                    <tr><td>Media</td><td>1.2</td></tr>
                    <tr><td>Finance</td><td>1.1</td></tr>
                    <tr><td>Travel</td><td>1.15</td></tr>
                    <tr><td>Automotive</td><td>1.1</td></tr>
                    <tr><td>Real-estate</td><td>1.05</td></tr>
                    <tr><td>Other</td><td>1.0</td></tr>
                </table>
            </div>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-business-card">
                <h5 style="color: #10b981; margin-top: 0; font-weight: 700;">Coefficient par volume de hits</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Volume mensuel</strong></td><td><strong>Coef</strong></td></tr>
                    <tr><td>less-than-10k</td><td>1.0</td></tr>
                    <tr><td>10k–50k</td><td>1.1</td></tr>
                    <tr><td>50k–100k</td><td>1.25</td></tr>
                    <tr><td>100k–500k</td><td>1.4</td></tr>
                    <tr><td>more-than-1m</td><td>1.6</td></tr>
                </table>
            </div>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 2. Collecte & conversions</h4>
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-business-card">
                <h5 style="color: #10b981; margin-top: 0; font-weight: 700;">Valeurs de base par secteur</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Secteur</strong></td><td><strong>Collecte (%)</strong></td><td><strong>Conversions (%)</strong></td></tr>
                    <tr><td>E-commerce</td><td>65</td><td>70</td></tr>
                    <tr><td>Media</td><td>50</td><td>60</td></tr>
                    <tr><td>Finance</td><td>60</td><td>65</td></tr>
                    <tr><td>Travel</td><td>60</td><td>68</td></tr>
                    <tr><td>Automotive</td><td>55</td><td>62</td></tr>
                    <tr><td>Real-estate</td><td>50</td><td>58</td></tr>
                    <tr><td>Other</td><td>60</td><td>65</td></tr>
                </table>
            </div>
            <p>Conversions mesurées = +30% du gain global<br>
            Collecte des données = base + gain global (max 95%)</p>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 3. ROAS estimé</h4>
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-business-card">
                <h5 style="color: #10b981; margin-top: 0; font-weight: 700;">ROAS de base par secteur</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Secteur</strong></td><td><strong>ROAS (x)</strong></td></tr>
                    <tr><td>E-commerce</td><td>4.0</td></tr>
                    <tr><td>Media</td><td>2.5</td></tr>
                    <tr><td>Finance</td><td>3.2</td></tr>
                    <tr><td>Travel</td><td>3.8</td></tr>
                    <tr><td>Automotive</td><td>2.7</td></tr>
                    <tr><td>Real-estate</td><td>2.4</td></tr>
                    <tr><td>Other</td><td>3.0</td></tr>
                </table>
            </div>
            <p><strong>Formule :</strong><br>
            ROAS = ROAS base × (1 + 0.2% × gain global)</p>
            
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 2rem 0;
                padding: 1.5rem;
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%);
                border-radius: 20px;
                border: 1px solid rgba(245, 158, 11, 0.3);
                position: relative;
                overflow: hidden;
            " class="modal-section-header-privacy">
                <i class="fas fa-shield-alt" style="
                    color: #f59e0b;
                    font-size: 2rem;
                    margin-right: 1rem;
                    filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.4));
                "></i>
                <h2 style="
                    color: white;
                    font-size: 1.8rem;
                    font-weight: 900;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
                ">CONFORMITÉ & PRIVACY</h2>
            </div>
            <p><strong>Objectif :</strong> estimer l'amélioration RGPD apportée par le passage à sGTM.</p>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 1. Score RGPD</h4>
            <p>Total RGPD = Impact des tags + Sensibilité du secteur<br>
            Gain capé à 80%</p>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(245, 158, 11, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-privacy-card">
                <h5 style="color: #f59e0b; margin-top: 0; font-weight: 700;">Pondération RGPD par tag</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Tag</strong></td><td><strong>Score RGPD</strong></td></tr>
                    <tr><td>Google Analytics</td><td>+10</td></tr>
                    <tr><td>GTM Web</td><td>+10</td></tr>
                    <tr><td>Google Ads</td><td>+15</td></tr>
                    <tr><td>Meta Pixel</td><td>+25</td></tr>
                    <tr><td>Matomo</td><td>–20</td></tr>
                    <tr><td>TikTok Pixel</td><td>+25</td></tr>
                    <tr><td>Criteo</td><td>+20</td></tr>
                    <tr><td>LinkedIn Insight</td><td>+10</td></tr>
                    <tr><td>Hotjar</td><td>+15</td></tr>
                    <tr><td>Clarity</td><td>+15</td></tr>
                    <tr><td>Consent CMP</td><td>–30</td></tr>
                </table>
            </div>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(245, 158, 11, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-privacy-card">
                <h5 style="color: #f59e0b; margin-top: 0; font-weight: 700;">Score RGPD par secteur</h5>
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Secteur</strong></td><td><strong>Score</strong></td></tr>
                    <tr><td>E-commerce</td><td>+20</td></tr>
                    <tr><td>Media</td><td>+20</td></tr>
                    <tr><td>Finance</td><td>+25</td></tr>
                    <tr><td>Travel</td><td>+15</td></tr>
                    <tr><td>Automotive</td><td>+10</td></tr>
                    <tr><td>Real-estate</td><td>+10</td></tr>
                    <tr><td>Other</td><td>+5</td></tr>
                </table>
            </div>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 2. Réduction trafic non conforme</h4>
            <p>Trafic non conforme réduit = 90% du score RGPD final</p>
            
            <h4 style="color: #64b5f6; margin-top: 20px;">🔹 3. Réduction cookies tiers</h4>
            <p>Estimée à –65% de façon générique avec sGTM (déport serveur des appels publicitaires)</p>
            
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 2rem 0;
                padding: 1.5rem;
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%);
                border-radius: 20px;
                border: 1px solid rgba(99, 102, 241, 0.3);
                position: relative;
                overflow: hidden;
            " class="modal-section-header-reliability">
                <i class="fas fa-cogs" style="
                    color: #6366f1;
                    font-size: 2rem;
                    margin-right: 1rem;
                    filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.4));
                "></i>
                <h2 style="
                    color: white;
                    font-size: 1.8rem;
                    font-weight: 900;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
                ">FIABILITÉ & CONTRÔLE</h2>
            </div>
            <p><strong>Objectif :</strong> présenter les avantages techniques indirects du server-side</p>
            
            <div style="
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.98) 100%);
                border: 1px solid rgba(99, 102, 241, 0.4);
                border-radius: 20px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(25px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            " class="modal-reliability-card">
                <table style="width: 100%; color: white; font-size: 13px;">
                    <tr><td><strong>Fonction</strong></td><td><strong>Explication</strong></td></tr>
                    <tr><td>Résilience aux Adblockers</td><td>Les tags exécutés côté serveur ne sont pas bloqués par les extensions</td></tr>
                    <tr><td>Flexibilité technique</td><td>Possibilité d'ajouter des middlewares, logique métier, filtrage d'événements</td></tr>
                    <tr><td>Enrichissement des données</td><td>Ajout d'ID client, CRM, hashing, scoring côté serveur avant envoi plateforme</td></tr>
                    <tr><td>Surcouche de sécurité</td><td>Validation, audit, traitement isolé des données, logs serveur</td></tr>
                    <tr><td>Hébergement 100% européen</td><td>Aucune donnée vers les US → conformité RGPD renforcée</td></tr>
                </table>
            </div>
        </div>
        </div> <!-- Fermeture du body scrollable -->
        </div> <!-- Fermeture du contenu modal -->
    `;
    
    modal.className = 'modal';
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Animation d'apparition
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
    
    // Fermer la modal en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
        }
    });
    
    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}
