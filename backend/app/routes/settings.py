"""
Settings endpoint — allows updating ANTHROPIC_API_KEY in backend/.env at runtime.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os, re

router = APIRouter(prefix="/settings", tags=["settings"])

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


def _read_env() -> str:
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


def _write_env(content: str):
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(content)


class ApiKeyRequest(BaseModel):
    api_key: str


@router.get("/apikey-status")
def apikey_status():
    """Returns whether the API key is configured (not the key itself)."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    # Also check .env file
    env_content = _read_env()
    match = re.search(r"ANTHROPIC_API_KEY=(.+)", env_content)
    file_key = match.group(1).strip() if match else ""
    effective_key = key or file_key
    configured = bool(effective_key and effective_key != "your_api_key_here")
    return {
        "configured": configured,
        "source": "env_var" if key and key != "your_api_key_here" else ("file" if configured else "none"),
    }


@router.post("/apikey")
def set_apikey(req: ApiKeyRequest):
    """Save API key to backend/.env file and reload into process env."""
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="המפתח לא יכול להיות ריק")
    if not key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="מפתח לא תקין — חייב להתחיל ב-sk-")

    # Update .env file
    content = _read_env()
    if re.search(r"ANTHROPIC_API_KEY=", content):
        content = re.sub(r"ANTHROPIC_API_KEY=.*", f"ANTHROPIC_API_KEY={key}", content)
    else:
        content = content.rstrip() + f"\nANTHROPIC_API_KEY={key}\n"
    _write_env(content)

    # Update current process env so it takes effect immediately (no restart needed)
    os.environ["ANTHROPIC_API_KEY"] = key

    # Reset the cached Anthropic client in ai_insights so it picks up new key
    try:
        from . import ai_insights
        ai_insights._client = None
    except Exception:
        pass

    return {"success": True, "message": "מפתח API עודכן בהצלחה"}
