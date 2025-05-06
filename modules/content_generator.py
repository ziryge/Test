import logging
import json
from typing import Dict, List, Any, Optional
import re

class ContentGenerator:
    """
    Classe pour générer différents types de contenu avec le modèle Llama
    """
    
    def __init__(self, llama_model):
        """
        Initialise le générateur de contenu
        
        Args:
            llama_model: Instance du modèle Llama
        """
        self.logger = logging.getLogger(__name__)
        self.llama_model = llama_model
        
    def generate(self, prompt: str, max_tokens: int = 500, context: Dict = None) -> str:
        """
        Génère du contenu à partir d'un prompt
        
        Args:
            prompt (str): Prompt à utiliser
            max_tokens (int): Nombre maximal de tokens à générer
            context (Dict, optional): Contexte supplémentaire
            
        Returns:
            str: Contenu généré
        """
        try:
            # Ajouter le contexte au prompt si présent
            if context:
                full_prompt = f"Contexte:\n{json.dumps(context)}\n\nPrompt: {prompt}"
            else:
                full_prompt = prompt
            
            # Générer le contenu
            content = self.llama_model.generate(full_prompt, max_tokens=max_tokens)
            
            return content
            
        except Exception as e:
            self.logger.error(f"Erreur lors de la génération de contenu: {str(e)}")
            return f"Erreur lors de la génération: {str(e)}"
    
    def generate_text(self, topic: str, style: str = "informatif", length: str = "moyen") -> str:
        """
        Génère un texte sur un sujet donné
        
        Args:
            topic (str): Sujet du texte
            style (str): Style d'écriture (informatif, créatif, technique, etc.)
            length (str): Longueur du texte (court, moyen, long)
            
        Returns:
            str: Texte généré
        """
        # Convertir la longueur en nombre de tokens approximatif
        token_limits = {
            "court": 150,
            "moyen": 300,
            "long": 500
        }
        max_tokens = token_limits.get(length.lower(), 300)
        
        prompt = f"""
        Génère un texte {style} sur le sujet: {topic}.
        
        Le texte devrait être {length} et d'un style {style}.
        """
        
        return self.generate(prompt, max_tokens=max_tokens)
    
    def generate_summary(self, text: str, max_length: int = 200) -> str:
        """
        Génère un résumé d'un texte
        
        Args:
            text (str): Texte à résumer
            max_length (int): Longueur maximale du résumé en tokens
            
        Returns:
            str: Résumé généré
        """
        if len(text) > 8000:
            # Limiter la longueur du texte pour éviter les problèmes de contexte
            text = text[:8000] + "..."
            
        prompt = f"""
        Résume le texte suivant de manière concise mais complète:
        
        {text}
        
        Résumé:
        """
        
        return self.generate(prompt, max_tokens=max_length)
    
    def generate_code(self, task_description: str, language: str, framework: str = None) -> str:
        """
        Génère du code pour une tâche donnée
        
        Args:
            task_description (str): Description de la tâche
            language (str): Langage de programmation
            framework (str, optional): Framework à utiliser
            
        Returns:
            str: Code généré
        """
        framework_str = f"en utilisant le framework {framework}" if framework else ""
        
        prompt = f"""
        Écris du code {language} {framework_str} pour accomplir la tâche suivante:
        
        {task_description}
        
        Le code doit être propre, bien commenté et suivre les meilleures pratiques.
        
        ```{language.lower()}
        """
        
        raw_response = self.generate(prompt, max_tokens=800)
        
        # Extraire le bloc de code
        code_pattern = rf"```{language.lower()}(.*?)```"
        code_match = re.search(code_pattern, raw_response, re.DOTALL)
        
        if code_match:
            return code_match.group(1).strip()
        else:
            # Si le pattern n'est pas trouvé, retourner la réponse complète
            return raw_response
    
    def generate_structured_response(self, query: str, format_type: str = "json") -> str:
        """
        Génère une réponse structurée
        
        Args:
            query (str): Requête à traiter
            format_type (str): Format de sortie (json, yaml, etc.)
            
        Returns:
            str: Réponse structurée
        """
        if format_type.lower() == "json":
            prompt = f"""
            Réponds à la requête suivante et formate ta réponse en JSON valide:
            
            {query}
            
            Réponse (JSON):
            ```json
            """
            
            raw_response = self.generate(prompt, max_tokens=500)
            
            # Extraire le JSON
            json_pattern = r"```json(.*?)```"
            json_match = re.search(json_pattern, raw_response, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(1).strip()
                
                # Vérifier si le JSON est valide
                try:
                    json.loads(json_str)
                    return json_str
                except:
                    return raw_response
            else:
                return raw_response
        else:
            # Autres formats pourraient être implémentés ici
            return self.generate(query, max_tokens=500)
    
    def generate_conversation(self, topic: str, participants: List[str], turns: int = 3) -> List[Dict[str, str]]:
        """
        Génère une conversation sur un sujet donné
        
        Args:
            topic (str): Sujet de la conversation
            participants (List[str]): Liste des participants
            turns (int): Nombre de tours de parole par participant
            
        Returns:
            List[Dict[str, str]]: Conversation générée
        """
        prompt = f"""
        Génère une conversation naturelle sur le sujet: {topic}
        
        Participants: {', '.join(participants)}
        
        La conversation doit avoir {turns} tours de parole par participant et être cohérente et naturelle.
        Format: liste de JSON avec "speaker" et "message".
        
        ```json
        [
        """
        
        raw_response = self.generate(prompt, max_tokens=800)
        
        # Extraire le JSON
        json_pattern = r"\[(.*?)\]"
        json_match = re.search(json_pattern, raw_response, re.DOTALL)
        
        if json_match:
            json_str = "[" + json_match.group(1).strip() + "]"
            
            # Nettoyer et corriger le JSON si nécessaire
            json_str = json_str.replace("'", '"')
            
            try:
                conversation = json.loads(json_str)
                return conversation
            except:
                # En cas d'erreur, retourner un format simplifié
                return [{"speaker": p, "message": f"Discute sur {topic}"} for p in participants]
        else:
            # En cas d'erreur, retourner un format simplifié
            return [{"speaker": p, "message": f"Discute sur {topic}"} for p in participants]
    
    def status(self) -> Dict[str, Any]:
        """
        Retourne le statut du générateur de contenu
        
        Returns:
            Dict[str, Any]: Informations sur le statut
        """
        return {
            "status": "active",
            "model": self.llama_model.model_name if hasattr(self.llama_model, "model_name") else "unknown"
        }