import logging
import os
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)


STACKOVERFLOW_SEARCH_URL = "https://api.stackexchange.com/2.3/search/advanced"


def stackoverflow_search(query: str, pagesize: int = 5) -> Dict[str, Any]:
    params = {
        "order": "desc",
        "sort": "relevance",
        "q": query,
        "site": "stackoverflow",
        "pagesize": pagesize,
        "filter": "default",
    }

    api_key = os.getenv("STACKEXCHANGE_API_KEY")
    if api_key:
        params["key"] = api_key

    try:
        logger.info(f"Making StackOverflow API request to: {STACKOVERFLOW_SEARCH_URL} with query: {query}")
        response = requests.get(STACKOVERFLOW_SEARCH_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        logger.info(f"StackOverflow API response: {len(data.get('items', []))} questions returned")
    except requests.exceptions.RequestException as e:
        return {
            "query": query,
            "error": f"StackOverflow API request failed: {str(e)}",
            "has_more": False,
            "items": [],
        }

    questions: List[Dict[str, Any]] = []
    for item in data.get("items", []):
        questions.append(
            {
                "title": item.get("title"),
                "link": item.get("link"),
                "is_answered": item.get("is_answered"),
                "score": item.get("score"),
                "answer_count": item.get("answer_count"),
            }
        )

    return {
        "query": query,
        "has_more": data.get("has_more", False),
        "items": questions,
    }


