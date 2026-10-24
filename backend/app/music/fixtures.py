"""Deterministic demonstration melody and reference solo (test fixture / demo mode).

The demo melody is fed through the REAL harmonizer and solo generator in demo
mode. The reference solo below is used only by tests to verify positions and TAB.
"""
from __future__ import annotations

DEMO_TITLE = "Demo: First Rock Tune"
DEMO_TEMPO = 80
DEMO_KEY = "C major"
DEMO_MELODY = [
    ["E4", "G4", "E4", "C4"],
    ["F4", "C4", "F4", "C4"],
    ["G4", "D4", "B3", "G4"],
    ["E4", "G4", "C4", "C4"],
]
DEMO_HARMONY = ["C", "F", "G", "C"]

REFERENCE_SOLO = [
    ["E4", "G4", "G4", "E4"],
    ["F4", "C4", "E4", "F4"],
    ["G4", "D4", "B3", "G4"],
    ["G4", "E4", "C4", "C4"],
]

VERIFIED_POSITIONS = {
    "E4": (1, 0),
    "F4": (1, 1),
    "G4": (1, 3),
    "B3": (2, 0),
    "C4": (2, 1),
    "D4": (2, 3),
}

REFERENCE_TAB = """e|--0--3--3--0--|--1-----0--1--|--3--------3--|--3--0--------|
B|--------------|-----1--------|-----3--0-----|--------1--1--|
G|--------------|--------------|--------------|--------------|
D|--------------|--------------|--------------|--------------|
A|--------------|--------------|--------------|--------------|
E|--------------|--------------|--------------|--------------|"""
