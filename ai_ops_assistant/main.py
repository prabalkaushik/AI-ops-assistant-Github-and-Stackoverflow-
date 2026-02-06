import logging
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from openai import APIConnectionError
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from agents.planner import PlannerAgent
from agents.executor import ExecutorAgent
from agents.verifier import VerifierAgent


load_dotenv()

app = FastAPI(title="AI Ops Assistant")


class TaskRequest(BaseModel):
    task: str


class TaskResponse(BaseModel):
    task: str
    plan: Dict[str, Any]
    execution_results: Dict[str, Any]
    final_result: str


planner_agent = PlannerAgent()
executor_agent = ExecutorAgent()
verifier_agent = VerifierAgent()


@app.post("/run-task", response_model=TaskResponse)
def run_task(request: TaskRequest) -> TaskResponse:
    task = request.task

    try:
        plan = planner_agent.create_plan(task)
    except APIConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API is not reachable. Check your network and OPENAI_API_KEY in .env.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Planner error: {exc}") from exc

    logger.info("Executing plan steps using GitHub and StackOverflow APIs...")
    execution_results = executor_agent.execute_plan(plan)
    logger.info(f"Executor completed. Tool results: {execution_results}")

    try:
        final_result = verifier_agent.verify_and_format(
            task=task,
            plan=plan,
            execution_results=execution_results,
        )
    except APIConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API is not reachable. Check your network and OPENAI_API_KEY in .env.",
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Verifier error: {exc}") from exc

    return TaskResponse(
        task=task,
        plan=plan,
        execution_results=execution_results,
        final_result=final_result,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


