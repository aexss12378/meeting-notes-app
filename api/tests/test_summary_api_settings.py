import json
import unittest

from app.config import Settings
from app.pipeline import _call_ollama_json
from app.queue import JobQueue


class FakeResponse:
    status_code = 200
    text = ""

    def json(self):
        return {
            "message": {
                "content": json.dumps(
                    {
                        "overview": "ok",
                        "key_points": [],
                        "decisions": [],
                        "risks": [],
                        "open_questions": [],
                        "todos": [],
                    }
                )
            }
        }


class FakeHttpClient:
    last_headers = None

    def __init__(self, timeout):
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def post(self, url, json, headers):
        FakeHttpClient.last_headers = headers
        return FakeResponse()


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.items = []

    def set(self, key, value):
        self.values[key] = value

    def lpush(self, key, value):
        self.items.append((key, value))


class SummaryApiSettingsTest(unittest.TestCase):
    def test_ollama_api_key_is_sent_as_bearer_header(self):
        import app.pipeline as pipeline

        original_client = pipeline.httpx.Client
        pipeline.httpx.Client = FakeHttpClient
        try:
            settings = Settings(ollama_base_url="http://summary.local:11434", ollama_api_key="secret-key")
            _call_ollama_json("摘要", settings)
        finally:
            pipeline.httpx.Client = original_client

        self.assertEqual(FakeHttpClient.last_headers, {"Authorization": "Bearer secret-key"})

    def test_job_payload_keeps_summary_api_settings(self):
        queue = JobQueue("redis://example.invalid:6379/0", "meeting:jobs", "meeting:job")
        fake_redis = FakeRedis()
        queue.redis = fake_redis

        job = queue.create_job(
            "meeting-1",
            summary_api_url="http://summary.local:11434",
            summary_model="qwen3:14b",
            summary_api_key="secret-key",
        )
        _, raw_payload = fake_redis.items[-1]
        queued = json.loads(raw_payload)

        self.assertEqual(job["summary_api_url"], "http://summary.local:11434")
        self.assertEqual(job["summary_model"], "qwen3:14b")
        self.assertEqual(job["summary_api_key"], "secret-key")
        self.assertEqual(queued["summary_api_url"], "http://summary.local:11434")
        self.assertEqual(queued["summary_model"], "qwen3:14b")
        self.assertEqual(queued["summary_api_key"], "secret-key")


if __name__ == "__main__":
    unittest.main()
