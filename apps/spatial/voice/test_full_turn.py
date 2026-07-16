#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Aukora
"""
R39 — the COMPLETE speak -> mind -> speak turn, headless, across the two REAL local services:

  1. connect ws://127.0.0.1:7098/ws  (the NEW voice sidecar)         expect {"t":"ready"}
  2. SPEAK a prompt sentence -> capture the int16 PCM                 (TTS engine, real)
  3. feed that audio BACK as mic (24k->16k) -> VAD -> STT "final"     (VAD + Whisper, real)
  4. serialize the transcript -> POST :7097 /api/chat WITH the token  (the governed mind door, real)
       -> model-free memory-fallback answer  (no model configured -> honestly model-free)
  5. STRIP field / body-language tags from the answer                (sanitizeForVoice law)
       -> assert NO tag markup is sent onward, and none was sent UP to the mind
  6. SPEAK the stripped answer -> capture PCM -> assert decodable audio  (TTS again, real)
  7. barge-in: queue a long line, cancel -> tts_cancelled, no leaked tts_end
  8. abort-reaches-upstream: start a mind request, abort mid-flight -> the client stops, no billing/work

The mind door prints a one-time POST token to its terminal; pass it in the environment:
  AUKORA_DOOR_TOKEN=<token> .venv/bin/python test_full_turn.py
Run with the sidecar (:7098) and the mind door (:7097) both up.
"""

import asyncio
import json
import os
import re
import sys

import aiohttp
import numpy as np

VOICE = "ws://127.0.0.1:7098/ws"
MIND = "http://127.0.0.1:7097"
TOKEN = os.environ.get("AUKORA_DOOR_TOKEN", "")

PROMPT = "Auma, are you there, and what can you actually do right now."
# The donor voice loop strips body-language directives like <smile> / [warm] before speaking. The mind must
# also never RECEIVE tag markup — field events are ephemeral display-only. This mirrors sanitizeForVoice.
FIELD_TAG = re.compile(r"<[^>]+>|\[[^\]]+\]")


def sanitize_for_voice(text: str) -> str:
    return FIELD_TAG.sub("", text).strip()


async def speak_and_capture(ws, text, voice="emma"):
    await ws.send_json({"t": "tts", "id": 7, "text": text, "voice": voice})
    pcm, begun, ended = b"", False, False
    while not ended:
        m = await asyncio.wait_for(ws.receive(), timeout=30)
        if m.type == aiohttp.WSMsgType.BINARY:
            pcm += m.data
        elif m.type == aiohttp.WSMsgType.TEXT:
            j = json.loads(m.data)
            begun = begun or j.get("t") == "tts_begin"
            ended = ended or j.get("t") == "tts_end"
    return pcm, begun


async def hear(ws, pcm24):
    # resample 24k -> 16k and stream as mic frames, then wait for the STT final
    a = np.frombuffer(pcm24, dtype=np.int16).astype(np.float32)
    idx = (np.arange(int(len(a) * 16000 / 24000)) * (24000 / 16000)).astype(np.int64)
    mic = a[np.clip(idx, 0, len(a) - 1)].astype(np.int16).tobytes()
    await ws.send_json({"t": "reset"})
    for i in range(0, len(mic), 1024):
        await ws.send_bytes(mic[i:i + 1024])
        await asyncio.sleep(0.005)
    await ws.send_bytes(b"\x00\x00" * 8000)  # trailing silence -> end-of-utterance
    final, vad = None, False
    while final is None:
        m = await asyncio.wait_for(ws.receive(), timeout=30)
        if m.type == aiohttp.WSMsgType.TEXT:
            j = json.loads(m.data)
            if j.get("t") == "vad" and j.get("speaking"):
                vad = True
            if j.get("t") == "final":
                final = j.get("text", "")
    return final, vad


