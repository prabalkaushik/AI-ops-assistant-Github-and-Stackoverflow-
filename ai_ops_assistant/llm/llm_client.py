import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def _build_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not api_key.strip():
        raise RuntimeError(
            "OPENAI_API_KEY is required."
        )
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    return OpenAI(api_key=api_key.strip(), base_url=base_url)

_client: OpenAI = _build_client()
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

def chat_completion(
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
) -> str:
    response: Any = _client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )

    content = response.choices[0].message.content or ""
    return content.strip()



