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
    
    // Récupérer le HTML du site
    const response = await axios.get(siteUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
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
            fullUrl = new URL(src, siteUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'script',
            domain: isDomainFirstParty(resourceDomain, siteDomain) ? '1st party' : '3rd party',
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
            fullUrl = new URL(href, siteUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'style',
            domain: isDomainFirstParty(resourceDomain, siteDomain) ? '1st party' : '3rd party',
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
            fullUrl = new URL(src, siteUrl).href;
          }
          
          const resourceDomain = new URL(fullUrl).hostname;
          
          resources.push({
            url: fullUrl,
            type: 'image',
            domain: isDomainFirstParty(resourceDomain, siteDomain) ? '1st party' : '3rd party',
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
      url: siteUrl,
      resources: completedResources,
      stats,
      analysisTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse du site:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors de l\'analyse du site', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
