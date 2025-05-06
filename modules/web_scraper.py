import requests
from bs4 import BeautifulSoup
import logging
from typing import List, Dict, Any, Optional
import json
import time
import random
from urllib.parse import urlparse, urljoin
import os

# Import conditionnel pour les bibliothèques de recherche
try:
    from duckduckgo_search import DDGS
    DUCKDUCKGO_AVAILABLE = True
except ImportError:
    DUCKDUCKGO_AVAILABLE = False

class WebResearcher:
    """
    Classe avancée pour la recherche web, la collecte et l'analyse de données
    """
    
    def __init__(self, 
                 max_search_results: int = 10, 
                 timeout: int = 30,
                 user_agents: List[str] = None):
        """
        Initialise le chercheur web
        
        Args:
            max_search_results (int): Nombre maximal de résultats à renvoyer
            timeout (int): Délai d'attente en secondes
            user_agents (List[str]): Liste d'agents utilisateurs à utiliser
        """
        self.logger = logging.getLogger(__name__)
        self.max_search_results = max_search_results
        self.timeout = timeout
        
        # Liste d'agents utilisateurs pour éviter les blocages
        self.user_agents = user_agents or [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
        ]
        
        # Cache pour les résultats de recherche
        self.search_cache = {}
        self.page_cache = {}
        
        # Initialisation de selenium si disponible
        self.selenium_available = self._initialize_selenium()
        
    def _initialize_selenium(self) -> bool:
        """
        Initialise Selenium pour le scraping avancé si disponible
        
        Returns:
            bool: True si Selenium est disponible, False sinon
        """
        try:
            from selenium import webdriver
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.chrome.options import Options
            
            # Configuration des options Chrome
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            
            # Initialiser le driver en mode caché
            self.driver = None  # On l'initialisera à la demande pour économiser des ressources
            self.webdriver = webdriver
            self.chrome_options = chrome_options
            self.service = Service()
            
            return True
        except ImportError:
            self.logger.warning("Selenium n'est pas disponible. Le scraping avancé sera limité.")
            return False
    
    def _get_selenium_driver(self):
        """
        Obtient le driver Selenium à la demande
        
        Returns:
            WebDriver: Instance du driver Selenium
        """
        if not self.selenium_available:
            return None
            
        if self.driver is None:
            self.driver = self.webdriver.Chrome(service=self.service, options=self.chrome_options)
            
        return self.driver
        
    def _get_random_user_agent(self) -> str:
        """
        Renvoie un agent utilisateur aléatoire
        
        Returns:
            str: Agent utilisateur
        """
        return random.choice(self.user_agents)
        
    def search(self, query: str, num_results: int = None) -> List[Dict[str, str]]:
        """
        Effectue une recherche web
        
        Args:
            query (str): Requête de recherche
            num_results (int, optional): Nombre de résultats à renvoyer
            
        Returns:
            List[Dict[str, str]]: Liste de résultats
        """
        num_results = num_results or self.max_search_results
        
        # Vérifier le cache
        cache_key = f"{query}_{num_results}"
        if cache_key in self.search_cache:
            self.logger.info(f"Résultats trouvés dans le cache pour: {query}")
            return self.search_cache[cache_key]
            
        results = []
        
        try:
            # Recherche avec DuckDuckGo si disponible
            if DUCKDUCKGO_AVAILABLE:
                self.logger.info(f"Recherche avec DuckDuckGo: {query}")
                with DDGS() as ddgs:
                    ddg_results = list(ddgs.text(query, max_results=num_results))
                
                for result in ddg_results:
                    results.append({
                        "title": result.get("title", ""),
                        "link": result.get("href", ""),
                        "snippet": result.get("body", "")
                    })
            else:
                # Recherche de secours avec une requête directe
                self.logger.info(f"Utilisation de la méthode de recherche alternative pour: {query}")
                # Cette méthode est simplifiée et ne devrait être utilisée qu'en dernier recours
                fallback_results = self._fallback_search(query, num_results)
                results.extend(fallback_results)
                
            # Mettre en cache les résultats
            self.search_cache[cache_key] = results
                
            return results[:num_results]
        
        except Exception as e:
            self.logger.error(f"Erreur lors de la recherche pour '{query}': {str(e)}")
            return []
    
    def _fallback_search(self, query: str, num_results: int) -> List[Dict[str, str]]:
        """
        Méthode de recherche de secours quand les API ne sont pas disponibles
        
        Args:
            query (str): Requête de recherche
            num_results (int): Nombre de résultats à renvoyer
            
        Returns:
            List[Dict[str, str]]: Liste de résultats
        """
        # Cette méthode est un exemple simplifié
        # Dans un cas réel, vous pourriez implémenter une solution personnalisée
        return []
            
    def scrape_web(self, url: str, use_selenium: bool = False) -> str:
        """
        Extrait le contenu d'une page web
        
        Args:
            url (str): URL à extraire
            use_selenium (bool): Utiliser Selenium pour le rendu JavaScript
            
        Returns:
            str: Contenu HTML de la page
        """
        # Vérifier le cache
        if url in self.page_cache:
            self.logger.info(f"Page trouvée dans le cache: {url}")
            return self.page_cache[url]
            
        try:
            if use_selenium and self.selenium_available:
                driver = self._get_selenium_driver()
                driver.get(url)
                # Attendre que la page se charge
                time.sleep(2)
                html = driver.page_source
            else:
                headers = {"User-Agent": self._get_random_user_agent()}
                response = requests.get(url, headers=headers, timeout=self.timeout)
                if response.status_code != 200:
                    self.logger.warning(f"Statut HTTP {response.status_code} pour {url}")
                    return f"Erreur: {response.status_code}"
                html = response.text
                
            # Mettre en cache la page
            self.page_cache[url] = html
            
            return html
            
        except Exception as e:
            self.logger.error(f"Erreur lors de l'extraction de {url}: {str(e)}")
            return f"Erreur lors de l'extraction: {str(e)}"
    
    def extract_text(self, html: str) -> str:
        """
        Extrait le texte d'une page HTML
        
        Args:
            html (str): Contenu HTML
            
        Returns:
            str: Texte extrait
        """
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # Supprimer les éléments non pertinents
            for element in soup(["script", "style", "nav", "footer", "header"]):
                element.decompose()
                
            # Extraire le texte
            text = soup.get_text(separator="\n")
            
            # Nettoyer le texte
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            text = "\n".join(lines)
            
            return text
            
        except Exception as e:
            self.logger.error(f"Erreur lors de l'extraction du texte: {str(e)}")
            return f"Erreur lors de l'extraction du texte: {str(e)}"
    
    def extract_links(self, html: str, base_url: str) -> List[str]:
        """
        Extrait les liens d'une page HTML
        
        Args:
            html (str): Contenu HTML
            base_url (str): URL de base pour les liens relatifs
            
        Returns:
            List[str]: Liste de liens
        """
        try:
            soup = BeautifulSoup(html, "html.parser")
            links = []
            
            for link in soup.find_all("a", href=True):
                href = link["href"]
                absolute_url = urljoin(base_url, href)
                links.append(absolute_url)
                
            return links
            
        except Exception as e:
            self.logger.error(f"Erreur lors de l'extraction des liens: {str(e)}")
            return []
    
    def research(self, query: str, depth: int = 1, max_pages: int = 3) -> Dict[str, Any]:
        """
        Effectue une recherche approfondie sur un sujet
        
        Args:
            query (str): Requête de recherche
            depth (int): Profondeur de recherche (nombre de niveaux de liens à suivre)
            max_pages (int): Nombre maximal de pages à extraire
            
        Returns:
            Dict[str, Any]: Résultats de la recherche
        """
        self.logger.info(f"Recherche approfondie pour: {query}")
        
        results = {
            "query": query,
            "search_results": self.search(query, max_pages),
            "pages": [],
            "summary": ""
        }
        
        # Extraire le contenu des pages trouvées
        pages_extracted = 0
        for result in results["search_results"]:
            if pages_extracted >= max_pages:
                break
                
            url = result["link"]
            try:
                html = self.scrape_web(url)
                text = self.extract_text(html)
                
                results["pages"].append({
                    "url": url,
                    "title": result["title"],
                    "content": text[:10000]  # Limiter la longueur du contenu
                })
                
                pages_extracted += 1
                
                # Respecter la politesse du web
                time.sleep(1)
                
            except Exception as e:
                self.logger.error(f"Erreur lors de l'extraction de {url}: {str(e)}")
        
        return results
        
    def status(self) -> Dict[str, Any]:
        """
        Retourne le statut du chercheur web
        
        Returns:
            Dict[str, Any]: Informations sur le statut
        """
        return {
            "status": "active",
            "selenium_available": self.selenium_available,
            "duckduckgo_available": DUCKDUCKGO_AVAILABLE,
            "cache_size": {
                "search": len(self.search_cache),
                "pages": len(self.page_cache)
            }
        }