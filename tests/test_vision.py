"""Проверка запроса к Claude API без сети: подменяем HTTP-транспорт."""

import json

import httpx2 as httpx
import pytest

from ocr.vision import PassportVision, VisionError


def make_vision(handler):
    vision = PassportVision(api_key="test-key", model="claude-opus-5")
    vision.client = vision.client.with_options(
        http_client=httpx.Client(transport=httpx.MockTransport(handler)), max_retries=0)
    return vision


def reply(text: str, stop_reason: str = "end_turn") -> dict:
    return {
        "id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5",
        "content": [{"type": "text", "text": text}], "stop_reason": stop_reason,
        "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 10},
    }


def test_request_shape_and_parse():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        seen["beta"] = request.headers.get("anthropic-beta", "")
        return httpx.Response(200, json=reply(json.dumps({"surname": "TOSHMATOV"})))

    result = make_vision(handler).extract(b"\xff\xd8fake")
    assert result.data == {"surname": "TOSHMATOV"}
    body = seen["body"]
    assert body["model"] == "claude-opus-5"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["fallbacks"] == "default"
    assert "server-side-fallback-2026-07-01" in seen["beta"]
    assert body["messages"][0]["content"][0]["type"] == "image"


def test_refusal_raises():
    handler = lambda request: httpx.Response(200, json=reply("", "refusal"))  # noqa: E731
    with pytest.raises(VisionError):
        make_vision(handler).extract(b"x")


def test_auth_error_message():
    handler = lambda request: httpx.Response(  # noqa: E731
        401, json={"type": "error", "error": {"type": "authentication_error", "message": "bad"}})
    with pytest.raises(VisionError, match="ANTHROPIC_API_KEY"):
        make_vision(handler).extract(b"x")
