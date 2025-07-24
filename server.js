const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { performance } = require('perf_hooks');

const app = express();
const PORT = process.env.PORT || 3050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Fonction pour déterminer si un domaine est first-party ou third-party
function isDomainFirstParty(resourceDomain, siteDomain) {
  // Extraire le domaine de base (sans sous-domaines)
  const getBaseDomain = (domain) => {
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  };

  const resourceBaseDomain = getBaseDomain(resourceDomain);
  const siteBaseDomain = getBaseDomain(siteDomain);

  return resourceBaseDomain === siteBaseDomain;
}

// Fonction pour estimer la taille d'une ressource
async function estimateResourceSize(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Si content-length n'est pas disponible, utiliser une estimation basée sur le type de contenu
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('javascript')) return 15000; // ~15KB pour les scripts
    if (contentType.includes('css')) return 8000; // ~8KB pour les CSS
    if (contentType.includes('image')) return 50000; // ~50KB pour les images
    if (contentType.includes('html')) return 30000; // ~30KB pour le HTML
    
    return 10000; // Valeur par défaut ~10KB
  } catch (error) {
    console.error(`Erreur lors de l'estimation de la taille pour ${url}:`, error.message);
    return 5000; // Valeur par défaut en cas d'erreur
  }
}

// Fonction pour déterminer le type de ressource
function getResourceType(url, contentType = '') {
  const extension = url.split('.').pop().toLowerCase();
  
  if (contentType) {
    if (contentType.includes('javascript')) return 'script';
    if (contentType.includes('css')) return 'style';
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('font')) return 'font';
    if (contentType.includes('json') || contentType.includes('xml')) return 'xhr';
  }
  
  // Déterminer par l'extension si le content-type n'est pas disponible
  if (['js'].includes(extension)) return 'script';
  if (['css'].includes(extension)) return 'style';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) return 'image';
  if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(extension)) return 'font';
  if (['json', 'xml'].includes(extension)) return 'xhr';
  
  // Déterminer par l'URL
  if (url.includes('google-analytics.com')) return 'analytics';
  if (url.includes('facebook.com') || url.includes('fbcdn.net')) return 'tracker';
  if (url.includes('doubleclick.net') || url.includes('googlesyndication')) return 'ads';
  
  return 'other';
}

