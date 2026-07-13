"""Распознавание голосовых сообщений через Whisper (Groq API)."""
import httpx

from config import GROQ_API_KEY, GROQ_WHISPER_URL, GROQ_WHISPER_MODEL


async def transcribe(audio_bytes: bytes, filename: str = "voice.ogg") -> str | None:
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    files = {"file": (filename, audio_bytes, "audio/ogg")}
    data = {"model": GROQ_WHISPER_MODEL, "language": "ru"}

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(GROQ_WHISPER_URL, headers=headers, files=files, data=data)
            resp.raise_for_status()
            text = resp.json().get("text", "").strip()
            return text or None
        except httpx.HTTPError:
            return None
