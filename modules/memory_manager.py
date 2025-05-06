import logging
import uuid
import os
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import threading

class MemoryManager:
    """
    Classe pour la gestion de la mémoire à long terme de l'agent
    """
    
    def __init__(self, vectordb_enabled: bool = False):
        """
        Initialise le gestionnaire de mémoire
        
        Args:
            vectordb_enabled (bool): Activer la base de données vectorielle pour la recherche sémantique
        """
        self.logger = logging.getLogger(__name__)
        
        # Dictionnaire pour stocker les mémoires
        self.memories = {}
        
        # Verrouillage pour l'accès aux mémoires
        self.memories_lock = threading.Lock()
        
        # Dossier pour stocker les données des mémoires
        self.memories_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "memories")
        os.makedirs(self.memories_dir, exist_ok=True)
        
        # Base de données vectorielle (si activée)
        self.vectordb_enabled = vectordb_enabled
        self.vectordb = None
        
        if vectordb_enabled:
            try:
                self._initialize_vectordb()
            except Exception as e:
                self.logger.error(f"Erreur lors de l'initialisation de la base de données vectorielle: {str(e)}")
                self.vectordb_enabled = False
        
        # Charger les mémoires existantes depuis le stockage
        self._load_memories()
        
    def _initialize_vectordb(self):
        """Initialise la base de données vectorielle pour la recherche sémantique"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Créer un dossier pour la base de données
            db_dir = os.path.join(self.memories_dir, "vectordb")
            os.makedirs(db_dir, exist_ok=True)
            
            # Initialiser la base de données avec télémétrie désactivée
            self.vectordb = chromadb.PersistentClient(
                path=db_dir,
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.vectordb.get_or_create_collection("memories")
            
            self.logger.info("Base de données vectorielle initialisée avec succès")
            
        except ImportError:
            self.logger.warning("chromadb n'est pas disponible. La recherche sémantique sera désactivée.")
            self.vectordb_enabled = False
        except Exception as e:
            self.logger.error(f"Erreur lors de l'initialisation de la base de données vectorielle: {str(e)}")
            self.vectordb_enabled = False
    
    def _load_memories(self):
        """Charge les mémoires depuis le stockage"""
        try:
            for filename in os.listdir(self.memories_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.memories_dir, filename)
                    with open(filepath, 'r') as f:
                        memory_data = json.load(f)
                        memory_id = memory_data.get('id')
                        if memory_id:
                            self.memories[memory_id] = memory_data
        except Exception as e:
            self.logger.error(f"Erreur lors du chargement des mémoires: {str(e)}")
    
    def _save_memory(self, memory_id: str):
        """
        Sauvegarde une mémoire dans le stockage
        
        Args:
            memory_id (str): ID de la mémoire à sauvegarder
        """
        try:
            with self.memories_lock:
                if memory_id in self.memories:
                    memory_data = self.memories[memory_id]
                    filepath = os.path.join(self.memories_dir, f"{memory_id}.json")
                    with open(filepath, 'w') as f:
                        json.dump(memory_data, f)
        except Exception as e:
            self.logger.error(f"Erreur lors de la sauvegarde de la mémoire {memory_id}: {str(e)}")
    
    def store(self, content: str, metadata: Dict = None) -> str:
        """
        Stocke un contenu dans la mémoire
        
        Args:
            content (str): Contenu à stocker
            metadata (Dict, optional): Métadonnées associées au contenu
            
        Returns:
            str: ID de la mémoire créée
        """
        memory_id = str(uuid.uuid4())
        
        with self.memories_lock:
            self.memories[memory_id] = {
                "id": memory_id,
                "content": content,
                "metadata": metadata or {},
                "created_at": datetime.now().isoformat(),
                "last_accessed": datetime.now().isoformat(),
                "access_count": 0
            }
        
        # Sauvegarder la mémoire
        self._save_memory(memory_id)
        
        # Ajouter à la base de données vectorielle si activée
        if self.vectordb_enabled and self.collection is not None:
            try:
                self.collection.add(
                    ids=[memory_id],
                    documents=[content],
                    metadatas=[metadata or {}]
                )
                self.logger.info(f"Mémoire {memory_id} ajoutée à la base de données vectorielle")
            except Exception as e:
                self.logger.error(f"Erreur lors de l'ajout à la base de données vectorielle: {str(e)}")
        
        return memory_id
    
    def get(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """
        Récupère une mémoire par son ID
        
        Args:
            memory_id (str): ID de la mémoire
            
        Returns:
            Optional[Dict[str, Any]]: Données de la mémoire ou None si elle n'existe pas
        """
        with self.memories_lock:
            if memory_id in self.memories:
                # Mettre à jour les statistiques d'accès
                self.memories[memory_id]["last_accessed"] = datetime.now().isoformat()
                self.memories[memory_id]["access_count"] += 1
                
                # Sauvegarder les changements
                self._save_memory(memory_id)
                
                return self.memories[memory_id]
            
            return None
    
    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Recherche des mémoires par similarité sémantique
        
        Args:
            query (str): Requête de recherche
            limit (int): Nombre maximal de résultats
            
        Returns:
            List[Dict[str, Any]]: Liste de mémoires correspondantes
        """
        results = []
        
        # Si la base de données vectorielle est activée, utiliser la recherche sémantique
        if self.vectordb_enabled and self.collection is not None:
            try:
                query_results = self.collection.query(
                    query_texts=[query],
                    n_results=limit
                )
                
                if query_results and query_results.get("ids") and len(query_results["ids"]) > 0:
                    for memory_id in query_results["ids"][0]:
                        memory = self.get(memory_id)
                        if memory:
                            results.append(memory)
                            
                return results
                
            except Exception as e:
                self.logger.error(f"Erreur lors de la recherche sémantique: {str(e)}")
                # Continuer avec la recherche par mots-clés
        
        # Recherche par mots-clés (fallback)
        query_terms = query.lower().split()
        
        with self.memories_lock:
            for memory_id, memory in self.memories.items():
                content = memory["content"].lower()
                metadata_str = json.dumps(memory["metadata"]).lower()
                
                # Calculer un score simple basé sur le nombre de termes trouvés
                score = sum(1 for term in query_terms if term in content or term in metadata_str)
                
                if score > 0:
                    results.append({**memory, "_score": score})
        
        # Trier par score et limiter le nombre de résultats
        results = sorted(results, key=lambda x: x.get("_score", 0), reverse=True)[:limit]
        
        # Mettre à jour les statistiques d'accès pour les résultats
        for memory in results:
            memory_id = memory["id"]
            if "_score" in memory:
                del memory["_score"]
            
            # Mettre à jour les statistiques
            with self.memories_lock:
                if memory_id in self.memories:
                    self.memories[memory_id]["last_accessed"] = datetime.now().isoformat()
                    self.memories[memory_id]["access_count"] += 1
                    
                    # Sauvegarder les changements
                    self._save_memory(memory_id)
        
        return results
    
    def update(self, memory_id: str, content: str = None, metadata: Dict = None) -> bool:
        """
        Met à jour une mémoire existante
        
        Args:
            memory_id (str): ID de la mémoire
            content (str, optional): Nouveau contenu
            metadata (Dict, optional): Nouvelles métadonnées
            
        Returns:
            bool: True si la mise à jour a réussi, False sinon
        """
        with self.memories_lock:
            if memory_id in self.memories:
                if content is not None:
                    self.memories[memory_id]["content"] = content
                
                if metadata is not None:
                    # Fusionner les métadonnées existantes avec les nouvelles
                    self.memories[memory_id]["metadata"].update(metadata)
                
                # Mettre à jour la date de dernière modification
                self.memories[memory_id]["updated_at"] = datetime.now().isoformat()
                
                # Sauvegarder les changements
                self._save_memory(memory_id)
                
                # Mettre à jour la base de données vectorielle si activée
                if self.vectordb_enabled and self.collection is not None and content is not None:
                    try:
                        self.collection.update(
                            ids=[memory_id],
                            documents=[content],
                            metadatas=[self.memories[memory_id]["metadata"]]
                        )
                    except Exception as e:
                        self.logger.error(f"Erreur lors de la mise à jour dans la base de données vectorielle: {str(e)}")
                
                return True
            
            return False
    
    def delete(self, memory_id: str) -> bool:
        """
        Supprime une mémoire
        
        Args:
            memory_id (str): ID de la mémoire
            
        Returns:
            bool: True si la suppression a réussi, False sinon
        """
        with self.memories_lock:
            if memory_id in self.memories:
                del self.memories[memory_id]
                
                # Supprimer le fichier
                filepath = os.path.join(self.memories_dir, f"{memory_id}.json")
                if os.path.exists(filepath):
                    os.remove(filepath)
                
                # Supprimer de la base de données vectorielle si activée
                if self.vectordb_enabled and self.collection is not None:
                    try:
                        self.collection.delete(ids=[memory_id])
                    except Exception as e:
                        self.logger.error(f"Erreur lors de la suppression de la base de données vectorielle: {str(e)}")
                
                return True
            
            return False
    
    def get_all_memories(self) -> List[Dict[str, Any]]:
        """
        Récupère toutes les mémoires
        
        Returns:
            List[Dict[str, Any]]: Liste de toutes les mémoires
        """
        with self.memories_lock:
            return list(self.memories.values())
    
    def cleanup(self, max_age_days: int = 30) -> int:
        """
        Nettoie les mémoires anciennes et peu utilisées
        
        Args:
            max_age_days (int): Âge maximal en jours
            
        Returns:
            int: Nombre de mémoires supprimées
        """
        count = 0
        current_time = datetime.now()
        max_age = current_time.timestamp() - (max_age_days * 24 * 60 * 60)
        
        with self.memories_lock:
            to_delete = []
            
            for memory_id, memory in self.memories.items():
                # Convertir la date de création en timestamp
                try:
                    created_at = datetime.fromisoformat(memory["created_at"]).timestamp()
                except ValueError:
                    # Si le format de date n'est pas valide, utiliser la date actuelle
                    created_at = current_time.timestamp()
                
                # Si la mémoire est ancienne et a été peu consultée, la supprimer
                if created_at < max_age and memory.get("access_count", 0) < 5:
                    to_delete.append(memory_id)
            
            # Supprimer les mémoires sélectionnées
            for memory_id in to_delete:
                self.delete(memory_id)
                count += 1
        
        return count
    
    def status(self) -> Dict[str, Any]:
        """
        Retourne le statut du gestionnaire de mémoire
        
        Returns:
            Dict[str, Any]: Informations sur le statut
        """
        with self.memories_lock:
            total_memories = len(self.memories)
            
            # Calculer des statistiques sur les métadonnées
            metadata_types = {}
            for memory in self.memories.values():
                memory_type = memory.get("metadata", {}).get("type")
                if memory_type:
                    metadata_types[memory_type] = metadata_types.get(memory_type, 0) + 1
        
        return {
            "status": "active",
            "total_memories": total_memories,
            "vectordb_enabled": self.vectordb_enabled,
            "memory_types": metadata_types
        }