async def ask_mind(session, owner_text, abort_after=None):
    headers = {"content-type": "application/json"}
    if TOKEN:
        headers["x-aukora-door-token"] = TOKEN
    if abort_after is not None:
        # abort mid-flight to prove the barge-in reaches upstream and stops work
        try:
            async with session.post(f"{MIND}/api/chat", json={"owner_text": owner_text}, headers=headers,
                                    timeout=aiohttp.ClientTimeout(total=abort_after)) as r:
                await r.json()
            return None  # did not abort in time
        except asyncio.TimeoutError:
            return "ABORTED"
    async with session.post(f"{MIND}/api/chat", json={"owner_text": owner_text}, headers=headers) as r:
        return await r.json()


async def run():
    ok = True
    transcript = []
    async with aiohttp.ClientSession() as http:
        async with http.ws_connect(VOICE, max_msg_size=2 ** 22) as ws:
            ready = json.loads((await ws.receive()).data)
            assert ready["t"] == "ready", ready
            print(f"[1] sidecar ready · stt={ready['engines']['stt']}")

            # 2-3: speak the prompt, hear it back
            pcm, begun = await speak_and_capture(ws, PROMPT)
            print(f"[2] spoke prompt · {len(pcm)} PCM bytes ({len(pcm)/2/24000:.2f}s) begun={begun}")
            heard, vad = await hear(ws, pcm)
            print(f"[3] heard back · vad={vad} · STT='{heard}'")
            transcript.append(("owner (spoken→STT)", heard))
            ok &= bool(begun and vad and heard)

            # 4: transcript -> the governed mind door
            reply = await ask_mind(http, heard)
            if reply is None or reply.get("error"):
                print(f"[4] MIND DOOR refused: {reply}")
                return fail(ok=False)
            mode, answer = reply.get("mode"), reply.get("answer", "")
            print(f"[4] mind · mode={mode} · advisoryOnly={reply.get('advisoryOnly')} · answer='{answer}'")
            transcript.append(("auma (mind, %s)" % mode, answer))
            ok &= reply.get("grantsAuthority") is False and reply.get("advisoryOnly") is True

            # 5: strip field tags; assert clean text both onward AND that we never sent tags UP
            spoken_text = sanitize_for_voice(answer)
            assert FIELD_TAG.search(spoken_text) is None, "field tags leaked into speech"
            assert FIELD_TAG.search(heard) is None, "field tags were sent up to the mind"
            print(f"[5] sanitized for voice · '{spoken_text}'")

            # 6: speak the answer back -> decodable audio
            pcm2, begun2 = await speak_and_capture(ws, spoken_text or "I am here.")
            samples = np.frombuffer(pcm2, dtype=np.int16)
            print(f"[6] spoke reply · {len(pcm2)} PCM bytes · peak={int(np.abs(samples).max()) if samples.size else 0}")
            ok &= begun2 and samples.size > 0 and int(np.abs(samples).max()) > 0

            # 7: barge-in
            await ws.send_json({"t": "tts", "id": 9, "text": "This is a very long sentence that must never finish because the owner interrupts me mid word and I stop instantly."})
            await ws.send_json({"t": "tts_cancel"})
            cancelled, leaked = False, False
            try:
                while True:
                    m = await asyncio.wait_for(ws.receive(), timeout=6)
                    if m.type != aiohttp.WSMsgType.TEXT:
                        continue
                    j = json.loads(m.data)
                    cancelled = cancelled or j.get("t") == "tts_cancelled"
                    if j.get("t") == "tts_end" and j.get("id") == 9:
                        leaked = True
            except asyncio.TimeoutError:
                pass
            print(f"[7] barge-in · cancelled={cancelled} leaked_tts_end={leaked}")
            ok &= cancelled and not leaked

        # 8: abort reaches upstream
        aborted = await ask_mind(http, "please think about something long", abort_after=0.001)
        print(f"[8] mind abort mid-flight · result={aborted}")
        ok &= aborted == "ABORTED"

    print("\n--- FULL-TURN TRANSCRIPT ---")
    for who, what in transcript:
        print(f"  {who}: {what}")
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


def fail(ok):
    print("FAIL")
    sys.exit(1)


asyncio.run(run())
