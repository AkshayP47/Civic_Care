# CivicCare

A simple FastAPI backend for a civic issues tracker with a frontend served from `static/`.

## Requirements

- Python 3.8+
- `fastapi`
- `uvicorn`
- `pydantic`

## Install

From the project folder:

```bash
cd e:\nig\finalcry
python -m pip install -r requirements.txt
```

## Run

Use Uvicorn to start the server:

```bash
python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

You can also start the app directly:

```bash
python server.py
```

## Access

- Frontend: `http://127.0.0.1:8000/`
- API docs: `http://127.0.0.1:8000/docs`

> Note: `0.0.0.0` is a bind address for the server. Do not browse to `http://0.0.0.0:8000`.
> Use `http://127.0.0.1:8000` or `http://localhost:8000` instead.

## API Endpoints

### Get issues

```http
GET /issues
GET /issues?view=main
GET /issues?view=my&username='Username'
GET /issues?view=resolved
GET /issues/{issue_id}
```

### Create issue

```http
POST /issues
Content-Type: application/json

{
  "user": "Amit",
  "text": "Street light broken",
  "category": "Utilities",
  "visibility": "public"
}
```

### Resolve issue

```http
PUT /issues/1/resolve
```

Or for older frontend compatibility:

```http
POST /issues/1/resolve
```

## Data storage

- Issues are stored in `issues.json`
- Static frontend files are served from `static/`
