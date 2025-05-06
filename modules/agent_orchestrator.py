import logging
import json
import time
import threading
from typing import Dict, List, Any, Optional
import re
import os
from datetime import datetime

class AgentOrchestrator:
    """
    Classe qui coordonne les différents composants de l'agent IA
    """
    
    def __init__(self, llama_model, web_researcher, task_executor, content_generator, memory_manager):
        """
        Initialise l'orchestrateur
        
        Args:
            llama_model: Instance du modèle Llama
            web_researcher: Instance du chercheur web
            task_executor: Instance de l'exécuteur de tâches
            content_generator: Instance du générateur de contenu
            memory_manager: Instance du gestionnaire de mémoire
        """
        self.logger = logging.getLogger(__name__)
        self.llama_model = llama_model
        self.web_researcher = web_researcher
        self.task_executor = task_executor
        self.content_generator = content_generator
        self.memory_manager = memory_manager
        
        # Historique des conversations
        self.conversation_history = []
        
        # Configuration de l'agent
        self.config = {
            "persona": "Tu es un assistant IA avancé nommé ManusAI, capable de comprendre des requêtes complexes et d'exécuter des tâches autonomes. Tu es utile, précis et détaillé dans tes réponses.",
            "max_history": 20,
            "web_search_enabled": True,
            "autonomous_mode": True
        }
        
        # Journalisation des événements
        self.activity_log = []
        
        # Chargement de la configuration depuis un fichier si disponible
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "agent_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    self.config.update(json.load(f))
                self.logger.info("Configuration chargée avec succès")
            except Exception as e:
                self.logger.error(f"Erreur lors du chargement de la configuration: {str(e)}")
    
    def log_activity(self, action: str, details: Dict[str, Any] = None):
        """
        Journalise une activité
        
        Args:
            action (str): Action effectuée
            details (Dict[str, Any], optional): Détails de l'action
        """
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details or {}
        }
        
        self.activity_log.append(log_entry)
        
        # Tronquer le journal si nécessaire
        if len(self.activity_log) > 1000:
            self.activity_log = self.activity_log[-1000:]
            
        self.logger.info(f"Action: {action} | Détails: {json.dumps(details or {})}")
    
    def process_query(self, query: str, context: Dict = None) -> Dict[str, Any]:
        """
        Traite une requête utilisateur
        
        Args:
            query (str): Requête de l'utilisateur
            context (Dict, optional): Contexte supplémentaire
            
        Returns:
            Dict[str, Any]: Résultat du traitement
        """
        start_time = time.time()
        
        self.log_activity("query_received", {"query": query})
        
        # Ajouter la requête à l'historique des conversations
        self.conversation_history.append({"role": "user", "content": query})
        
        # Tronquer l'historique si nécessaire
        if len(self.conversation_history) > self.config["max_history"] * 2:
            self.conversation_history = self.conversation_history[-self.config["max_history"]*2:]
        
        # Analyser la requête pour déterminer l'action à entreprendre
        intent_result = self._detect_intent(query)
        intent = intent_result["intent"]
        metadata = intent_result["metadata"]
        
        self.log_activity("intent_detected", {"intent": intent, "metadata": metadata})
        
        response = None
        
        try:
            # Traiter en fonction de l'intention détectée
            if intent == "search":
                response = self._handle_search_intent(query, metadata)
            elif intent == "task":
                response = self._handle_task_intent(query, metadata)
            elif intent == "content_generation":
                response = self._handle_content_generation_intent(query, metadata)
            elif intent == "conversation":
                response = self._handle_conversation_intent(query, context)
            else:
                # Intention par défaut: conversation
                response = self._handle_conversation_intent(query, context)
            
            # Enrichir la réponse avec des informations de contexte si nécessaire
            if self.config["autonomous_mode"]:
                response = self._enrich_response(query, response)
                
        except Exception as e:
            self.logger.error(f"Erreur lors du traitement de la requête: {str(e)}")
            response = f"Une erreur est survenue lors du traitement de votre requête: {str(e)}"
            
        # Ajouter la réponse à l'historique
        self.conversation_history.append({"role": "assistant", "content": response})
        
        # Calculer le temps d'exécution
        execution_time = time.time() - start_time
        
        self.log_activity("response_generated", {"execution_time": execution_time})
        
        # Stocker l'interaction dans la mémoire
        self.memory_manager.store(
            content=f"Question: {query}\nRéponse: {response}",
            metadata={
                "type": "conversation",
                "query": query,
                "execution_time": execution_time,
                "intent": intent
            }
        )
        
        return {
            "response": response,
            "intent": intent,
            "execution_time": execution_time
        }
    
    def _detect_intent(self, query: str) -> Dict[str, Any]:
        """
        Détecte l'intention de l'utilisateur
        
        Args:
            query (str): Requête de l'utilisateur
            
        Returns:
            Dict[str, Any]: Intention détectée et métadonnées
        """
        # Version simplifiée de la détection d'intention
        query_lower = query.lower()
        
        # Détecter l'intention de recherche
        if any(keyword in query_lower for keyword in ["cherche", "recherche", "trouve", "information sur", "internet", "web"]):
            return {
                "intent": "search",
                "metadata": {
                    "search_query": re.sub(r"^(cherche|recherche|trouve|information sur)\s+", "", query, flags=re.IGNORECASE)
                }
            }
        
        # Détecter l'intention de tâche
        if any(keyword in query_lower for keyword in ["tâche", "fait", "exécute", "réalise", "crée une tâche", "analyse"]):
            return {
                "intent": "task",
                "metadata": {
                    "task_description": query
                }
            }
        
        # Détecter l'intention de génération de contenu
        if any(keyword in query_lower for keyword in ["génère", "crée", "écris", "rédige", "résume"]):
            # Déterminer le type de contenu à générer
            content_type = None
            if "code" in query_lower or "programme" in query_lower:
                content_type = "code"
            elif "résume" in query_lower:
                content_type = "summary"
            elif any(keyword in query_lower for keyword in ["texte", "article", "paragraphe"]):
                content_type = "text"
            else:
                content_type = "generic"
                
            return {
                "intent": "content_generation",
                "metadata": {
                    "content_type": content_type,
                    "prompt": query
                }
            }
        
        # Par défaut: conversation
        return {
            "intent": "conversation",
            "metadata": {}
        }
    
    def _handle_search_intent(self, query: str, metadata: Dict[str, Any]) -> str:
        """
        Traite une intention de recherche
        
        Args:
            query (str): Requête de l'utilisateur
            metadata (Dict[str, Any]): Métadonnées de l'intention
            
        Returns:
            str: Réponse générée
        """
        search_query = metadata.get("search_query", query)
        
        self.log_activity("web_search", {"query": search_query})
        
        # Effectuer la recherche
        research_results = self.web_researcher.research(search_query)
        
        if not research_results["pages"]:
            return f"Je n'ai pas trouvé d'informations pertinentes sur '{search_query}'. Pourriez-vous reformuler votre requête?"
        
        # Collecter le contenu des pages
        content = "\n\n".join([f"Titre: {page['title']}\nContenu: {page['content'][:2000]}..." 
                             for page in research_results["pages"]])
        
        # Générer une synthèse
        prompt = f"""
        Voici les informations que j'ai trouvées sur "{search_query}":
        
        {content}
        
        Fais une synthèse complète et détaillée des informations trouvées. 
        La synthèse doit être bien structurée, informative et répondre directement à la requête.
        Cite les sources à la fin de la réponse en utilisant les URLs.
        """
        
        synthesis = self.llama_model.generate(prompt, max_tokens=800)
        
        # Ajouter les sources
        sources = "\n\nSources:\n" + "\n".join([f"- {page['title']}: {page['url']}" 
                                              for page in research_results["pages"]])
        
        return synthesis + sources
    
    def _handle_task_intent(self, query: str, metadata: Dict[str, Any]) -> str:
        """
        Traite une intention de tâche
        
        Args:
            query (str): Requête de l'utilisateur
            metadata (Dict[str, Any]): Métadonnées de l'intention
            
        Returns:
            str: Réponse générée
        """
        task_description = metadata.get("task_description", query)
        
        self.log_activity("task_created", {"description": task_description})
        
        # Créer une tâche
        task_id = self.task_executor.create_task(task_description)
        
        # Récupérer les informations sur la tâche
        task = self.task_executor.get_task(task_id)
        
        return f"""
        J'ai créé une tâche pour traiter votre demande:
        
        ID de la tâche: {task_id}
        Description: {task_description}
        Statut: {task['status']}
        
        La tâche est en cours d'exécution en arrière-plan. Vous pouvez demander son statut en utilisant son ID.
        """
    
    def _handle_content_generation_intent(self, query: str, metadata: Dict[str, Any]) -> str:
        """
        Traite une intention de génération de contenu
        
        Args:
            query (str): Requête de l'utilisateur
            metadata (Dict[str, Any]): Métadonnées de l'intention
            
        Returns:
            str: Réponse générée
        """
        content_type = metadata.get("content_type", "generic")
        prompt = metadata.get("prompt", query)
        
        self.log_activity("content_generation", {"type": content_type, "prompt": prompt})
        
        if content_type == "code":
            # Extraire le langage de programmation
            language = "python"  # Par défaut
            for lang in ["python", "javascript", "java", "c++", "c#", "php", "ruby", "go", "rust", "typescript"]:
                if lang in query.lower():
                    language = lang
                    break
            
            # Générer le code
            code = self.content_generator.generate_code(prompt, language)
            return f"""
            Voici le code {language} que j'ai généré pour votre demande:
            
            ```{language}
            {code}
            ```
            """
            
        elif content_type == "summary":
            # Extraire le texte à résumer
            # Dans un cas réel, il faudrait extraire le texte à résumer de la requête
            text_to_summarize = prompt.replace("résume", "").strip()
            if not text_to_summarize or len(text_to_summarize) < 50:
                return "Je n'ai pas trouvé de texte suffisamment long à résumer. Pourriez-vous me fournir le texte complet?"
                
            summary = self.content_generator.generate_summary(text_to_summarize)
            return f"Voici le résumé demandé:\n\n{summary}"
            
        elif content_type == "text":
            # Extraire le sujet et le style
            topic = prompt
            style = "informatif"
            length = "moyen"
            
            # Générer le texte
            text = self.content_generator.generate_text(topic, style, length)
            return text
            
        else:
            # Génération générique
            content = self.content_generator.generate(prompt)
            return content
    
    def _handle_conversation_intent(self, query: str, context: Dict = None) -> str:
        """
        Traite une intention de conversation
        
        Args:
            query (str): Requête de l'utilisateur
            context (Dict, optional): Contexte supplémentaire
            
        Returns:
            str: Réponse générée
        """
        self.log_activity("conversation", {"query": query})
        
        # Récupérer l'historique des X dernières interactions
        history_size = min(self.config["max_history"], len(self.conversation_history) // 2)
        recent_history = self.conversation_history[-history_size*2:]
        
        # Vérifier si des informations de la mémoire peuvent être pertinentes
        relevant_memories = self.memory_manager.search(query, limit=3)
        
        memory_context = ""
        if relevant_memories:
            memory_context = "Informations pertinentes de la mémoire:\n" + "\n\n".join([
                f"- {mem['content'][:300]}..." for mem in relevant_memories
            ])
        
        # Générer une réponse en tenant compte de l'historique et du contexte
        response = self.llama_model.chat(recent_history + [{"role": "system", "content": memory_context}])
        
        return response
    
    def _enrich_response(self, query: str, response: str) -> str:
        """
        Enrichit une réponse avec des informations supplémentaires si nécessaire
        
        Args:
            query (str): Requête de l'utilisateur
            response (str): Réponse initiale
            
        Returns:
            str: Réponse enrichie
        """
        # Vérifier si la réponse manque d'informations factuelles
        if self._should_add_factual_info(query, response) and self.config["web_search_enabled"]:
            # Rechercher des informations supplémentaires
            search_results = self.web_researcher.search(query, 2)
            
            if search_results:
                # Extraire une information pertinente
                relevant_info = search_results[0].get("snippet", "")
                
                if relevant_info:
                    enrichment_prompt = f"""
                    Requête: {query}
                    Réponse actuelle: {response}
                    
                    Information supplémentaire trouvée sur internet: {relevant_info}
                    
                    Intègre cette information supplémentaire dans la réponse de manière fluide et cohérente,
                    uniquement si elle apporte une valeur ajoutée. Sinon, laisse la réponse inchangée.
                    """
                    
                    enriched_response = self.llama_model.generate(enrichment_prompt)
                    return enriched_response
        
        return response
    
    def _should_add_factual_info(self, query: str, response: str) -> bool:
        """
        Détermine si la réponse devrait être enrichie avec des informations factuelles
        
        Args:
            query (str): Requête de l'utilisateur
            response (str): Réponse initiale
            
        Returns:
            bool: True si la réponse devrait être enrichie, False sinon
        """
        # Détection simplifiée basée sur certains mots-clés
        query_lower = query.lower()
        
        # Si la requête concerne des faits, des données ou des informations récentes
        factual_keywords = ["quand", "où", "qui", "combien", "qu'est-ce que", "qu'est-ce qu'", "quoi", "pourquoi",
                          "comment", "définition", "explique", "décris"]
        
        return any(keyword in query_lower for keyword in factual_keywords) and len(response) < 500
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Récupère le statut d'une tâche
        
        Args:
            task_id (str): ID de la tâche
            
        Returns:
            Dict[str, Any]: Statut de la tâche
        """
        task = self.task_executor.get_task(task_id)
        
        if not task:
            return {"error": f"Tâche {task_id} non trouvée"}
            
        return task
    
    def get_activity_log(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Récupère le journal d'activités
        
        Args:
            limit (int): Nombre maximal d'entrées à récupérer
            
        Returns:
            List[Dict[str, Any]]: Journal d'activités
        """
        return self.activity_log[-limit:]
    
    def set_config(self, config_updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Met à jour la configuration de l'agent
        
        Args:
            config_updates (Dict[str, Any]): Mises à jour de la configuration
            
        Returns:
            Dict[str, Any]: Configuration mise à jour
        """
        self.config.update(config_updates)
        
        # Sauvegarder la configuration
        config_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config")
        os.makedirs(config_dir, exist_ok=True)
        
        config_path = os.path.join(config_dir, "agent_config.json")
        with open(config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
            
        self.log_activity("config_updated", {"updates": config_updates})
            
        return self.config