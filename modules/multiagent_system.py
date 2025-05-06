#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
NeoCortex - Système Multi-Agents Avancé
---------------------------------------
Module de coordination et d'exécution de tâches complexes via une équipe d'agents spécialisés.
Ce système est plus avancé que ceux de Manus et GenSpark avec une meilleure coordination des agents
et une compréhension plus profonde des tâches complexes.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Callable, Set

from .agent_orchestrator import AgentOrchestrator
from .content_generator import ContentGenerator
from .llama_integration import LlamaModel
from .memory_manager import MemoryManager
from .task_executor import TaskExecutor
from .web_scraper import WebResearcher as WebScraper

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AgentRole(str, Enum):
    """Rôles possibles des agents dans le système multi-agents."""
    COORDINATOR = "coordinator"
    RESEARCHER = "researcher"
    ANALYST = "analyst"
    CREATOR = "creator"
    CRITIC = "critic"
    EXECUTOR = "executor"
    MEMORY = "memory"
    CODE_INTERPRETER = "code_interpreter"

class InteractionType(str, Enum):
    """Types d'interactions entre les agents."""
    QUERY = "query"
    RESPONSE = "response"
    SUGGESTION = "suggestion"
    CRITIQUE = "critique"
    INSTRUCTION = "instruction"
    INFORMATION = "information"
    CODE = "code"
    RESULT = "result"

class SessionStatus(str, Enum):
    """États possibles d'une session multi-agents."""
    INITIALIZING = "initializing"
    PLANNING = "planning"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"

