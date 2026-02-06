import json
from typing import Any, Dict

from openai import APIConnectionError

from llm.llm_client import chat_completion


PLANNER_SYSTEM_PROMPT = """
You are a strict planning assistant for a multi-agent system.

Your job is ONLY to convert a natural language software-engineering task
into a structured JSON plan that other agents and tools will follow.

REQUIREMENTS:
- OUTPUT MUST BE VALID JSON ONLY. NO MARKDOWN, NO EXPLANATION TEXT.
- The top-level object MUST have a single key: "steps".
- "steps" MUST be an array of step objects.
- Each step object MUST have:
    - "id": integer, starting at 1 and increasing by 1.
    - "description": short natural language description of the sub-task.
    - "tool": one of ["github_search", "stackoverflow_search"].
    - "inputs": an object containing tool-specific fields, at minimum:
        - "query": string describing what to search for.
- Use "github_search" for exploring repositories, code examples, or libraries.
- Use "stackoverflow_search" for debugging help, errors, and how-to questions.

CONSTRAINTS:
- Do NOT include commentary outside the JSON.
- Do NOT wrap JSON in code fences.
- Do NOT invent tools beyond the allowed ones.
"""


class PlannerAgent:
    def create_plan(self, task: str) -> Dict[str, Any]:
        user_prompt = (
            "Convert the following task into a JSON plan following the schema "
            "described in the system instructions.\n\n"
            f"Task: {task}"
        )

        try:
            raw = chat_completion(system_prompt=PLANNER_SYSTEM_PROMPT, user_prompt=user_prompt)
        except APIConnectionError as exc:
            raise exc

        cleaned = self._extract_json(raw)

        try:
            plan: Dict[str, Any] = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Planner LLM did not return valid JSON: {raw}") from exc

        self._validate_plan_schema(plan)
        return plan

    @staticmethod
    def _extract_json(text: str) -> str:
        text = text.strip()
        if text.startswith("{") and text.endswith("}"):
            return text

        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and start < end:
            return text[start : end + 1]

        return text

    @staticmethod
    def _validate_plan_schema(plan: Dict[str, Any]) -> None:
        if "steps" not in plan or not isinstance(plan["steps"], list):
            raise ValueError("Plan must contain a 'steps' array.")

        for step in plan["steps"]:
            if not isinstance(step, dict):
                raise ValueError("Each step must be an object.")

            if "id" not in step or not isinstance(step["id"], int):
                raise ValueError("Each step must have an integer 'id'.")

            if "description" not in step or not isinstance(step["description"], str):
                raise ValueError("Each step must have a string 'description'.")

            if step.get("tool") not in {"github_search", "stackoverflow_search"}:
                raise ValueError(
                    "Each step 'tool' must be either 'github_search' or 'stackoverflow_search'."
                )

            inputs = step.get("inputs")
            if not isinstance(inputs, dict):
                raise ValueError("Each step must have an 'inputs' object.")

            if "query" not in inputs or not isinstance(inputs["query"], str):
                raise ValueError("Each step.inputs must contain a string 'query'.")

