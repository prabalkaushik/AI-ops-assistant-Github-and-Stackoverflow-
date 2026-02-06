## AI Operations Assistant – Multi-Agent using FastAPI Service

This project implements a **Three-agent architecture** that coordinates an LLM-powered planner and verifier with real tool execution against GitHub Search API and StackOverflow API.

The service runs locally via **FastAPI** and exposes a single endpoint:

- **POST** `/run-Task`
- **Body**: `{ "Task": "<natural language task>" }`

The system:

1. Planner Agent (LLM)– turns the task into a JSON plan.
2. Executor Agent  – executes each step using GitHub and StackOverflow APIs. we are is not using llm here.
3. Verifier Agent (LLM) – validates and formats the final user-facing answer.

The response includes:

- **`task`** – original task string.
- **`plan`** – planner’s JSON plan.
- **`final_result`** – verified, formatted result.

---

### Project Structure
###As per  assessment guidelines
```text
ai_ops_assistant/
├── agents/
│   ├── planner.py        
│   ├── executor.py        
│   └── verifier.py        
├── tools/
│   ├── github_tool.py     
│   └── stackoverflow_tool.py  
├── llm/
│   └── llm_client.py      
├── main.py                
├── requirements.txt       
├── .env.example           
└── README.md              
```

The `agents`, `tools`, and `llm` folders also contain `__init__.py` to make them importable packages.

---

### 1. Setup & Installation

From inside the `ai_ops_assistant` directory:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt
```

---

### 2. Environment Configuration

1. Create a `.env` file in the `ai_ops_assistant` directory(here i have mentioned.example which doesn't have actual keys, you may use your own key, although github and stackoverflow keys are optional  model can run without that also)
2. Set **OpenAI** variables:
   - **`OPENAI_API_KEY`** – your OpenAI API key (required).
   - **`OPENAI_BASE_URL`** – optional, defaults to `https://api.openai.com/v1`.
   - **`OPENAI_MODEL`** – optional, default is `gpt-4.1-mini`.

3. Optional (for tools):
   - **`GITHUB_TOKEN`** – optional but recommended for better GitHub rate limits.
   - **`STACKEXCHANGE_API_KEY`** – optional but recommended for StackOverflow.

---

### 3. Running the Service

From inside `ai_ops_assistant`:

```bash
uvicorn main:app --reload
```

This will start the FastAPI app on `http://127.0.0.1:8000`.

You can access the interactive docs at:

- Swagger UI: `http://127.0.0.1:8000/docs`

---

### 4. Using the `/run-task` Endpoint
you may use postman to check this curl request using POST.
Example `curl` request:

```bash
curl -X POST "http://127.0.0.1:8000/run-task" \
  -H "Content-Type: application/json" \
  -d '{
        "task": "Find popular GitHub repos and StackOverflow posts about building FastAPI services with GitHub and StackOverflow integrations."
      }'
```

Example (schematic) response:

```json
{
  "task": "Find popular GitHub repos and StackOverflow posts about building FastAPI services with GitHub and StackOverflow integrations.",
  "plan": {
    "steps": [
      {
        "id": 1,
        "description": "Search GitHub for FastAPI GitHub/StackOverflow integration examples",
        "tool": "github_search",
        "inputs": {
          "query": "fastapi github stackoverflow integration"
        }
      },
      {
        "id": 2,
        "description": "Search StackOverflow for questions about FastAPI + GitHub + StackOverflow APIs",
        "tool": "stackoverflow_search",
        "inputs": {
          "query": "fastapi github api stackoverflow api"
        }
      }
    ]
  },
  "final_result": "Natural-language explanation produced by the Verifier Agent, summarizing relevant GitHub repositories and StackOverflow posts."
}
```

> Note: It is just an example ,actual will be base on live github and stackoverflow

---

### 5. Architectural Notes

- **Planner Agent (`planner.py`)**
  - Uses its **own LLM prompt** (no monolithic prompt).
  - Produces **strict JSON only** with a top-level `steps` array.
  - Each step specifies a `tool` (`github_search` or `stackoverflow_search`) and `inputs.query`.

- **Executor Agent (`executor.py`)**
  - **Does not use the LLM.**
  - Reads the planner’s JSON plan and calls:
    - `tools.github_tool.github_search(...)`
    - `tools.stackoverflow_tool.stackoverflow_search(...)`
  - Returns the raw tool outputs grouped per step.

- **Verifier Agent (`verifier.py`)**
  - Uses its **own LLM prompt**, separate from the planner.
  - Does **not** call external APIs or re-plan.
  - Consumes:
    - Original `task`
    - Planner `plan`
    - Executor `execution_results`
  - Produces the final `final_result` string.

- **Tools (`github_tool.py`, `stackoverflow_tool.py`)**
  - Contain **only** API logic and light response shaping.
  - No LLM calls or planning logic.

---

### 6. Troubleshooting

- **Import errors** – Run commands from inside the `ai_ops_assistant` directory with your virtual environment activated.

- **LLM / OpenAI errors**:
  - Set `OPENAI_API_KEY` in `.env` (required).
  - If using a custom endpoint, set `OPENAI_BASE_URL` in `.env`.

- **GitHub/StackOverflow rate limits** – Set `GITHUB_TOKEN` and `STACKEXCHANGE_API_KEY` in `.env` for higher limits.

If anything fails, you may check the server logs from `uvicorn` for details.

