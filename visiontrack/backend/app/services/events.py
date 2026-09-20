"""Websocket fan-out hub.

The analysis loop runs in a worker thread; it pushes events here through
`publish_threadsafe`, and every websocket subscribed to that job drains its own
bounded queue. Preview frames are dropped first when a client falls behind, so
a slow browser can never stall the pipeline.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional, Set

log = logging.getLogger("visiontrack.events")

QUEUE_MAX = 64


class EventHub:
    def __init__(self) -> None:
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._history: Dict[str, List[dict]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # ------------------------------------------------------------ subscribing

    def subscribe(self, topic: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAX)
        self._subscribers.setdefault(topic, set()).add(queue)
        for event in self._history.get(topic, []):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                break
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(topic)
        if subs:
            subs.discard(queue)
            if not subs:
                self._subscribers.pop(topic, None)

    # -------------------------------------------------------------- publishing

    def publish(self, topic: str, event: dict) -> None:
        if event.get("type") in ("state", "error", "done"):
            # Keep the last lifecycle event so a late subscriber catches up.
            self._history[topic] = [event]
        for queue in list(self._subscribers.get(topic, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                self._drop_oldest_preview(queue)
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass  # client is hopelessly behind; skip this event

    def publish_threadsafe(self, topic: str, event: dict) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(self.publish, topic, event)

    @staticmethod
    def _drop_oldest_preview(queue: asyncio.Queue) -> None:
        """Make room by discarding buffered frames (never lifecycle events)."""
        kept: List[dict] = []
        while not queue.empty():
            try:
                item = queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            if item.get("type") != "frame":
                kept.append(item)
        for item in kept:
            try:
                queue.put_nowait(item)
            except asyncio.QueueFull:
                break

    def clear(self, topic: str) -> None:
        self._history.pop(topic, None)


hub = EventHub()
