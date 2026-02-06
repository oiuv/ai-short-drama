#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import requests
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class MiniMaxClientQuick:
    def __init__(self, group_id: str = None, api_key: str = None):
        self.group_id = group_id or os.getenv('MINIMAX_GROUP_ID') or 'YOUR_GROUP_ID_HERE'
        self.api_key = api_key or os.getenv('MINIMAX_API_KEY') or 'YOUR_API_KEY_HERE'
        self.base_url = 'https://api.minimaxi.com/v1'
        
        logger.info('MiniMax Client Quick initialized')
    
    def chat(self, message: str, model: str = 'M2-her',
             system_prompt: str = None, temperature: float = 0.7,
             max_tokens: int = 2048) -> str:
        endpoint = 'text/chatcompletion_v2'
        
        messages = []
        
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        
        messages.append({'role': 'user', 'content': message})
        
        data = {
            'model': model,
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': temperature
        }
        
        logger.info(f'Calling MiniMax API: model={model}, tokens={max_tokens}')
        
        response = self._request('POST', endpoint, json=data)
        
        content = response['choices'][0]['message']['content']
        logger.info(f'Response length: {len(content)} characters')
        
        return content
    
    def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        url = f'{self.base_url}/{endpoint}'
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        for attempt in range(3):
            try:
                logger.debug(f'Request attempt {attempt + 1}: {method} {endpoint}')
                response = requests.request(
                    method, url, headers=headers, 
                    json=data, timeout=60
                )
                response.raise_for_status()
                result = response.json()
                
                if 'base_resp' in result and result['base_resp']['status_code'] != 0:
                    error_msg = result['base_resp'].get('status_msg', 'Unknown error')
                    logger.error(f'API error: {error_msg}')
                    
                    if result['base_resp']['status_code'] == 1002 and attempt < 2:
                        logger.warning('Rate limit, retrying...')
                        import time
                        time.sleep(2 * (attempt + 1))
                        continue
                    
                    raise Exception(f'API error: {error_msg}')
                
                logger.info('Request successful')
                return result
                
            except requests.exceptions.Timeout:
                if attempt == 2:
                    logger.error('Request timeout')
                    raise Exception('Request timeout, please check network connection')
                logger.warning(f'Timeout, retrying... ({attempt + 1}/3)')
                import time
                time.sleep(1)
                
            except Exception as e:
                if attempt == 2:
                    logger.error(f'Request failed: {e}')
                    raise
                logger.warning(f'Request failed, retrying... ({attempt + 1}/3)')
                import time
                time.sleep(1)
        
        raise Exception('Request failed after 3 attempts')
    
    def test_connection(self) -> bool:
        try:
            self.chat('test message', model='M2-her', max_tokens=50)
            logger.info('API connection test successful')
            print('[OK] API connection test successful!')
            return True
        except Exception as e:
            logger.error(f'API connection test failed: {e}')
            print(f'[X] API connection test failed: {e}')
            return False
