"""Restore public runtime assets only when they match the reviewed classroom build."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
HASHES = json.loads((ROOT / "SHA256SUMS.json").read_text())["files"]
BASE = "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/"


def download(url):
    with urlopen(url, timeout=60) as response:
        return response.read()


def save_verified(name, data):
    actual = hashlib.sha256(data).hexdigest()
    if actual != HASHES[name]:
        raise RuntimeError(f"Original asset hash mismatch: {name}: {actual}")
    path = ROOT / "docs" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"Verified {name}: {len(data)} bytes")


model = json.loads(download(BASE + "model.json"))
parts = [path for group in model["weightsManifest"] for path in group["paths"]]
if any("/" in path or ".." in path for path in parts):
    raise RuntimeError("Unexpected model shard path")
save_verified("model/weights.bin", b"".join(download(BASE + path) for path in parts))
save_verified("vendor/tf.min.js", download(
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"))
for name, expected in HASHES.items():
    if hashlib.sha256((ROOT / "docs" / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError(f"Application asset hash mismatch: {name}")
if (ROOT / "SOURCE.md").exists():
    raise RuntimeError("Private source history must not be published")
print("All original application asset hashes match.")
