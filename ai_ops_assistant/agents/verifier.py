import json
from typing import Any, Dict

from openai import APIConnectionError

from llm.llm_client import chat_completion


VERIFIER_SYSTEM_PROMPT = """
You are the Verifier agent in a multi-agent system.

Your responsibilities:
- Validate and synthesize the results produced by earlier agents and tools.
- Produce a clear, concise, user-facing answer.

You are given:
- The original natural language task.
- The planner's JSON plan (steps with tools and inputs).
- The executor's raw tool outputs (e.g., GitHub and StackOverflow results).

RESTRICTIONS:
- You MUST NOT call any external tools or APIs.
- You MUST NOT create a new plan or add new steps.
- You MUST ONLY reason over the provided task, plan JSON, and execution results.

OUTPUT REQUIREMENTS:
- Return a well-structured natural language answer (you MAY use Markdown for clarity).
- Summarize how the tool outputs address the user's task.
- When possible, reference:
    - GitHub repositories (with names and links).
    - StackOverflow questions/answers (with titles and links).
- If information is incomplete or uncertain, clearly state the limitations instead of hallucinating.
"""


class VerifierAgent:
    def verify_and_format(
        self,
        task: str,
        plan: Dict[str, Any],
        execution_results: Dict[str, Any],
    ) -> str:
        plan_json = json.dumps(plan, indent=2, ensure_ascii=False)
        exec_json = json.dumps(execution_results, indent=2, ensure_ascii=False)

        user_prompt = (
            "You are the Verifier agent.\n\n"
            "Use ONLY the information provided below to construct the final answer.\n\n"
            f"Original task:\n{task}\n\n"
            f"Planner JSON plan:\n{plan_json}\n\n"
            f"Executor tool results:\n{exec_json}\n\n"
            "Now, write the final response for the user. "
            "Do NOT propose new steps or call new tools. "
            "Explain how the retrieved GitHub repositories and StackOverflow posts "
            "help answer the task, and highlight any gaps or uncertainties."
        )

        try:
            return chat_completion(system_prompt=VERIFIER_SYSTEM_PROMPT, user_prompt=user_prompt)
        except APIConnectionError as exc:
            raise exc


