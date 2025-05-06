import os
import logging
import json
from typing import Dict, List, Any, Optional, Union
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from langchain_community.llms import HuggingFacePipeline
from langchain_community.llms import Ollama
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

class LlamaModel:
    """
    Classe d'intégration pour les modèles de langage avancés (Llama, DeepSeek, etc.)
    """

    def __init__(self, model_name: str = "meta-llama/Meta-Llama-3.2-8B",
                 device: str = "auto",
                 streaming: bool = False,
                 max_new_tokens: int = 512,
                 temperature: float = 0.7,
                 top_p: float = 0.9,
                 system_prompt: str = "Tu es un assistant IA avancé conçu pour aider les utilisateurs avec diverses tâches."):
        """
        Initialise le modèle

        Args:
            model_name (str): Nom du modèle à charger
            device (str): Périphérique à utiliser (cpu, cuda, auto)
            streaming (bool): Activer le streaming de sortie
            max_new_tokens (int): Nombre maximal de tokens à générer
            temperature (float): Température pour la génération
            top_p (float): Paramètre top_p pour la génération
            system_prompt (str): Prompt système par défaut
        """
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Initialisation du modèle: {model_name}")

        self.model_name = model_name
        self.device = device if device != "auto" else "cuda" if torch.cuda.is_available() else "cpu"
        self.streaming = streaming
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.top_p = top_p
        self.system_prompt = system_prompt

        try:
            self._initialize_model()
            self.logger.info(f"Modèle initialisé avec succès sur {self.device}")
        except Exception as e:
            self.logger.error(f"Erreur lors de l'initialisation du modèle: {str(e)}")
            raise

    def _initialize_model(self):
        """Initialise le modèle et le tokenizer"""
        try:
            # Pour les cas où nous utilisons Ollama
            if os.environ.get("USE_OLLAMA") == "true":
                model_name = self.model_name.split('/')[-1]
                # Si le modèle est spécifié dans OLLAMA_MODEL, l'utiliser en priorité
                ollama_model = os.environ.get("OLLAMA_MODEL", model_name)

                self.logger.info(f"Initialisation du modèle Ollama: {ollama_model}")

                # Configuration spécifique pour DeepSeek via Ollama
                if "deepseek" in ollama_model.lower():
                    self.logger.info(f"Utilisation du modèle DeepSeek via Ollama: {ollama_model}")

                # Création du modèle Ollama
                try:
                    self.ollama_model = Ollama(
                        model=ollama_model,
                        temperature=self.temperature,
                        top_p=self.top_p
                    )
                    self.using_ollama = True
                    self.logger.info(f"Modèle Ollama {ollama_model} initialisé avec succès")
                    return
                except Exception as ollama_error:
                    self.logger.error(f"Erreur lors de l'initialisation d'Ollama: {str(ollama_error)}")
                    self.logger.warning("Tentative de repli sur le modèle local...")
                    # Continuer avec l'initialisation du modèle local

            self.using_ollama = False

            # Déterminer si nous utilisons DeepSeek
            is_deepseek = "deepseek" in self.model_name.lower()

            # Chargement du tokenizer et du modèle
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True
            )

            # Configuration spécifique pour DeepSeek
            if is_deepseek:
                self.logger.info(f"Utilisation du modèle DeepSeek local: {self.model_name}")
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                    device_map=self.device,
                    trust_remote_code=True
                )
            else:
                # Configuration standard pour les autres modèles
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                    device_map=self.device,
                    load_in_8bit=self.device != "cpu",
                    trust_remote_code=True
                )

            # Configuration des callbacks pour le streaming
            callbacks = CallbackManager([StreamingStdOutCallbackHandler()]) if self.streaming else None

            # Création du pipeline
            self.pipe = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                max_new_tokens=self.max_new_tokens,
                temperature=self.temperature,
                top_p=self.top_p,
                callback_manager=callbacks if self.streaming else None
            )

            # Intégration avec LangChain
            self.langchain_llm = HuggingFacePipeline(pipeline=self.pipe)

        except Exception as e:
            self.logger.error(f"Erreur lors de l'initialisation du modèle: {str(e)}")
            raise

    def generate(self, prompt: str, max_tokens: int = None,
                 temperature: float = None, system_prompt: str = None) -> str:
        """
        Génère une réponse à partir d'un prompt

        Args:
            prompt (str): Prompt à traiter
            max_tokens (int, optional): Nombre maximal de tokens à générer
            temperature (float, optional): Température pour la génération
            system_prompt (str, optional): Prompt système à utiliser

        Returns:
            str: Réponse générée
        """
        try:
            # Utilisation des valeurs par défaut si non spécifiées
            max_tokens = max_tokens or self.max_new_tokens
            temperature = temperature or self.temperature
            system_prompt = system_prompt or self.system_prompt

            # Formatage du prompt
            formatted_prompt = f"{system_prompt}\n\nUtilisateur: {prompt}\n\nAssistant:"

            if self.using_ollama:
                response = self.ollama_model.invoke(formatted_prompt)
                return response

            # Génération de la réponse
            response = self.pipe(
                formatted_prompt,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True
            )[0]["generated_text"]

            # Extraction de la réponse après "Assistant:"
            if "Assistant:" in response:
                response = response.split("Assistant:", 1)[1].strip()

            return response

        except Exception as e:
            self.logger.error(f"Erreur lors de la génération: {str(e)}")
            return f"Erreur lors de la génération: {str(e)}"

    def chat(self, messages: List[Dict[str, str]]) -> str:
        """
        Gestion de conversation en format chat

        Args:
            messages (List[Dict[str, str]]): Liste de messages au format
                [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]

        Returns:
            str: Réponse générée
        """
        try:
            # Conversion des messages en une chaîne formatée
            prompt = self.system_prompt + "\n\n"

            for msg in messages:
                role = msg["role"]
                content = msg["content"]

                if role == "user":
                    prompt += f"Utilisateur: {content}\n\n"
                elif role == "assistant":
                    prompt += f"Assistant: {content}\n\n"
                elif role == "system":
                    prompt += f"{content}\n\n"

            prompt += "Assistant:"

            if self.using_ollama:
                response = self.ollama_model.invoke(prompt)
                return response

            # Génération de la réponse
            response = self.pipe(
                prompt,
                max_new_tokens=self.max_new_tokens,
                temperature=self.temperature,
                do_sample=True
            )[0]["generated_text"]

            # Extraction de la réponse
            if "Assistant:" in response:
                parts = response.split("Assistant:")
                if len(parts) > 1:
                    # Prendre la dernière occurrence de "Assistant:"
                    response = parts[-1].strip()

            return response

        except Exception as e:
            self.logger.error(f"Erreur lors du chat: {str(e)}")
            return f"Erreur lors du chat: {str(e)}"

    def stream(self, prompt: str, max_tokens: int = None,
                temperature: float = None, system_prompt: str = None):
        """
        Génère une réponse à partir d'un prompt en mode streaming

        Args:
            prompt (str): Prompt à traiter
            max_tokens (int, optional): Nombre maximal de tokens à générer
            temperature (float, optional): Température pour la génération
            system_prompt (str, optional): Prompt système à utiliser

        Yields:
            str: Morceaux de texte générés
        """
        try:
            # Utilisation des valeurs par défaut si non spécifiées
            max_tokens = max_tokens or self.max_new_tokens
            temperature = temperature or self.temperature
            system_prompt = system_prompt or self.system_prompt

            # Formatage du prompt
            formatted_prompt = f"{system_prompt}\n\nUtilisateur: {prompt}\n\nAssistant:"

            if self.using_ollama:
                # Utiliser l'API de streaming d'Ollama
                import requests
                import json

                # Configuration de la requête Ollama
                ollama_url = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
                api_url = f"{ollama_url}/api/generate"

                # Modèle à utiliser
                ollama_model = os.environ.get("OLLAMA_MODEL", self.model_name.split('/')[-1])

                # Paramètres de la requête
                data = {
                    "model": ollama_model,
                    "prompt": formatted_prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "top_p": self.top_p,
                        "num_predict": max_tokens
                    }
                }

                # Envoi de la requête en streaming
                response = requests.post(api_url, json=data, stream=True)

                # Traitement de la réponse en streaming
                for line in response.iter_lines():
                    if line:
                        try:
                            chunk_data = json.loads(line)
                            if "response" in chunk_data:
                                yield chunk_data["response"]

                            # Si c'est la fin de la génération, sortir de la boucle
                            if chunk_data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            self.logger.error(f"Erreur de décodage JSON: {line}")
                            continue
            else:
                # Pour les modèles locaux, simuler le streaming
                # Note: Cette implémentation est simplifiée et ne fait pas de vrai streaming
                response = self.generate(prompt, max_tokens, temperature, system_prompt)

                # Simuler le streaming en divisant la réponse en morceaux
                words = response.split()
                for i in range(0, len(words), 3):  # Envoyer 3 mots à la fois
                    chunk = " ".join(words[i:i+3])
                    yield chunk + " "

        except Exception as e:
            self.logger.error(f"Erreur lors du streaming: {str(e)}")
            yield f"Erreur lors du streaming: {str(e)}"

    def status(self) -> Dict[str, Any]:
        """
        Retourne le statut du modèle

        Returns:
            Dict[str, Any]: Informations sur le statut du modèle
        """
        status_info = {
            "model_name": self.model_name,
            "device": self.device,
            "status": "active",
            "max_new_tokens": self.max_new_tokens,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "using_ollama": getattr(self, "using_ollama", False),
            "supports_streaming": True
        }

        # Ajouter des informations spécifiques à Ollama si utilisé
        if getattr(self, "using_ollama", False):
            ollama_model = os.environ.get("OLLAMA_MODEL", self.model_name.split('/')[-1])
            status_info["ollama_model"] = ollama_model
            status_info["model_display_name"] = ollama_model

            # Informations spécifiques pour DeepSeek
            if "deepseek" in ollama_model.lower():
                status_info["model_type"] = "DeepSeek"
                status_info["model_variant"] = "r1:14b" if "r1:14b" in ollama_model else "unknown"

        return status_info