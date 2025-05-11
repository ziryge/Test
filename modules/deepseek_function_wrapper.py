import json
import re
from typing import Any, Dict, List, Optional, Union

from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_ollama import ChatOllama

class DeepseekFunctionWrapper(BaseChatModel):
    """Wrapper around Deepseek-r1 model to enable function calling with Ollama."""
    
    def __init__(self, model_name: str = "deepseek-r1:14b", 
                 base_url: str = "http://localhost:11434",
                 system_prompt: Optional[str] = None,
                 **kwargs):
        """Initialize the DeepseekFunctionWrapper."""
        self.model_name = model_name
        self.base_url = base_url
        self.ollama_model = ChatOllama(
            model=model_name,
            base_url=base_url,
            num_ctx=32000,
            **kwargs
        )
        
        if system_prompt is None:
            self.system_prompt = (
                "You are an AI agent that controls a web browser. "
                "When given tasks, you will analyze them and interact with web elements appropriately. "
                "You must carefully follow these function calling guidelines:\n\n"
                "1. When you need to perform a browser action, use the provided functions.\n"
                "2. Call functions using the format: <function_call>function_name(param1=\"value1\", param2=\"value2\")</function_call>\n"
                "3. Wait for function results before planning your next action.\n"
                "4. IMPORTANT: Always wrap function calls in <function_call></function_call> tags.\n"
                "5. Available functions: navigate(url), click(selector), type(selector, text), extract_text(selector)\n\n"
                "Example: <function_call>navigate(url=\"https://www.google.com\")</function_call>"
            )
        else:
            self.system_prompt = system_prompt
    
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Generate a chat response with function calling support."""
        
        # Prepare messages including system prompt
        processed_messages = [SystemMessage(content=self.system_prompt)]
        
        # Process messages for function calls
        for message in messages:
            if message.type == "system":
                # Skip as we already provided a system message
                continue
            elif hasattr(message, "function_call") and message.function_call:
                # If there was a function call, format it specially for Deepseek
                function_name = message.function_call.get("name", "")
                function_args = message.function_call.get("arguments", "{}")
                
                # Format as text in our special format
                args_str = ", ".join([f'{k}="{v}"' for k, v in json.loads(function_args).items()])
                function_text = f"<function_call>{function_name}({args_str})</function_call>"
                
                # Add the function call as part of the user message
                if message.type == "user":
                    processed_messages.append(message)
            else:
                # Regular message
                processed_messages.append(message)
        
        # Generate response from Ollama
        ollama_response = self.ollama_model._generate(processed_messages, stop=stop, **kwargs)
        
        # Process the response to extract function calls
        generations = []
        for gen in ollama_response.generations:
            text = gen.text
            
            # Check for function calls in the format <function_call>function_name(params)</function_call>
            function_call_match = re.search(r'<function_call>(.*?)\((.*?)\)</function_call>', text)
            if function_call_match:
                # Extract function name and arguments
                function_name = function_call_match.group(1).strip()
                args_text = function_call_match.group(2).strip()
                
                # Parse arguments
                args_dict = {}
                if args_text:
                    # Match key=value pairs
                    args_matches = re.findall(r'(\w+)=(?:"([^"]*?)"|\'([^\']*?)\')', args_text)
                    for match in args_matches:
                        key = match[0]
                        # Value is either in group 1 or 2 depending on quote type
                        value = match[1] if match[1] else match[2]
                        args_dict[key] = value
                
                # Create a function call structure similar to OpenAI format
                function_call = {
                    "name": function_name,
                    "arguments": json.dumps(args_dict)
                }
                
                # Create a new AIMessage with function_call
                message = AIMessage(
                    content=text.replace(function_call_match.group(0), "").strip(),
                    additional_kwargs={"function_call": function_call}
                )
                generations.append(ChatGeneration(message=message))
            else:
                # No function call, just a regular response
                generations.append(gen)
        
        return ChatResult(generations=generations)
    
    @property
    def _llm_type(self) -> str:
        """Return type of llm."""
        return "deepseek-function-wrapper"
