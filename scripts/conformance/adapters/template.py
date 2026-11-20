#!/usr/bin/env python3
"""Starter conformance adapter (protocol bluewhale-conformance/1).

Copy this file into your implementation, replace the TODOs with calls into
your library, and run:

    node scripts/conformance/runner.mjs -- python3 adapter.py

Every request is one JSON object per line on stdin; write exactly one JSON
object per line to stdout, in the same order, echoing the request "id".
Use stderr for logs: anything on stdout that is not a response breaks the
protocol. See docs/guides/conformance.md for the full message reference.
"""
import json
import sys

PROTOCOL = "bluewhale-conformance/1"


def hello(_input):
    return {
        "protocol": PROTOCOL,
        "implementation": {"name": "my-bluewhale", "version": "0.0.0", "language": "python"},
        # List only the ops you implement; the runner reports the rest as
        # unsupported instead of failed.
        "ops": [],
    }


class Unsupported(Exception):
    pass


def detect(inp):
    # TODO: return {"kind": "G"|"M"|"C"|"invalid", "address": ..., "warnings": [...]}
    raise Unsupported()


def muxed_encode(inp):
    # TODO: return {"mAddress": encode(inp["baseG"], int(inp["id"]))}
    raise Unsupported()


def muxed_decode(inp):
    # TODO: return {"baseG": ..., "id": "<decimal string>"}; raise on invalid input
    raise Unsupported()


def extract_routing(inp):
    # TODO: return {"destinationBaseAccount", "routingId" (decimal string or None),
    #               "routingSource", "warnings": [{"code", "severity", ...}]}
    raise Unsupported()


HANDLERS = {
    "hello": hello,
    "detect": detect,
    "muxed_encode": muxed_encode,
    "muxed_decode": muxed_decode,
    "extract_routing": extract_routing,
}


def handle(req):
    handler = HANDLERS.get(req.get("op"))
    if handler is None:
        return {"id": req.get("id"), "ok": False, "error": {"code": "UNSUPPORTED_OP"}}
    try:
        return {"id": req.get("id"), "ok": True, "output": handler(req.get("input") or {})}
    except Unsupported:
        return {"id": req.get("id"), "ok": False, "error": {"code": "UNSUPPORTED_OP"}}
    except Exception as exc:  # A library error is a valid answer, never a crash.
        return {"id": req.get("id"), "ok": False, "error": {"code": "ERROR", "message": str(exc)}}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        sys.stdout.write(json.dumps(handle(json.loads(line))) + "\n")
        sys.stdout.flush()  # Responses must not sit in a buffer.


if __name__ == "__main__":
    main()
