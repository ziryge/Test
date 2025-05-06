import logging
import uuid
import time
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import threading

class TaskExecutor:
    """
    Classe pour l'exécution de tâches autonomes
    """
    
    def __init__(self, llama_model, web_researcher, memory_manager):
        """
        Initialise le gestionnaire de tâches
        
        Args:
            llama_model: Instance du modèle Llama pour la génération
            web_researcher: Instance du chercheur web
            memory_manager: Instance du gestionnaire de mémoire
        """
        self.logger = logging.getLogger(__name__)
        self.llama_model = llama_model
        self.web_researcher = web_researcher
        self.memory_manager = memory_manager
        
        # Dictionnaire pour stocker les tâches
        self.tasks = {}
        
        # Verrouillage pour l'accès aux tâches
        self.tasks_lock = threading.Lock()
        
        # Dossier pour stocker les données des tâches
        self.tasks_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "tasks")
        os.makedirs(self.tasks_dir, exist_ok=True)
        
        # Charger les tâches existantes depuis le stockage
        self._load_tasks()
        
    def _load_tasks(self):
        """Charge les tâches depuis le stockage"""
        try:
            for filename in os.listdir(self.tasks_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.tasks_dir, filename)
                    with open(filepath, 'r') as f:
                        task_data = json.load(f)
                        task_id = task_data.get('id')
                        if task_id:
                            self.tasks[task_id] = task_data
        except Exception as e:
            self.logger.error(f"Erreur lors du chargement des tâches: {str(e)}")
    
    def _save_task(self, task_id: str):
        """
        Sauvegarde une tâche dans le stockage
        
        Args:
            task_id (str): ID de la tâche à sauvegarder
        """
        try:
            with self.tasks_lock:
                if task_id in self.tasks:
                    task_data = self.tasks[task_id]
                    filepath = os.path.join(self.tasks_dir, f"{task_id}.json")
                    with open(filepath, 'w') as f:
                        json.dump(task_data, f)
        except Exception as e:
            self.logger.error(f"Erreur lors de la sauvegarde de la tâche {task_id}: {str(e)}")
    
    def create_task(self, description: str, context: Dict = None) -> str:
        """
        Crée une nouvelle tâche
        
        Args:
            description (str): Description de la tâche
            context (Dict, optional): Contexte de la tâche
            
        Returns:
            str: ID de la tâche créée
        """
        task_id = str(uuid.uuid4())
        
        with self.tasks_lock:
            self.tasks[task_id] = {
                "id": task_id,
                "description": description,
                "context": context or {},
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "steps": [],
                "result": None,
                "error": None
            }
        
        # Sauvegarder la tâche
        self._save_task(task_id)
        
        # Lancer l'exécution en arrière-plan
        threading.Thread(target=self._execute_task, args=(task_id,)).start()
        
        return task_id
    
    def _execute_task(self, task_id: str):
        """
        Exécute une tâche en arrière-plan
        
        Args:
            task_id (str): ID de la tâche à exécuter
        """
        try:
            with self.tasks_lock:
                if task_id not in self.tasks:
                    self.logger.error(f"Tâche {task_id} non trouvée")
                    return
                
                # Mettre à jour le statut
                self.tasks[task_id]["status"] = "running"
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
            
            # Sauvegarder la tâche
            self._save_task(task_id)
            
            # Récupérer la description de la tâche
            task_description = self.tasks[task_id]["description"]
            task_context = self.tasks[task_id]["context"]
            
            # Ajouter l'étape de planification
            self._add_task_step(task_id, "planning", "Planification de la tâche", "in_progress")
            
            # Générer un plan pour exécuter la tâche
            planning_prompt = f"""
            Tu dois créer un plan pour effectuer cette tâche:
            
            Description de la tâche: {task_description}
            
            Contexte: {json.dumps(task_context)}
            
            Crée un plan détaillé en 3 à 5 étapes pour accomplir cette tâche. 
            Pour chaque étape, fournis une description détaillée de ce qui doit être fait.
            Retourne le plan sous forme d'une liste d'étapes numérotées.
            """
            
            plan = self.llama_model.generate(planning_prompt)
            
            # Mettre à jour l'étape de planification
            self._update_task_step(task_id, "planning", "completed", result=plan)
            
            # Analyser le plan pour extraire les étapes
            try:
                steps = self._parse_plan(plan)
            except Exception as e:
                self.logger.error(f"Erreur lors de l'analyse du plan: {str(e)}")
                steps = [{"id": "1", "description": "Executer la tâche: " + task_description}]
            
            # Exécuter chaque étape du plan
            final_results = []
            
            for step in steps:
                step_id = step["id"]
                step_desc = step["description"]
                
                # Ajouter l'étape
                self._add_task_step(task_id, f"step_{step_id}", step_desc, "in_progress")
                
                # Exécuter l'étape
                step_result = self._execute_step(task_id, step)
                
                # Mettre à jour l'étape
                self._update_task_step(task_id, f"step_{step_id}", "completed", result=step_result)
                
                # Ajouter le résultat
                final_results.append(step_result)
            
            # Générer le résultat final
            synthesis_prompt = f"""
            Tu dois créer une synthèse finale des résultats obtenus après avoir exécuté les étapes suivantes:
            
            Description de la tâche: {task_description}
            
            Résultats des étapes:
            {json.dumps(final_results)}
            
            Crée une synthèse détaillée qui résume ce qui a été accompli, les informations importantes découvertes,
            et toute conclusion pertinente. Sois concis mais complet.
            """
            
            final_result = self.llama_model.generate(synthesis_prompt)
            
            with self.tasks_lock:
                self.tasks[task_id]["status"] = "completed"
                self.tasks[task_id]["result"] = final_result
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
            
            # Sauvegarder la tâche
            self._save_task(task_id)
            
            # Stocker le résultat dans la mémoire
            self.memory_manager.store(
                content=final_result,
                metadata={
                    "type": "task_result",
                    "task_id": task_id,
                    "description": task_description
                }
            )
            
        except Exception as e:
            self.logger.error(f"Erreur lors de l'exécution de la tâche {task_id}: {str(e)}")
            
            with self.tasks_lock:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
            
            # Sauvegarder la tâche
            self._save_task(task_id)
    
    def _parse_plan(self, plan_text: str) -> List[Dict[str, str]]:
        """
        Parse le texte du plan pour extraire les étapes
        
        Args:
            plan_text (str): Texte du plan
            
        Returns:
            List[Dict[str, str]]: Liste des étapes
        """
        steps = []
        
        # Tentative simple de parse: chercher des lignes commençant par des chiffres
        lines = plan_text.strip().split('\n')
        current_step = None
        current_desc = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Chercher une ligne commençant par un numéro et un séparateur
            import re
            step_match = re.match(r'^(\d+)[\s.:\)-]+(.+)$', line)
            
            if step_match:
                # Si on avait déjà une étape en cours, l'ajouter
                if current_step:
                    steps.append({
                        "id": current_step,
                        "description": ' '.join(current_desc)
                    })
                
                # Commencer une nouvelle étape
                current_step = step_match.group(1)
                current_desc = [step_match.group(2)]
            elif current_step:
                # Continuer la description de l'étape en cours
                current_desc.append(line)
        
        # Ajouter la dernière étape
        if current_step:
            steps.append({
                "id": current_step,
                "description": ' '.join(current_desc)
            })
            
        # Si aucune étape n'a été trouvée, créer une seule étape avec tout le texte
        if not steps:
            steps.append({
                "id": "1",
                "description": plan_text
            })
            
        return steps
    
    def _execute_step(self, task_id: str, step: Dict[str, str]) -> str:
        """
        Exécute une étape d'une tâche
        
        Args:
            task_id (str): ID de la tâche
            step (Dict[str, str]): Étape à exécuter
            
        Returns:
            str: Résultat de l'étape
        """
        step_description = step["description"]
        
        # Déterminer si cette étape nécessite une recherche web
        needs_research = any(keyword in step_description.lower() 
                           for keyword in ["recherche", "chercher", "trouver", "web", "internet", "informations"])
        
        if needs_research:
            # Extraire les mots-clés pour la recherche
            research_prompt = f"""
            Extrais les mots-clés importants pour effectuer une recherche web à partir de cette description:
            
            {step_description}
            
            Retourne simplement les mots-clés séparés par des espaces, sans ponctuation ni phrases complètes.
            """
            
            keywords = self.llama_model.generate(research_prompt)
            
            # Effectuer la recherche
            research_results = self.web_researcher.research(keywords)
            
            # Extraire les informations pertinentes des résultats
            if research_results["pages"]:
                content = "\n\n".join([f"Titre: {page['title']}\nContenu: {page['content'][:1000]}..." 
                                     for page in research_results["pages"]])
                
                extraction_prompt = f"""
                Extrais les informations pertinentes pour accomplir cette tâche:
                
                Tâche: {step_description}
                
                Contenu des pages web:
                {content}
                
                Résume les informations les plus importantes et pertinentes pour la tâche.
                """
                
                result = self.llama_model.generate(extraction_prompt)
            else:
                result = "Aucune information pertinente trouvée via la recherche web."
        else:
            # Générer une réponse directe
            execution_prompt = f"""
            Tu dois exécuter cette tâche:
            
            {step_description}
            
            Fournis une réponse détaillée qui accomplit pleinement cette tâche.
            """
            
            result = self.llama_model.generate(execution_prompt)
        
        return result
    
    def _add_task_step(self, task_id: str, step_id: str, description: str, status: str):
        """
        Ajoute une étape à une tâche
        
        Args:
            task_id (str): ID de la tâche
            step_id (str): ID de l'étape
            description (str): Description de l'étape
            status (str): Statut de l'étape
        """
        with self.tasks_lock:
            if task_id in self.tasks:
                step = {
                    "id": step_id,
                    "description": description,
                    "status": status,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "result": None
                }
                
                self.tasks[task_id]["steps"].append(step)
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
                
        # Sauvegarder la tâche
        self._save_task(task_id)
    
    def _update_task_step(self, task_id: str, step_id: str, status: str, result: str = None):
        """
        Met à jour une étape d'une tâche
        
        Args:
            task_id (str): ID de la tâche
            step_id (str): ID de l'étape
            status (str): Nouveau statut de l'étape
            result (str, optional): Résultat de l'étape
        """
        with self.tasks_lock:
            if task_id in self.tasks:
                for step in self.tasks[task_id]["steps"]:
                    if step["id"] == step_id:
                        step["status"] = status
                        step["updated_at"] = datetime.now().isoformat()
                        
                        if result is not None:
                            step["result"] = result
                
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
                
        # Sauvegarder la tâche
        self._save_task(task_id)
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Récupère une tâche
        
        Args:
            task_id (str): ID de la tâche
            
        Returns:
            Optional[Dict[str, Any]]: Données de la tâche ou None si elle n'existe pas
        """
        with self.tasks_lock:
            return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """
        Récupère toutes les tâches
        
        Returns:
            List[Dict[str, Any]]: Liste des tâches
        """
        with self.tasks_lock:
            return list(self.tasks.values())
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Annule une tâche
        
        Args:
            task_id (str): ID de la tâche à annuler
            
        Returns:
            bool: True si la tâche a été annulée, False sinon
        """
        with self.tasks_lock:
            if task_id in self.tasks and self.tasks[task_id]["status"] == "running":
                self.tasks[task_id]["status"] = "cancelled"
                self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
                
                # Sauvegarder la tâche
                self._save_task(task_id)
                
                return True
            
            return False
    
    def status(self) -> Dict[str, Any]:
        """
        Retourne le statut du gestionnaire de tâches
        
        Returns:
            Dict[str, Any]: Informations sur le statut
        """
        with self.tasks_lock:
            total_tasks = len(self.tasks)
            pending_tasks = sum(1 for task in self.tasks.values() if task["status"] == "pending")
            running_tasks = sum(1 for task in self.tasks.values() if task["status"] == "running")
            completed_tasks = sum(1 for task in self.tasks.values() if task["status"] == "completed")
            failed_tasks = sum(1 for task in self.tasks.values() if task["status"] == "failed")
        
        return {
            "status": "active",
            "total_tasks": total_tasks,
            "pending_tasks": pending_tasks,
            "running_tasks": running_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks
        }