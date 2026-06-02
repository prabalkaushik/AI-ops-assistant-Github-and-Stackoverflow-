import logging
import os
from typing import Any, Dict, List, Optional
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import APIConnectionError
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Load environments
load_dotenv()

# Setup database and models
from database import engine, get_db, Base
import models
from agents.planner import PlannerAgent
from agents.executor import ExecutorAgent
from agents.verifier import VerifierAgent

# Create tables
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Ops Assistant Backend")

# Enable CORS for React frontend (production-ready)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas
class TaskRequest(BaseModel):
    task: str
    subreddit: Optional[str] = "All"
    author: Optional[str] = "u/dev_ops_wizard"
    mock: Optional[bool] = False

class VoteRequest(BaseModel):
    vote_type: str  # "up" or "down"

class CommentCreate(BaseModel):
    content: str
    author: Optional[str] = "u/coder"
    parent_id: Optional[int] = None

class CommentResponse(BaseModel):
    id: int
    post_id: int
    parent_id: Optional[int]
    content: str
    author: str
    upvotes: int
    created_at: datetime

    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    task: str
    plan: Optional[Dict[str, Any]]
    execution_results: Optional[Dict[str, Any]]
    final_result: Optional[str]
    upvotes: int
    downvotes: int
    subreddit: str
    author: str
    created_at: datetime
    comment_count: int = 0

    class Config:
        from_attributes = True

class PostDetailResponse(BaseModel):
    id: int
    task: str
    plan: Optional[Dict[str, Any]]
    execution_results: Optional[Dict[str, Any]]
    final_result: Optional[str]
    upvotes: int
    downvotes: int
    subreddit: str
    author: str
    created_at: datetime
    comments: List[CommentResponse] = []

    class Config:
        from_attributes = True

planner_agent = PlannerAgent()
executor_agent = ExecutorAgent()
verifier_agent = VerifierAgent()

# Helper for Mock responses when OpenAI key is missing or Mock Mode is requested
def generate_mock_data(task: str) -> Dict[str, Any]:
    # Determine the topic based on query words
    topic = "General"
    task_lower = task.lower()
    if "fastapi" in task_lower:
        topic = "FastAPI"
    elif "docker" in task_lower:
        topic = "Docker"
    elif "git" in task_lower or "github" in task_lower:
        topic = "GitHub"
    elif "react" in task_lower:
        topic = "React"
    elif "python" in task_lower:
        topic = "Python"
        
    mock_plan = {
        "steps": [
            {
                "id": 1,
                "description": f"Search GitHub for {topic} repositories and practices",
                "tool": "github_search",
                "inputs": {"query": f"{topic.lower()} best practices"}
            },
            {
                "id": 2,
                "description": f"Search StackOverflow for {topic} configuration problems",
                "tool": "stackoverflow_search",
                "inputs": {"query": f"{topic.lower()} setup error"}
            }
        ]
    }

    mock_execution = {
        "steps": [
            {
                "id": 1,
                "description": f"Search GitHub for {topic} repositories and practices",
                "tool": "github_search",
                "inputs": {"query": f"{topic.lower()} best practices"},
                "result": {
                    "query": f"{topic.lower()} best practices",
                    "total_count": 2,
                    "items": [
                        {
                            "full_name": f"awesome-developer/{topic.lower()}-examples",
                            "html_url": f"https://github.com/awesome-developer/{topic.lower()}-examples",
                            "description": f"A curated collection of production-ready {topic} structures and examples.",
                            "stargazers_count": 1250,
                            "language": "Python" if topic != "React" else "TypeScript"
                        },
                        {
                            "full_name": f"devops-hub/{topic.lower()}-production-guide",
                            "html_url": f"https://github.com/devops-hub/{topic.lower()}-production-guide",
                            "description": f"Step-by-step production checklist and security hardening rules for {topic}.",
                            "stargazers_count": 842,
                            "language": "Shell"
                        }
                    ]
                }
            },
            {
                "id": 2,
                "description": f"Search StackOverflow for {topic} configuration problems",
                "tool": "stackoverflow_search",
                "inputs": {"query": f"{topic.lower()} setup error"},
                "result": {
                    "query": f"{topic.lower()} setup error",
                    "has_more": False,
                    "items": [
                        {
                            "title": f"How to solve connection refused during {topic} configuration?",
                            "link": "https://stackoverflow.com/questions/889988",
                            "is_answered": True,
                            "score": 98,
                            "answer_count": 3
                        },
                        {
                            "title": f"Proper header configuration for {topic} APIs",
                            "link": "https://stackoverflow.com/questions/776655",
                            "is_answered": True,
                            "score": 45,
                            "answer_count": 2
                        }
                    ]
                }
            }
        ]
    }

    mock_final = f"""### Multi-Agent Summary for: "{task}"
    
> ⚠️ **Mock Mode Active:** The OpenAI API key was not detected or Mock Mode was requested, so these results have been simulated.

Here is a summary of the retrieved items relating to your query on **{topic}**:

#### 🛠️ GitHub Repository Insights
1. **[awesome-developer/{topic.lower()}-examples](https://github.com/awesome-developer/{topic.lower()}-examples)** (★1,250 stars)
   - Highly rated repository containing structured boilerplate designs. This is highly recommended for building out clean code architecture.
2. **[devops-hub/{topic.lower()}-production-guide](https://github.com/devops-hub/{topic.lower()}-production-guide)** (★842 stars)
   - Provides a valuable deployment checklist containing security configurations and docker optimization advice.

#### 💬 StackOverflow Insights
- **[How to solve connection refused during {topic} configuration?](https://stackoverflow.com/questions/889988)** (Score: 98, 3 answers)
  - Indicates that the primary issue is typically due to host binding. Ensure you bind the listener to `0.0.0.0` inside containerized setups instead of `127.0.0.1` so external connections can traverse.
- **[Proper header configuration for {topic} APIs](https://stackoverflow.com/questions/776655)** (Score: 45, 2 answers)
  - Focuses on ensuring correct header structure. If setting up custom client headers, make sure they are explicitly added to your Allowed Headers config.

### Suggested Action Steps:
1. Initialize your project structure from the *examples* repository.
2. Verify host bindings (`0.0.0.0`) are active.
3. Keep CORS headers open to authorized domains.
"""
    return {
        "plan": mock_plan,
        "execution_results": mock_execution,
        "final_result": mock_final
    }