class Agent:
    """Représente un agent dans le système multi-agents avec un rôle et des compétences spécifiques."""
    
    def __init__(
        self, 
        name: str, 
        role: AgentRole, 
        model: LlamaModel,
        description: str = None,
        capabilities: List[str] = None,
        memory: MemoryManager = None
    ):
        self.id = str(uuid.uuid4())
        self.name = name
        self.role = role
        self.model = model
        self.description = description
        self.capabilities = capabilities or []
        self.memory = memory or MemoryManager()
        self.busy = False
        self.last_active = datetime.now()
        self.task_queue = asyncio.Queue()
        self.performance_metrics = {
            "tasks_completed": 0,
            "avg_response_time": 0,
            "success_rate": 1.0,
        }
    
    async def process_message(self, message: str, context: Dict = None) -> str:
        """Traite un message entrant et génère une réponse en fonction du rôle de l'agent."""
        start_time = time.time()
        
        try:
            # Préparation du contexte spécifique au rôle
            role_context = self._prepare_role_context(context)
            
            # Construction du prompt avec les instructions spécifiques au rôle
            prompt = self._build_role_prompt(message, role_context)
            
            # Utilisation de la mémoire pour enrichir le contexte
            memory_context = self.memory.retrieve_relevant_memories(message)
            if memory_context:
                prompt += f"\n\nInformations pertinentes de ma mémoire :\n{memory_context}"
            
            # Générer la réponse
            response = await self.model.generate_text(prompt)
            
            # Stocker cette interaction dans la mémoire
            self.memory.store_memory(
                {
                    "input": message,
                    "output": response,
                    "context": context,
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            # Mettre à jour les métriques de performance
            elapsed_time = time.time() - start_time
            self._update_performance_metrics(True, elapsed_time)
            
            return response
        
        except Exception as e:
            logger.error(f"Erreur dans le traitement du message par l'agent {self.name}: {str(e)}")
            self._update_performance_metrics(False, time.time() - start_time)
            return f"Je n'ai pas pu traiter cette demande en raison d'une erreur: {str(e)}"
    
    def _prepare_role_context(self, context: Dict) -> Dict:
        """Prépare le contexte spécifique au rôle de l'agent."""
        role_context = context.copy() if context else {}
        
        # Ajouter des informations spécifiques au rôle
        if self.role == AgentRole.COORDINATOR:
            role_context["is_coordinator"] = True
            role_context["team_overview"] = True
        elif self.role == AgentRole.RESEARCHER:
            role_context["search_enabled"] = True
            role_context["data_sources"] = ["web", "database", "documents"]
        elif self.role == AgentRole.ANALYST:
            role_context["analysis_tools"] = ["statistical", "semantic", "pattern_recognition"]
        elif self.role == AgentRole.CREATOR:
            role_context["creative_tools"] = ["ideation", "content_generation", "structuring"]
        elif self.role == AgentRole.CRITIC:
            role_context["evaluation_criteria"] = ["accuracy", "coherence", "relevance", "completeness"]
        elif self.role == AgentRole.EXECUTOR:
            role_context["execution_capabilities"] = ["code_execution", "api_calls", "system_operations"]
        elif self.role == AgentRole.MEMORY:
            role_context["memory_access"] = "full"
            role_context["memory_operations"] = ["store", "retrieve", "associate", "forget"]
        elif self.role == AgentRole.CODE_INTERPRETER:
            role_context["code_execution"] = True
            role_context["supported_languages"] = ["python", "javascript", "bash", "sql"]
        
        return role_context
    
    def _build_role_prompt(self, message: str, context: Dict) -> str:
        """Construit un prompt spécifique au rôle de l'agent."""
        # Instructions de base pour tous les agents
        prompt = f"Tu es {self.name}, un agent IA spécialisé dans le rôle de {self.role.value}. "
        
        # Instructions spécifiques au rôle
        if self.role == AgentRole.COORDINATOR:
            prompt += """
            En tant que coordinateur, ton rôle est d'orchestrer le travail de l'équipe d'agents pour résoudre efficacement des tâches complexes.
            Tu dois:
            1. Comprendre la tâche globale et la décomposer en sous-tâches
            2. Attribuer les sous-tâches aux agents les plus appropriés
            3. Intégrer les résultats des différents agents
            4. Maintenir une vision cohérente du projet
            5. Prendre des décisions sur la stratégie à adopter

            Réponds toujours en expliquant ton raisonnement et en précisant quelles informations tu as besoin des autres agents.
            """
        
        elif self.role == AgentRole.RESEARCHER:
            prompt += """
            En tant que chercheur, ton rôle est de recueillir des informations pertinentes pour la tâche.
            Tu dois:
            1. Identifier les informations nécessaires pour résoudre la tâche
            2. Rechercher ces informations dans les sources disponibles
            3. Évaluer la fiabilité et la pertinence des informations trouvées
            4. Synthétiser les informations de manière claire et concise
            5. Citer tes sources

            Réponds toujours avec des informations factuelles et précises, en indiquant tes sources et ton niveau de confiance.
            """
        
        elif self.role == AgentRole.ANALYST:
            prompt += """
            En tant qu'analyste, ton rôle est d'examiner et d'interpréter les données et informations disponibles.
            Tu dois:
            1. Identifier les patterns et tendances dans les données
            2. Faire des analyses statistiques quand c'est pertinent
            3. Interpréter les résultats dans le contexte de la tâche
            4. Identifier les implications et conséquences 
            5. Formuler des recommandations basées sur ton analyse

            Réponds toujours avec une analyse structurée, en expliquant ton raisonnement et en quantifiant l'incertitude quand c'est possible.
            """
        
        elif self.role == AgentRole.CREATOR:
            prompt += """
            En tant que créateur, ton rôle est de générer du contenu original et créatif.
            Tu dois:
            1. Comprendre les exigences et contraintes du contenu à créer
            2. Générer des idées originales et pertinentes
            3. Structurer le contenu de manière cohérente et engageante
            4. Adapter ton style et ton ton à l'objectif et à l'audience
            5. Itérer et améliorer le contenu en fonction des retours

            Réponds toujours avec créativité tout en respectant les contraintes données et en expliquant tes choix créatifs.
            """
        
        elif self.role == AgentRole.CRITIC:
            prompt += """
            En tant que critique, ton rôle est d'évaluer et d'améliorer le travail des autres agents.
            Tu dois:
            1. Examiner attentivement le contenu à évaluer
            2. Identifier les forces et faiblesses selon des critères pertinents
            3. Proposer des améliorations spécifiques et constructives
            4. Vérifier l'exactitude factuelle et la cohérence logique
            5. S'assurer que le résultat répond bien aux exigences de la tâche

            Réponds toujours avec une critique constructive, en justifiant tes observations et en proposant des améliorations concrètes.
            """
        
        elif self.role == AgentRole.EXECUTOR:
            prompt += """
            En tant qu'exécuteur, ton rôle est de mettre en œuvre des actions concrètes pour résoudre la tâche.
            Tu dois:
            1. Comprendre précisément les actions à réaliser
            2. Exécuter ces actions de manière efficace et sécurisée
            3. Gérer les erreurs et exceptions qui peuvent survenir
            4. Documenter les actions réalisées et leurs résultats
            5. Suggérer des optimisations pour les processus d'exécution

            Réponds toujours avec des actions concrètes, en détaillant les étapes que tu suis et en rapportant les résultats obtenus.
            """
        
        elif self.role == AgentRole.MEMORY:
            prompt += """
            En tant que gestionnaire de mémoire, ton rôle est de stocker, organiser et récupérer des informations pertinentes.
            Tu dois:
            1. Identifier les informations importantes à mémoriser
            2. Organiser ces informations de manière structurée
            3. Établir des connexions entre les différentes informations
            4. Retrouver rapidement des informations spécifiques quand nécessaire
            5. Maintenir la cohérence et l'intégrité de la mémoire collective

            Réponds toujours en fournissant des informations précises issues de ta mémoire, en expliquant d'où viennent ces informations et comment elles sont reliées au contexte actuel.
            """
        
        elif self.role == AgentRole.CODE_INTERPRETER:
            prompt += """
            En tant qu'interprète de code, ton rôle est d'écrire, exécuter et déboguer du code informatique.
            Tu dois:
            1. Comprendre les besoins et exigences techniques
            2. Écrire du code clair, efficace et bien documenté
            3. Exécuter le code et interpréter les résultats
            4. Identifier et corriger les erreurs et bugs
            5. Optimiser le code pour améliorer les performances

            Réponds toujours avec du code bien structuré et commenté, en expliquant ton approche et en documentant les hypothèses et limitations.
            """
        
        # Ajout du message à traiter
        prompt += f"\n\nVoici le message à traiter: \n\n{message}\n\n"
        
        # Ajout du contexte si disponible
        if context:
            prompt += f"Contexte supplémentaire:\n{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
        
        return prompt
    
    def _update_performance_metrics(self, success: bool, response_time: float) -> None:
        """Met à jour les métriques de performance de l'agent."""
        self.performance_metrics["tasks_completed"] += 1
        
        # Mise à jour du temps de réponse moyen
        prev_avg = self.performance_metrics["avg_response_time"]
        prev_count = self.performance_metrics["tasks_completed"] - 1
        self.performance_metrics["avg_response_time"] = (prev_avg * prev_count + response_time) / self.performance_metrics["tasks_completed"]
        
        # Mise à jour du taux de succès
        if not success:
            self.performance_metrics["success_rate"] = (self.performance_metrics["success_rate"] * prev_count + 0) / self.performance_metrics["tasks_completed"]
    
    def to_dict(self) -> Dict:
        """Convertit l'agent en dictionnaire pour la sérialisation."""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role.value,
            "description": self.description,
            "capabilities": self.capabilities,
            "performance_metrics": self.performance_metrics,
            "last_active": self.last_active.isoformat(),
        }

class Interaction:
    """Représente une interaction entre deux agents dans le système multi-agents."""
    
    def __init__(
        self, 
        from_agent_id: str, 
        to_agent_id: str, 
        content: str, 
        interaction_type: InteractionType,
        metadata: Dict = None
    ):
        self.id = str(uuid.uuid4())
        self.from_agent_id = from_agent_id
        self.to_agent_id = to_agent_id
        self.content = content
        self.type = interaction_type
        self.timestamp = datetime.now()
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict:
        """Convertit l'interaction en dictionnaire pour la sérialisation."""
        return {
            "id": self.id,
            "from_agent_id": self.from_agent_id,
            "to_agent_id": self.to_agent_id,
            "content": self.content,
            "type": self.type.value,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }

class MultiAgentSession:
    """Gère une session de travail multi-agents pour accomplir une tâche spécifique."""
    
    def __init__(self, task: str, config: Dict = None):
        self.id = str(uuid.uuid4())
        self.task = task
        self.config = config or {}
        self.created_at = datetime.now()
        self.updated_at = self.created_at
        self.status = SessionStatus.INITIALIZING
        self.agents: Dict[str, Agent] = {}
        self.interactions: List[Interaction] = []
        self.result = None
        self.error = None
        
        # Composants supplémentaires
        self.memory_manager = MemoryManager()
        self.llm_model = LlamaModel(model_name=config.get("model", "llama3-70b"), embedding_model="nomic-embed-text")
        self.orchestrator = AgentOrchestrator()
        self.content_generator = ContentGenerator(self.llm_model)
        self.task_executor = TaskExecutor()
        self.web_scraper = WebScraper()
        
        # Événements pour la coordination
        self.paused = asyncio.Event()
        self.paused.set()  # Commence non pausé
        self.stopped = asyncio.Event()
        self.completion_event = asyncio.Event()
        
        # Initialisation des agents
        self._initialize_agents()
    
    def _initialize_agents(self) -> None:
        """Initialise les agents standard pour la session."""
        # Création des agents par défaut
        coordinator = Agent(
            name="Coordinateur", 
            role=AgentRole.COORDINATOR,
            model=self.llm_model,
            description="Agent responsable de la coordination générale et de la prise de décision",
            capabilities=["planification", "délégation", "synthèse", "gestion_de_projet"],
            memory=self.memory_manager
        )
        
        researcher = Agent(
            name="Chercheur", 
            role=AgentRole.RESEARCHER,
            model=self.llm_model,
            description="Agent spécialisé dans la recherche d'informations",
            capabilities=["recherche", "vérification_factuelle", "collecte_de_données"],
            memory=self.memory_manager
        )
        
        analyst = Agent(
            name="Analyste", 
            role=AgentRole.ANALYST,
            model=self.llm_model,
            description="Agent spécialisé dans l'analyse de données et d'informations",
            capabilities=["analyse_statistique", "reconnaissance_de_patterns", "corrélation"],
            memory=self.memory_manager
        )
        
        creator = Agent(
            name="Créateur", 
            role=AgentRole.CREATOR,
            model=self.llm_model,
            description="Agent spécialisé dans la création de contenu original",
            capabilities=["rédaction", "création_visuelle", "idéation", "storytelling"],
            memory=self.memory_manager
        )
        
        critic = Agent(
            name="Critique", 
            role=AgentRole.CRITIC,
            model=self.llm_model,
            description="Agent spécialisé dans l'évaluation et l'amélioration",
            capabilities=["révision", "feedback", "évaluation_qualité", "détection_erreurs"],
            memory=self.memory_manager
        )
        
        executor = Agent(
            name="Exécuteur", 
            role=AgentRole.EXECUTOR,
            model=self.llm_model,
            description="Agent spécialisé dans l'exécution d'actions concrètes",
            capabilities=["exécution_de_code", "appels_api", "automatisation"],
            memory=self.memory_manager
        )
        
        memory_agent = Agent(
            name="Mémoire", 
            role=AgentRole.MEMORY,
            model=self.llm_model,
            description="Agent spécialisé dans la gestion de la mémoire collective",
            capabilities=["stockage", "récupération", "association", "contextualisation"],
            memory=self.memory_manager
        )
        
        code_interpreter = Agent(
            name="Interprète de Code", 
            role=AgentRole.CODE_INTERPRETER,
            model=self.llm_model,
            description="Agent spécialisé dans l'écriture et l'exécution de code",
            capabilities=["programmation", "débogage", "optimisation", "documentation_technique"],
            memory=self.memory_manager
        )
        
        # Ajout des agents au dictionnaire
        self.agents[coordinator.id] = coordinator
        self.agents[researcher.id] = researcher
        self.agents[analyst.id] = analyst
        self.agents[creator.id] = creator
        self.agents[critic.id] = critic
        self.agents[executor.id] = executor
        self.agents[memory_agent.id] = memory_agent
        self.agents[code_interpreter.id] = code_interpreter
    
    async def start(self) -> None:
        """Démarre la session multi-agents pour traiter la tâche."""
        try:
            logger.info(f"Démarrage de la session multi-agents pour la tâche: {self.task}")
            self.status = SessionStatus.PLANNING
            
            # Phase de planification
            await self._planning_phase()
            
            if self.stopped.is_set():
                logger.info("Session arrêtée pendant la phase de planification")
                return
            
            # Phase d'exécution
            self.status = SessionStatus.EXECUTING
            await self._execution_phase()
            
            if self.stopped.is_set():
                logger.info("Session arrêtée pendant la phase d'exécution")
                return
            
            # Phase de révision
            self.status = SessionStatus.REVIEWING
            await self._review_phase()
            
            if self.stopped.is_set():
                logger.info("Session arrêtée pendant la phase de révision")
                return
            
            # Finalisation
            self.status = SessionStatus.COMPLETED
            logger.info(f"Session multi-agents terminée avec succès pour la tâche: {self.task}")
            self.completion_event.set()
            
        except Exception as e:
            logger.error(f"Erreur lors de l'exécution de la session multi-agents: {str(e)}")
            self.status = SessionStatus.FAILED
            self.error = str(e)
            self.completion_event.set()
    
    async def _planning_phase(self) -> None:
        """Phase de planification de la tâche par l'agent coordinateur."""
        coordinator_id = next(a.id for a in self.agents.values() if a.role == AgentRole.COORDINATOR)
        coordinator = self.agents[coordinator_id]
        
        # Le coordinateur analyse la tâche et crée un plan
        planning_prompt = f"""
        Tâche à accomplir: {self.task}
        
        En tant que coordinateur, ton rôle est de:
        1. Analyser cette tâche pour comprendre ses exigences et sa complexité
        2. Décomposer la tâche en sous-tâches logiques et gérables
        3. Identifier les agents les plus appropriés pour chaque sous-tâche
        4. Établir une séquence logique pour l'exécution des sous-tâches
        5. Définir les critères de succès pour la tâche globale
        
        Fournis un plan détaillé qui:
        - Liste les sous-tâches avec leurs descriptions
        - Assigne chaque sous-tâche à un ou plusieurs agents spécifiques (Chercheur, Analyste, Créateur, Critique, Exécuteur, Mémoire, Interprète de Code)
        - Établit des dépendances entre les sous-tâches (quelle sous-tâche doit être complétée avant une autre)
        - Définit des points de contrôle pour évaluer la progression
        """
        
        await self._check_paused()
        plan_response = await coordinator.process_message(planning_prompt)
        
        # Enregistrer cette interaction
        self._add_interaction(
            coordinator_id,
            coordinator_id,  # Interaction avec soi-même (réflexion)
            plan_response,
            InteractionType.INFORMATION,
            {"type": "planning"}
        )
        
        # Partager le plan avec tous les agents
        for agent_id, agent in self.agents.items():
            if agent_id != coordinator_id:
                await self._check_paused()
                share_prompt = f"""
                Je suis le Coordinateur et j'ai élaboré le plan suivant pour accomplir notre tâche:
                
                {plan_response}
                
                Prends connaissance de ce plan et prépare-toi à accomplir les sous-tâches qui te seront assignées.
                Si tu as des questions ou des suggestions concernant le plan, n'hésite pas à me les communiquer.
                """
                
                # Enregistrer l'interaction
                self._add_interaction(
                    coordinator_id,
                    agent_id,
                    share_prompt,
                    InteractionType.INFORMATION,
                    {"type": "plan_sharing"}
                )
    
    async def _execution_phase(self) -> None:
        """Phase d'exécution de la tâche impliquant tous les agents."""
        coordinator_id = next(a.id for a in self.agents.values() if a.role == AgentRole.COORDINATOR)
        coordinator = self.agents[coordinator_id]
        
        # Récupérer le plan de la phase précédente
        plan_interaction = next((i for i in self.interactions if i.type == InteractionType.INFORMATION and 
                               i.metadata.get("type") == "planning"), None)
        
        if not plan_interaction:
            logger.error("Impossible de trouver le plan pour la phase d'exécution")
            return
        
        plan = plan_interaction.content
        
        # Analyser le plan pour extraire les sous-tâches (cela nécessiterait une implémentation plus complexe)
        # Pour l'exemple, nous allons simuler une séquence d'interactions basiques
        
        # 1. Recherche d'informations
        researcher_id = next(a.id for a in self.agents.values() if a.role == AgentRole.RESEARCHER)
        researcher = self.agents[researcher_id]
        
        await self._check_paused()
        research_prompt = f"""
        Dans le cadre de notre tâche: {self.task}
        
        Le plan nécessite que tu recherches des informations pertinentes.
        Recherche et synthétise les informations essentielles pour accomplir cette tâche.
        """
        
        # Enregistrer l'interaction coordinator -> researcher
        self._add_interaction(
            coordinator_id,
            researcher_id,
            research_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        research_response = await researcher.process_message(research_prompt)
        
        # Enregistrer l'interaction researcher -> coordinator
        self._add_interaction(
            researcher_id,
            coordinator_id,
            research_response,
            InteractionType.RESPONSE
        )
        
        # 2. Analyse des informations
        analyst_id = next(a.id for a in self.agents.values() if a.role == AgentRole.ANALYST)
        analyst = self.agents[analyst_id]
        
        await self._check_paused()
        analysis_prompt = f"""
        Le Chercheur a fourni les informations suivantes:
        
        {research_response}
        
        Analyse ces informations pour déterminer:
        1. Les points clés pertinents pour notre tâche
        2. Les patterns ou tendances importantes
        3. Les implications pour notre approche
        """
        
        # Enregistrer l'interaction coordinator -> analyst
        self._add_interaction(
            coordinator_id,
            analyst_id,
            analysis_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        analysis_response = await analyst.process_message(analysis_prompt)
        
        # Enregistrer l'interaction analyst -> coordinator
        self._add_interaction(
            analyst_id,
            coordinator_id,
            analysis_response,
            InteractionType.RESPONSE
        )
        
        # 3. Création de contenu
        creator_id = next(a.id for a in self.agents.values() if a.role == AgentRole.CREATOR)
        creator = self.agents[creator_id]
        
        await self._check_paused()
        creation_prompt = f"""
        Sur la base des recherches et analyses suivantes:
        
        Recherche: {research_response}
        
        Analyse: {analysis_response}
        
        Crée un contenu original qui répond à notre tâche: {self.task}
        
        Assure-toi que ton contenu est:
        - Pertinent par rapport à l'objectif
        - Bien structuré et cohérent
        - Original et apporte de la valeur
        - Adapté au public cible
        """
        
        # Enregistrer l'interaction coordinator -> creator
        self._add_interaction(
            coordinator_id,
            creator_id,
            creation_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        creation_response = await creator.process_message(creation_prompt)
        
        # Enregistrer l'interaction creator -> coordinator
        self._add_interaction(
            creator_id,
            coordinator_id,
            creation_response,
            InteractionType.RESPONSE
        )
        
        # 4. Critique et améliorations
        critic_id = next(a.id for a in self.agents.values() if a.role == AgentRole.CRITIC)
        critic = self.agents[critic_id]
        
        await self._check_paused()
        critique_prompt = f"""
        Voici un contenu créé pour répondre à la tâche suivante: {self.task}
        
        Contenu à évaluer:
        {creation_response}
        
        Examine ce contenu de manière critique et fournit:
        1. Une évaluation globale de sa qualité et pertinence
        2. Des points spécifiques à améliorer
        3. Des suggestions concrètes d'amélioration
        4. Une vérification factuelle des informations présentées
        """
        
        # Enregistrer l'interaction coordinator -> critic
        self._add_interaction(
            coordinator_id,
            critic_id,
            critique_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        critique_response = await critic.process_message(critique_prompt)
        
        # Enregistrer l'interaction critic -> coordinator
        self._add_interaction(
            critic_id,
            coordinator_id,
            critique_response,
            InteractionType.RESPONSE
        )
        
        # 5. Amélioration du contenu par le créateur
        await self._check_paused()
        improvement_prompt = f"""
        Le Critique a fourni les commentaires suivants sur ton contenu:
        
        {critique_response}
        
        Révise ton contenu en tenant compte de ces commentaires. Assure-toi d'adresser les points spécifiques mentionnés.
        """
        
        # Enregistrer l'interaction coordinator -> creator
        self._add_interaction(
            coordinator_id,
            creator_id,
            improvement_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        improved_content = await creator.process_message(improvement_prompt)
        
        # Enregistrer l'interaction creator -> coordinator
        self._add_interaction(
            creator_id,
            coordinator_id,
            improved_content,
            InteractionType.RESPONSE
        )
        
        # 6. Validation finale du critique
        await self._check_paused()
        validation_prompt = f"""
        Voici la version améliorée du contenu:
        
        {improved_content}
        
        Évalue si cette version répond aux commentaires précédents et si elle est prête pour être finalisée.
        Si des améliorations sont encore nécessaires, précise-les.
        """
        
        # Enregistrer l'interaction coordinator -> critic
        self._add_interaction(
            coordinator_id,
            critic_id,
            validation_prompt,
            InteractionType.INSTRUCTION
        )
        
        await self._check_paused()
        validation_response = await critic.process_message(validation_prompt)
        
        # Enregistrer l'interaction critic -> coordinator
        self._add_interaction(
            critic_id,
            coordinator_id,
            validation_response,
            InteractionType.RESPONSE
        )
        
        # Enregistrer le résultat dans la session
        self.result = improved_content
    
    async def _review_phase(self) -> None:
        """Phase de révision finale par l'agent coordinator pour s'assurer que la tâche est bien accomplie."""
        coordinator_id = next(a.id for a in self.agents.values() if a.role == AgentRole.COORDINATOR)
        coordinator = self.agents[coordinator_id]
        
        await self._check_paused()
        review_prompt = f"""
        Nous avons terminé l'exécution de la tâche: {self.task}
        
        Voici le résultat final:
        {self.result}
        
        En tant que coordinateur, vérifie que:
        1. Le résultat répond pleinement à la tâche demandée
        2. Tous les aspects de la tâche ont été traités
        3. Le résultat est cohérent et de haute qualité
        4. Il n'y a pas d'erreurs ou d'omissions importantes
        
        Fournis une évaluation finale et, si nécessaire, des recommandations pour de futures améliorations.
        """
        
        review_response = await coordinator.process_message(review_prompt)
        
        # Enregistrer cette interaction
        self._add_interaction(
            coordinator_id,
            coordinator_id,  # Interaction avec soi-même (réflexion)
            review_response,
            InteractionType.INFORMATION,
            {"type": "final_review"}
        )
        
        # Mettre à jour le résultat final avec la révision
        self.result = f"""
        # Résultat final pour la tâche: {self.task}
        
        {self.result}
        
        ## Évaluation finale du Coordinateur:
        
        {review_response}
        """
    
    def pause(self) -> None:
        """Met en pause la session multi-agents."""
        self.paused.clear()
        self.status = SessionStatus.PAUSED
        logger.info(f"Session {self.id} mise en pause")
    
    def resume(self) -> None:
        """Reprend une session multi-agents mise en pause."""
        self.paused.set()
        # Restaurer le statut précédent
        if self.status == SessionStatus.PAUSED:
            # Déterminer le statut en fonction du nombre d'interactions
            interaction_count = len(self.interactions)
            if interaction_count > 15:
                self.status = SessionStatus.REVIEWING
            elif interaction_count > 5:
                self.status = SessionStatus.EXECUTING
            else:
                self.status = SessionStatus.PLANNING
        logger.info(f"Session {self.id} reprise")
    
    def stop(self) -> None:
        """Arrête la session multi-agents."""
        self.stopped.set()
        # Si la session était pausée, on la reprend d'abord pour que les coroutines puissent continuer et voir le signal d'arrêt
        if not self.paused.is_set():
            self.paused.set()
        logger.info(f"Session {self.id} arrêtée")
    
    async def _check_paused(self) -> None:
        """Vérifie si la session est en pause et attend si c'est le cas."""
        await self.paused.wait()
        if self.stopped.is_set():
            raise Exception("Session arrêtée")
    
    def _add_interaction(
        self, 
        from_agent_id: str, 
        to_agent_id: str, 
        content: str, 
        interaction_type: InteractionType,
        metadata: Dict = None
    ) -> None:
        """Ajoute une nouvelle interaction à la session."""
        interaction = Interaction(
            from_agent_id=from_agent_id,
            to_agent_id=to_agent_id,
            content=content,
            interaction_type=interaction_type,
            metadata=metadata
        )
        
        self.interactions.append(interaction)
        self.updated_at = datetime.now()
        
        # Mettre à jour le dernier moment d'activité des agents concernés
        if from_agent_id in self.agents:
            self.agents[from_agent_id].last_active = datetime.now()
        if to_agent_id in self.agents and to_agent_id != from_agent_id:
            self.agents[to_agent_id].last_active = datetime.now()
    
    def to_dict(self) -> Dict:
        """Convertit la session en dictionnaire pour la sérialisation."""
        return {
            "id": self.id,
            "task": self.task,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status.value,
            "agents": [agent.to_dict() for agent in self.agents.values()],
            "interactions": [interaction.to_dict() for interaction in self.interactions],
            "result": self.result,
            "error": self.error,
        }

class MultiAgentSystem:
    """Système principal pour gérer les sessions multi-agents et leurs interactions."""
    
    def __init__(self, llm_model=None, web_researcher=None, memory_manager=None, content_generator=None):
        self.sessions: Dict[str, MultiAgentSession] = {}
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.llm_model = llm_model
        self.web_researcher = web_researcher
        self.memory_manager = memory_manager
        self.content_generator = content_generator
    
    async def create_session(self, task: str, config: Dict = None) -> Dict:
        """Crée une nouvelle session multi-agents pour accomplir une tâche."""
        session = MultiAgentSession(task, config or {})
        self.sessions[session.id] = session
        
        # Démarrer la session dans une tâche asyncio
        task = asyncio.create_task(session.start())
        self.active_tasks[session.id] = task
        
        return session.to_dict()
    
    def get_session(self, session_id: str) -> Dict:
        """Récupère les détails d'une session multi-agents."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        return session.to_dict()
    
    def list_sessions(self, limit: int = 10) -> List[Dict]:
        """Liste les sessions multi-agents existantes."""
        sessions = sorted(
            self.sessions.values(),
            key=lambda s: s.updated_at,
            reverse=True
        )
        return {
            "sessions": [session.to_dict() for session in sessions[:limit]]
        }
    
    def pause_session(self, session_id: str) -> Dict:
        """Met en pause une session multi-agents en cours."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        session.pause()
        return session.to_dict()
    
    def resume_session(self, session_id: str) -> Dict:
        """Reprend une session multi-agents mise en pause."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        session.resume()
        return session.to_dict()
    
    def stop_session(self, session_id: str) -> Dict:
        """Arrête une session multi-agents en cours."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        session.stop()
        
        # Attendre la fin de la tâche
        task = self.active_tasks.get(session_id)
        if task and not task.done():
            # On ne bloque pas ici, la tâche se terminera d'elle-même
            pass
        return session.to_dict()
    
    def toggle_session_pause(self, session_id: str) -> Dict:
        """Bascule l'état de pause d'une session."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        if session.paused.is_set():
            session.pause()
        else:
            session.resume()
        return session.to_dict()
    
    async def add_agent_to_session(
        self, 
        session_id: str, 
        name: str, 
        role: str, 
        description: str = None,
        capabilities: List[str] = None
    ) -> Dict:
        """Ajoute un nouvel agent à une session existante."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        try:
            agent_role = AgentRole(role.lower())
        except ValueError:
            raise ValueError(f"Invalid agent role: {role}")
        
        agent = Agent(
            name=name,
            role=agent_role,
            model=session.llm_model,
            description=description,
            capabilities=capabilities,
            memory=session.memory_manager
        )
        session.agents[agent.id] = agent
        return agent.to_dict()
    
    def status(self) -> Dict:
        """Renvoie le statut du système multi-agents."""
        active_sessions = sum(1 for session in self.sessions.values() 
                              if session.status not in [SessionStatus.COMPLETED, SessionStatus.FAILED])
        
        return {
            "status": "online",
            "active_sessions": active_sessions,
            "total_sessions": len(self.sessions),
            "agents_available": True,
            "version": "1.0.0"
        }
    
    async def get_agent_details(self, session_id: str, agent_id: str) -> Dict:
        """Récupère les détails d'un agent spécifique dans une session."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        agent = session.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent with ID {agent_id} not found in session {session_id}")
        return agent.to_dict()
    
    async def get_interactions(
        self, 
        session_id: str, 
        agent_id: str = None, 
        limit: int = 50,
        skip: int = 0
    ) -> Dict:
        """Récupère les interactions dans une session, éventuellement filtrées par agent."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session with ID {session_id} not found")
        
        interactions = session.interactions
        if agent_id:
            interactions = [
                i for i in interactions 
                if i.from_agent_id == agent_id or i.to_agent_id == agent_id
            ]
        
        # Trier par horodatage
        interactions = sorted(interactions, key=lambda i: i.timestamp)
        
        # Paginer
        interactions = interactions[skip:skip+limit]
        
        return {
            "interactions": [i.to_dict() for i in interactions],
            "total": len(session.interactions),
            "filtered": len(interactions) if agent_id else len(session.interactions),
        }
    
    async def cleanup(self) -> None:
        """Nettoie les ressources utilisées par le système multi-agents."""
        # Arrêter toutes les sessions en cours
        for session_id, session in self.sessions.items():
            session.stop()
        
        # Attendre que toutes les tâches soient terminées
        if self.active_tasks:
            await asyncio.gather(*[task for task in self.active_tasks.values() if not task.done()])
        
        logger.info("Nettoyage du système multi-agents terminé")

# Singleton pour l'accès global
multi_agent_system = MultiAgentSystem()