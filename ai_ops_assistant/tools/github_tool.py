import logging
import os
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)


GITHUB_SEARCH_REPOS_URL = "https://api.github.com/search/repositories"


def github_search(query: str, per_page: int = 5) -> Dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": per_page,
    }

    try:
        logger.info(f"Making GitHub API request to: {GITHUB_SEARCH_REPOS_URL} with query: {query}")
        response = requests.get(GITHUB_SEARCH_REPOS_URL, headers=headers, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        logger.info(f"GitHub API response: {data.get('total_count', 0)} total results")
    except requests.exceptions.RequestException as e:
        return {
            "query": query,
            "error": f"GitHub API request failed: {str(e)}",
            "total_count": 0,
            "items": [],
        }

    items: List[Dict[str, Any]] = []
    for item in data.get("items", []):
        items.append(
            {
                "full_name": item.get("full_name"),
                "html_url": item.get("html_url"),
                "description": item.get("description"),
                "stargazers_count": item.get("stargazers_count"),
                "language": item.get("language"),
            }
        )

    return {
        "query": query,
        "total_count": data.get("total_count", 0),
        "items": items,
    }


