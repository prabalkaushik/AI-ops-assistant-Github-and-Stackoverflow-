import logging
from typing import Any, Dict, List

from tools.github_tool import github_search
from tools.stackoverflow_tool import stackoverflow_search

logger = logging.getLogger(__name__)


class ExecutorAgent:
    def execute_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        steps: List[Dict[str, Any]] = plan.get("steps", [])
        executed_steps: List[Dict[str, Any]] = []

        for step in steps:
            tool_name = step.get("tool")
            inputs = step.get("inputs", {}) or {}
            query = inputs.get("query", "")

            if not isinstance(query, str):
                query = str(query)

            if tool_name == "github_search":
                logger.info(f"Calling GitHub API with query: {query}")
                result = github_search(query=query)
                logger.info(f"GitHub API returned {len(result.get('items', []))} repositories")
            elif tool_name == "stackoverflow_search":
                logger.info(f"Calling StackOverflow API with query: {query}")
                result = stackoverflow_search(query=query)
                logger.info(f"StackOverflow API returned {len(result.get('items', []))} questions")
            else:
                result = {
                    "error": f"Unsupported tool '{tool_name}' in plan.",
                    "inputs": inputs,
                }

            executed_steps.append(
                {
                    "id": step.get("id"),
                    "description": step.get("description"),
                    "tool": tool_name,
                    "inputs": inputs,
                    "result": result,
                }
            )

        return {"steps": executed_steps}