// Fonction pour récupérer le contenu d'un site avec gestion avancée des redirections
async function fetchSiteContent(siteUrl) {
  const strategies = [
    // Stratégie 1: Augmenter le nombre de redirections autorisées
    {
      name: 'high_redirects',
      config: {
        timeout: 15000,
        maxRedirects: 20,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      }
    },
    // Stratégie 2: Essayer avec www. si pas déjà présent
    {
      name: 'with_www',
      config: {
        timeout: 10000,
        maxRedirects: 10,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      }
    },
    // Stratégie 3: Essayer en HTTP si HTTPS échoue
    {
      name: 'http_fallback',
      config: {
        timeout: 10000,
        maxRedirects: 15,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    }
  ];

  let lastError = null;

  for (const strategy of strategies) {
    try {
      let urlToTry = siteUrl;
      
      // Modifier l'URL selon la stratégie
      if (strategy.name === 'with_www' && !siteUrl.includes('www.')) {
        urlToTry = siteUrl.replace('://', '://www.');
      } else if (strategy.name === 'http_fallback' && siteUrl.startsWith('https://')) {
        urlToTry = siteUrl.replace('https://', 'http://');
      }

      console.log(`Tentative avec stratégie ${strategy.name}: ${urlToTry}`);
      
      const response = await axios.get(urlToTry, strategy.config);
      console.log(`Succès avec stratégie ${strategy.name}`);
      
      return {
        data: response.data,
        finalUrl: response.request.res.responseUrl || urlToTry,
        strategy: strategy.name
      };
      
    } catch (error) {
      console.log(`Échec avec stratégie ${strategy.name}: ${error.message}`);
      lastError = error;
      continue;
    }
  }

  // Si toutes les stratégies échouent, lancer la dernière erreur
  throw lastError;
}

// Endpoint pour analyser un site web
app.post('/api/analyze', async (req, res) => {
  const { url, sector } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL requise' });
  }
  
  try {
    const startTime = performance.now();
    
    // Normaliser l'URL
    let siteUrl = url;
    if (!siteUrl.startsWith('http')) {
      siteUrl = 'https://' + siteUrl;
    }
    
    // Extraire le domaine du site
    const siteDomain = new URL(siteUrl).hostname;
    
    // Récupérer le HTML du site avec gestion avancée des redirections
    const siteContent = await fetchSiteContent(siteUrl);
    const html = siteContent.data;
    const finalUrl = siteContent.finalUrl;
    const strategy = siteContent.strategy;
    
    console.log(`Site analysé avec succès (stratégie: ${strategy}, URL finale: ${finalUrl})`);
    
    const $ = cheerio.load(html);
    
    // Utiliser l'URL finale pour les calculs de domaine
    const finalSiteDomain = new URL(finalUrl).hostname;
    
    // Collecter les ressources
    const resources = [];
    
    // Analyser les balises script
    $('script').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          // Construire l'URL complète si nécessaire
          let fullUrl = src;
          if (src.startsWith('//')) {
            fullUrl = 'https:' + src;
          } else if (!src.startsWith('http')) {
            fullUrl = new URL(src, finalUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'script',
            domain: isDomainFirstParty(resourceDomain, finalSiteDomain) ? '1st party' : '3rd party',
            domainName: resourceDomain,
            size: null, // Sera estimé plus tard
            loadTime: null
          });
        } catch (error) {
          console.error(`Erreur lors de l'analyse de l'URL du script: ${src}`, error.message);
        }
      }
    });
    
    // Analyser les balises link (CSS, etc.)
    $('link[rel="stylesheet"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          let fullUrl = href;
          if (href.startsWith('//')) {
            fullUrl = 'https:' + href;
          } else if (!href.startsWith('http')) {
            fullUrl = new URL(href, finalUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'style',
            domain: isDomainFirstParty(resourceDomain, finalSiteDomain) ? '1st party' : '3rd party',
            domainName: resourceDomain,
            size: null,
            loadTime: null
          });
        } catch (error) {
          console.error(`Erreur lors de l'analyse de l'URL du CSS: ${href}`, error.message);
        }
      }
    });
    
    // Analyser les balises img
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          let fullUrl = src;
          if (src.startsWith('//')) {
            fullUrl = 'https:' + src;
          } else if (!src.startsWith('http')) {
            fullUrl = new URL(src, finalUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'image',
            domain: isDomainFirstParty(resourceDomain, finalSiteDomain) ? '1st party' : '3rd party',
            domainName: resourceDomain,
            size: null,
            loadTime: null
          });
        } catch (error) {
          console.error(`Erreur lors de l'analyse de l'URL de l'image: ${src}`, error.message);
        }
      }
    });
    
    // Stocker le nombre total de ressources détectées
    const totalNetworkRequests = resources.length;
    
    // Limiter le nombre de ressources pour éviter les timeouts lors de l'estimation des tailles
    const limitedResources = resources.slice(0, 30);
    
    // Estimer la taille des ressources
    const resourcePromises = limitedResources.map(async (resource) => {
      try {
        const size = await estimateResourceSize(resource.url);
        resource.size = size;
        return resource;
      } catch (error) {
        console.error(`Erreur lors de l'estimation de la taille pour ${resource.url}:`, error.message);
        resource.size = 5000; // Valeur par défaut en cas d'erreur
        return resource;
      }
    });
    
    // Attendre que toutes les estimations de taille soient terminées
    const completedResources = await Promise.all(resourcePromises);
    
    // Calculer le temps total
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Préparer les statistiques
    const stats = {
      totalSize: completedResources.reduce((sum, r) => sum + (r.size || 0), 0),
      resourcesByType: {},
      resourcesByDomain: {
        firstParty: completedResources.filter(r => r.domain === '1st party').length,
        thirdParty: completedResources.filter(r => r.domain === '3rd party').length
      },
      processingTime: totalTime,
      // Nouvelles métriques de performance
      loadTime: totalTime / 1000, // Temps de chargement en secondes
      totalRequests: totalNetworkRequests, // Nombre réel de requêtes réseau détectées
      jsSize: completedResources
        .filter(r => r.type === 'script')
        .reduce((sum, r) => sum + (r.size || 0), 0) // Poids total des scripts JS
    };
    
    // Compter les ressources par type
    completedResources.forEach(r => {
      if (!stats.resourcesByType[r.type]) {
        stats.resourcesByType[r.type] = 0;
      }
      stats.resourcesByType[r.type]++;
    });
    
    // Note: La détection des tags a été supprimée
    
    // Renvoyer les résultats
    res.json({
      url: finalUrl,
      resources: completedResources,
      stats,
      analysisTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse du site:', error.message);
    
    // Déterminer le type d'erreur et renvoyer une réponse appropriée
    let errorType = 'unknown';
    let userMessage = 'Impossible d\'analyser ce site';
    
    if (error.message.includes('Maximum number of redirects')) {
      errorType = 'too_many_redirects';
      userMessage = 'Ce site a trop de redirections et ne peut pas être analysé';
    } else if (error.message.includes('timeout')) {
      errorType = 'timeout';
      userMessage = 'Le site met trop de temps à répondre';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      errorType = 'connection_error';
      userMessage = 'Impossible de se connecter à ce site';
    } else if (error.response && error.response.status >= 400) {
      errorType = 'http_error';
      userMessage = `Le site a renvoyé une erreur HTTP ${error.response.status}`;
    }
    
    // Renvoyer une réponse avec un code 200 mais indiquant l'échec de l'analyse
    res.json({ 
      success: false,
      error: errorType,
      message: userMessage,
      url: req.body.url,
      analysisTime: new Date().toISOString()
    });
  }
});

// Route par défaut pour servir l'application frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
