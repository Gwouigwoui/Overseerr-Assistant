// Détection de l'environnement (Firefox ou Chrome)
const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
const tabs = typeof browser !== 'undefined' ? browser.tabs : chrome.tabs;

// Importation de storage.js en tenant compte de l'environnement
if (typeof browser !== 'undefined') {
  importScripts('js/storage.js');
} else {
  importScripts('js/storage.js');
}

function encodeURIComponentSafe(value) {
    return encodeURIComponent(value)
        .replace(/!/g, '%21')
        .replace(/\~/g, '%7E')
        .replace(/\*/g, '%2A')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
}

// Fonction pour exécuter les requêtes de manière compatible
function executeRequest(url, options = {}, callback) {
  fetch(url, options)
    .then(response => response.json())
    .then(json => callback(json))
    .catch(error => {
      console.error('Fetch error:', error);
      callback({ error: 'Unable to connect' });
    });
}

// Utilisation de l'API compatible pour les deux navigateurs
runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.contentScriptQuery === 'queryMedia') {
        console.log(`Querying ${request.mediaType} '${request.tmdbId}'`);
        pullStoredData(function() {
            const options = {headers: {'X-Api-Key': serverAPIKey}};
            executeRequest(
              `${origin}/api/v1/${request.mediaType}/${encodeURIComponent(request.tmdbId)}`,
              options,
              sendResponse
            );
        });
        return true;
    }

    else if (request.contentScriptQuery === 'requestMedia') {
        console.log(`Requesting media '${request.tmdbId}' of type '${request.mediaType}'`);
        pullStoredData(function() {
            const options = {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-Api-Key': serverAPIKey},
                body: JSON.stringify({mediaType: request.mediaType, mediaId: request.tmdbId, seasons: request.seasons})
            };
            executeRequest(
              `${origin}/api/v1/request`,
              options,
              sendResponse
            );
        });
        return true;
    }

    else if (request.contentScriptQuery === 'search') {
        console.log(`Searching movie '${request.title}'`);
        pullStoredData(function() {
            const options = {headers: {'X-Api-Key': serverAPIKey}};
            executeRequest(
              `${origin}/api/v1/search?query=${encodeURIComponentSafe(request.title)}`,
              options,
              sendResponse
            );
        });
        return true;
    }

    else if (request.contentScriptQuery === 'plexQueryMedia') {
        let mediaKey = encodeURIComponentSafe(request.mediaKey);
        let plexToken = encodeURIComponentSafe(request.plexToken);
        console.log(`Requesting Plex media '${mediaKey}'`);
        const options = {headers: {'Accept': 'application/json'}};
        executeRequest(
          `https://metadata.provider.plex.tv/library/metadata/${mediaKey}?X-Plex-Token=${plexToken}`,
          options,
          sendResponse
        );
        return true;
    }

    else if (request.contentScriptQuery === 'getOverseerrVersion') {
        console.log(`Getting Overseerr version`);
        pullStoredData(function() {
            const options = {headers: {'X-Api-Key': serverAPIKey}};
            executeRequest(
              `${origin}/api/v1/status`,
              options,
              sendResponse
            );
        });
        return true;
    }

    else if (request.contentScriptQuery === 'checkJellyseerr') {
        console.log(`Checking if instance is Jellyseerr`);
        pullStoredData(function() {
            const options = {headers: {'X-Api-Key': serverAPIKey, 'Accept': 'application/json'}};
            fetch(`${origin}/api/v1/auth/me`, options)
                .then(response => response.json())
                .then(json => sendResponse(Object.keys(json).filter((key) => /jellyfin/.test(key)).length > 0))
                .catch(error => {
                    console.error(error);
                    sendResponse(false);
                });
        });
        return true;
    }

    else if (request.contentScriptQuery === 'openOptionsPage') {
        runtime.openOptionsPage();
        return true;
    }

    else if (request.contentScriptQuery === 'listenForUrlChange') {
        tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (
                changeInfo.status === 'complete' &&
                tab.status === 'complete' &&
                tab.url &&
                tab.url.startsWith('https://www.senscritique.com')
            ) {
                tabs.sendMessage(tab.id, {
                    newUrl: tab.url
                });
            }
        });
    }
    
    // Ajouter un gestionnaire spécifique pour l'authentification
    else if (request.contentScriptQuery === 'authenticate') {
        console.log('Authenticating to Overseerr');
        const options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email: request.username,
                password: request.password
            })
        };
        executeRequest(
          `${request.url}/api/v1/auth/login`,
          options,
          sendResponse
        );
        return true;
    }
    
    return false;
});
