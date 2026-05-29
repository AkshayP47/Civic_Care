import os
import json
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, validator

# --- Paths / Globals (absolute) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
ISSUE_FILE = os.path.join(BASE_DIR, "issues.json")

# --- Ensure static folder exists (for friendly error messages) ---
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

# --- App setup ---
app = FastAPI(title="CivicCare Backend", version="1.0.0")

# CORS so other devices can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for production restrict this
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static assets at /static
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Serve index.html at root using absolute path
@app.get("/", response_class=FileResponse)
def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        # helpful error if frontend not placed correctly
        raise HTTPException(status_code=404, detail=f"static/index.html not found. Put your frontend files in: {STATIC_DIR}")
    return FileResponse(index_path)


# --- Persistence helpers (JSON file) ---
def load_issues() -> List[dict]:
    if not os.path.exists(ISSUE_FILE):
        return []
    try:
        with open(ISSUE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Warning: failed to parse {ISSUE_FILE}: {exc}. Starting with an empty issue list.")
        return []
    except Exception as exc:
        print(f"Warning: failed to load {ISSUE_FILE}: {exc}. Starting with an empty issue list.")
        return []


def save_issues(issues: List[dict]) -> None:
    tmp_file = ISSUE_FILE + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(issues, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_file, ISSUE_FILE)


# initialize in-memory list from file
_issues = load_issues()


# --- Pydantic models ---
class IssueIn(BaseModel):
    user: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    visibility: Literal["public", "personal"]

    @validator("visibility", pre=True)
    def normalize_visibility(cls, value: str) -> str:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"public", "personal"}:
                return normalized
        raise ValueError('visibility must be "public" or "personal"')


class IssueOut(IssueIn):
    id: int
    resolved: bool
    time: str


# --- Utilities ---
def next_issue_id() -> int:
    if not _issues:
        return 0
    # Use max existing id + 1 to avoid collisions
    return max((i.get("id", -1) for i in _issues), default=-1) + 1


def find_issue_by_id(issue_id: int) -> Optional[dict]:
    for i in _issues:
        if i.get("id") == issue_id:
            return i
    return None


# --- API endpoints ---

@app.get("/issues", response_model=List[IssueOut])
def get_issues(username: Optional[str] = None, view: Optional[str] = "main"):
    """
    Query params:
      - username (optional)
      - view: main | my | resolved
    """
    # Copy to avoid accidental mutation
    issues = list(_issues)

    if view == "main":
        # only public, unresolved
        filtered = [i for i in issues if i.get("visibility") == "public" and not i.get("resolved", False)]
    elif view == "my":
        if not username:
            # if username not provided, return empty list
            filtered = []
        else:
            filtered = [i for i in issues if i.get("user") == username and not i.get("resolved", False)]
    elif view == "resolved":
        # show all resolved (public or personal)
        filtered = [i for i in issues if i.get("resolved", False)]
    else:
        # any other view -> return empty
        filtered = []

    # map to IssueOut structure
    result = [
        IssueOut(
            id=i["id"],
            user=i["user"],
            text=i["text"],
            category=i["category"],
            visibility=i["visibility"],
            resolved=bool(i.get("resolved", False)),
            time=i.get("time", "")
        )
        for i in sorted(filtered, key=lambda x: x.get("id", 0), reverse=True)
    ]
    return result


@app.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int):
    issue = find_issue_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return IssueOut(**issue)


@app.post("/issues", response_model=IssueOut)
def create_issue(issue: IssueIn):
    new_id = next_issue_id()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new = {
        "id": new_id,
        "user": issue.user,
        "text": issue.text,
        "category": issue.category,
        "visibility": issue.visibility,
        "resolved": False,
        "time": now
    }
    _issues.append(new)
    save_issues(_issues)
    return IssueOut(**new)


@app.put("/issues/{issue_id}/resolve", response_model=IssueOut)
@app.post("/issues/{issue_id}/resolve", response_model=IssueOut)  # accept POST too for older frontend
def resolve_issue(issue_id: int):
    issue = find_issue_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue["resolved"] = True
    save_issues(_issues)
    return IssueOut(**issue)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
