#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import requests
import logging

logger = logging.getLogger(__name__)

class MiniMaxClient:
    def __init__(self):
        self.group_id = os.getenv('MINIMAX_GROUP_ID')
        self.api_key = os.getenv('MINIMAX_API_KEY')
        self.base_url = "https://api.minimaxi.com/v1"
        
        if not self.group_id or not self.api_key:
            raise ValueError("MINIMAX_GROUP_ID and MINIMAX_API_KEY must be set as environment variables")
        
        logger.info(f"MiniMax client initialized (Group ID: {self.group_id[:8]}...)")

    def chat(self, message: str, model: str = "M2-her",
             system_prompt: str = None, temperature: float = 0.7,
             max_tokens: int = 2048) -> str:
        """
        Intelligent dialogue
        
        Args:
            message: User message content
            model: Model name (default: M2-her)
            system_prompt: System prompt defining AI role
            temperature: Temperature parameter (0.0-1.0, recommend 1.0)
            max_tokens: Max tokens to generate, M2-her limit is 2048
            
        Returns:
            AI response text
        """
        endpoint = "text/chatcompletion_v2"
        
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": message})
        
        data = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        logger.info(f"Calling MiniMax API: model={model}, tokens={max_tokens}, message length={len(message)}")
        
        response = self._request("POST", endpoint, json=data)
        
        content = response['choices'][0]['message']['content']
        logger.info(f"Response length: {len(content)} characters")
        
        return content

    def test_connection(self) -> bool:
        """Test API connection"""
        try:
            self.chat("Test message", model="M2-her", max_tokens=50)
            logger.info("API connection test successful")
            print("[OK] API connection test passed!")
            return True
        except Exception as e:
            logger.error(f"API connection test failed: {e}")
            print(f"[ERROR] API connection test failed: {e}")
            return False

    def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Unified request handling"""
        url = f"{self.base_url}/{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        for attempt in range(3):
            try:
                logger.debug(f"Request attempt {attempt + 1}: {method} {endpoint}")
                response = requests.request(
                    method, url, headers=headers, 
                    json=data, timeout=120
                )
                response.raise_for_status()
                result = response.json()
                
                if 'base_resp' in result and result['base_resp']['status_code'] != 0:
                    error_msg = result['base_resp'].get('status_msg', 'Unknown error')
                    logger.error(f"API error: {error_msg}")
                    raise Exception(f"API error: {error_msg}")
                
                logger.info("Request successful")
                return result
                
            except requests.exceptions.Timeout:
                if attempt == 2:
                    logger.error("Request timeout")
                    raise Exception("Request timeout, please check network connection")
                logger.warning(f"Timeout, retrying... ({attempt + 1}/3)")
                import time
                time.sleep(2)
                
            except Exception as e:
                if attempt == 2:
                    logger.error(f"Request failed: {e}")
                    raise
                logger.warning(f"Request failed, retrying... ({attempt + 1}/3)")
                import time
                time.sleep(2)
        
        raise Exception("Request failed after 3 attempts")