# Endpoints

@app.post("/api/run-task", response_model=PostResponse)
def run_task(request: TaskRequest, db: Session = Depends(get_db)) -> models.Post:
    task = request.task
    subreddit = request.subreddit or "All"
    if subreddit.strip() == "":
        subreddit = "All"
    author = request.author or "u/dev_ops_wizard"

    # Check if OpenAI API Key is missing or user requested mock mode
    api_key = os.getenv("OPENAI_API_KEY")
    is_mock = request.mock or not api_key or not api_key.strip()

    if is_mock:
        logger.info("Running task in MOCK MODE...")
        mock_data = generate_mock_data(task)
        plan = mock_data["plan"]
        execution_results = mock_data["execution_results"]
        final_result = mock_data["final_result"]
    else:
        logger.info("Running task with LIVE LLM AGENTS...")
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

    # Store post in database
    db_post = models.Post(
        task=task,
        plan=plan,
        execution_results=execution_results,
        final_result=final_result,
        subreddit=subreddit,
        author=author,
        upvotes=1,
        downvotes=0
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Add helper count
    db_post.comment_count = 0
    return db_post


@app.get("/api/posts", response_model=List[PostResponse])
def get_posts(
    subreddit: Optional[str] = None,
    sort: str = "new",
    query: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query_builder = db.query(models.Post)
    
    # Filter by subreddit
    if subreddit and subreddit.lower() != "all":
        query_builder = query_builder.filter(models.Post.subreddit.ilike(subreddit))

    # Search keyword
    if query:
        query_builder = query_builder.filter(
            models.Post.task.ilike(f"%{query}%") | models.Post.final_result.ilike(f"%{query}%")
        )

    # Sorting
    if sort == "new":
        query_builder = query_builder.order_by(models.Post.created_at.desc())
    elif sort == "top":
        query_builder = query_builder.order_by((models.Post.upvotes - models.Post.downvotes).desc())
    elif sort == "hot":
        # Hot sorting: score (upvotes - downvotes) desc, then date desc
        query_builder = query_builder.order_by((models.Post.upvotes - models.Post.downvotes).desc(), models.Post.created_at.desc())
    else:
        query_builder = query_builder.order_by(models.Post.created_at.desc())

    posts = query_builder.all()
    
    # Add comment count to each post object dynamically
    for post in posts:
        post.comment_count = db.query(models.Comment).filter(models.Comment.post_id == post.id).count()

    return posts


@app.get("/api/posts/{post_id}", response_model=PostDetailResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Load comments and sort by created_at (older first for readability like reddit)
    comments = db.query(models.Comment).filter(models.Comment.post_id == post_id).order_by(models.Comment.created_at.asc()).all()
    post.comments = comments
    return post


@app.post("/api/posts/{post_id}/vote", response_model=PostResponse)
def vote_post(post_id: int, request: VoteRequest, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if request.vote_type == "up":
        post.upvotes += 1
    elif request.vote_type == "down":
        post.downvotes += 1
    else:
        raise HTTPException(status_code=400, detail="Invalid vote type. Use 'up' or 'down'")
        
    db.commit()
    db.refresh(post)
    
    post.comment_count = db.query(models.Comment).filter(models.Comment.post_id == post.id).count()
    return post


@app.post("/api/posts/{post_id}/comments", response_model=CommentResponse)
def create_comment(post_id: int, comment: CommentCreate, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db_comment = models.Comment(
        post_id=post_id,
        parent_id=comment.parent_id,
        content=comment.content,
        author=comment.author or "u/coder",
        upvotes=1
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@app.get("/api/subreddits", response_model=List[str])
def get_subreddits(db: Session = Depends(get_db)):
    # Query distinct subreddit names from posts
    results = db.query(models.Post.subreddit).distinct().all()
    subreddits = [r[0] for r in results if r[0]]
    
    # Ensure default subs exist in the UI list if they aren't in database yet
    defaults = ["All", "FastAPI", "GitHub", "StackOverflow", "Docker", "Python"]
    for d in defaults:
        if d not in subreddits:
            subreddits.append(d)
            
    return subreddits

# Serve frontend static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
