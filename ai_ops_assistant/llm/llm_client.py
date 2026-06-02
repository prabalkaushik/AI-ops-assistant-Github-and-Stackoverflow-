import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


_client = None
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or not api_key.strip():
            raise ValueError(
                "OPENAI_API_KEY is required. Please set it in your environment or .env file."
            )
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        _client = OpenAI(api_key=api_key.strip(), base_url=base_url)
    return _client

def chat_completion(
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
) -> str:
    client = get_client()
    response: Any = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )

    content = response.choices[0].message.content or ""
    return content.strip()



