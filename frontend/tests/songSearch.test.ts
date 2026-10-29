import { describe, expect, it } from "vitest";
import {
  SONGBOOK, capoTip, typoDistance, chordPcs, chordShape, keyChords, keyName, makeKey, matchScore, numeralChord, parseKey, progressionSound,
  relativeKey, scaleNotes, searchSongbook, sectionChords, soloScales, songChords, PROGRESSIONS,
} from "@/lib/music/songSearch";
import { STANDARD_TUNING } from "@/lib/music/guitar";

const K = (s: string) => parseKey(s)!;
const pcsOfShape = (sh: ReturnType<typeof chordShape>) => [...new Set(sh.frets.flatMap((f, i) => (f == null ? [] : [(STANDARD_TUNING[6 - i]! + f) % 12])))].sort((a, b) => a - b);

describe("keys and spelling", () => {
  it("parses key names in many forms", () => {
    expect(keyName(K("G"))).toBe("G major");
    expect(keyName(K("Em"))).toBe("E minor");
    expect(keyName(K("F# minor"))).toBe("F♯ minor");
    expect(keyName(K("Bb major"))).toBe("B♭ major");
    expect(keyName(K("C♯m"))).toBe("C♯ minor");
    expect(keyName(K("g"))).toBe("G major");
    expect(parseKey("H")).toBeNull();
    expect(parseKey("")).toBeNull();
  });

  it("spells scales with one of each letter", () => {
    expect(scaleNotes(K("G")).join(" ")).toBe("G A B C D E F♯");
    expect(scaleNotes(K("F")).join(" ")).toBe("F G A B♭ C D E");
    expect(scaleNotes(K("Eb")).join(" ")).toBe("E♭ F G A♭ B♭ C D");
    expect(scaleNotes(K("F#m")).join(" ")).toBe("F♯ G♯ A B C♯ D E");
    expect(scaleNotes(K("Am")).join(" ")).toBe("A B C D E F G");
    expect(scaleNotes(makeKey(6, "major")).join(" ")).toBe("F♯ G♯ A♯ B C♯ D♯ E♯");
  });

  it("finds relative keys", () => {
    expect(keyName(relativeKey(K("C")))).toBe("A minor");
    expect(keyName(relativeKey(K("Em")))).toBe("G major");
    expect(keyName(relativeKey(K("Bb")))).toBe("G minor");
  });
});

describe("chords", () => {
  it("turns Roman numerals into chord names for the key", () => {
    const sym = (k: string, ns: string[]) => ns.map((n) => numeralChord(K(k), n).symbol).join(" ");
    expect(sym("C", ["I", "ii", "iii", "IV", "V", "vi", "vii°"])).toBe("C Dm Em F G Am B°");
    expect(sym("Am", ["i", "♭III", "IV", "♭VI", "V", "♭VII"])).toBe("Am C D F E G");
    expect(sym("G", ["I7", "iv", "II7", "V7"])).toBe("G7 Cm A7 D7");
    expect(sym("Bb", ["I", "IV", "V", "vi"])).toBe("B♭ E♭ F Gm");
    expect(sym("C", ["ii7", "Imaj7"])).toBe("Dm7 Cmaj7");
  });

  it("lists the key's chords and marks the common ones", () => {
    const c = keyChords(K("D"));
    expect(c.map((x) => x.symbol)).toEqual(["D", "Em", "F♯m", "G", "A", "Bm", "C♯°"]);
    expect(c.filter((x) => x.common).map((x) => x.symbol)).toEqual(["D", "G", "A", "Bm"]);
    const am = keyChords(K("Am"));
    expect(am.at(-1)!.symbol).toBe("E"); // borrowed major V
    for (const p of [...PROGRESSIONS.major, ...PROGRESSIONS.minor]) expect(p.numerals).toHaveLength(4);
  });

  it("every chord shape sounds the chord's notes", () => {
    const keys = ["C", "G", "D", "A", "E", "F", "Am", "Em", "Dm", "Bb", "F#m"];
    for (const k of keys) for (const c of keyChords(K(k))) {
      if (c.quality === "dim") continue;
      expect(pcsOfShape(chordShape(c)), `${k}: ${c.symbol}`).toEqual([...chordPcs(c)].sort((a, b) => a - b));
    }
    for (const n of ["I7", "II7", "V7"]) {
      const c = numeralChord(K("G"), n);
      expect(pcsOfShape(chordShape(c)), c.symbol).toEqual([...chordPcs(c)].sort((a, b) => a - b));
    }
  });

  it("suggests a capo for awkward keys", () => {
    expect(capoTip(K("G"))).toBeNull();
    const bb = capoTip(K("Bb"))!;
    expect([bb.capo, keyName(bb.shapes)]).toEqual([1, "A major"]);
    const eb = capoTip(K("Eb"))!;
    expect([eb.capo, keyName(eb.shapes)]).toEqual([1, "D major"]);
    const cm = capoTip(K("Cm"))!;
    expect([cm.capo, keyName(cm.shapes)]).toEqual([3, "A minor"]);
    expect(capoTip(K("F#m"))!.capo).toBe(2);
  });

  it("suggests scales to solo with", () => {
    expect(soloScales(K("G")).map((s) => `${s.name}: ${s.notes.join(" ")}`)).toEqual(["G major pentatonic: G A B D E", "E minor pentatonic: E G A B D"]);
    expect(soloScales(K("Am"))[0]!.notes.join(" ")).toBe("A C D E G");
  });
});

describe("songbook", () => {
  it("every song's chords build, shapes exist and the progression plays", () => {
    for (const s of SONGBOOK) {
      expect(s.key).toBeTruthy();
      for (const sec of s.sections) {
        const bars = sectionChords(s, sec);
        expect(bars.length).toBeGreaterThan(0);
        const snd = progressionSound(bars, s.meter, s.bpm);
        const lights = snd.events.filter((e) => e.kind === "highlight");
        expect(lights).toHaveLength(bars.flat().length);
        for (const e of snd.events) expect(e.beat).toBeLessThan(snd.lengthBeats);
      }
      for (const c of songChords(s)) expect(chordShape(c).frets.some((f) => f != null), `${s.id} ${c.symbol}`).toBe(true);
    }
  });

  it("knows the classic progressions", () => {
    const song = (id: string) => SONGBOOK.find((s) => s.id === id)!;
    const chart = (id: string) => sectionChords(song(id), song(id).sections[0]!).map((b) => b.map((c) => c.symbol).join(" ")).join(" | ");
    expect(chart("rising-sun")).toBe("Am C | D F | Am C | E E | Am C | D F | Am E | Am E");
    expect(chart("canon")).toBe("D A | Bm F♯m | G D | G A");
    expect(chart("saints")).toContain("G | G7 | C | Cm | G | D | G");
    expect(songChords(song("jingle-bells")).map((c) => c.symbol)).toEqual(["G", "C", "A7", "D"]);
  });

  it("finds songs from partial titles, aliases and typos", () => {
    const top = (q: string) => searchSongbook(q)[0]?.song.id;
    expect(top("amazing grace")).toBe("amazing-grace");
    expect(top("Amazing")).toBe("amazing-grace");
    expect(top("rising sun")).toBe("rising-sun");
    expect(top("house of the rising")).toBe("rising-sun");
    expect(top("pachelbel")).toBe("canon");
    expect(top("twinkel twinkel")).toBe("twinkle");
    expect(top("jingel bels")).toBe("jingle-bells");
    expect(top("fur elise")).toBe("fur-elise");
    expect(top("Für Elise")).toBe("fur-elise");
    expect(searchSongbook("x")).toEqual([]);
    expect(searchSongbook("bohemian rhapsody")).toEqual([]);
    expect(matchScore("saints", "When the Saints Go Marching In")).toBeGreaterThanOrEqual(80);
    expect(typoDistance("twinkel", "twinkle")).toBe(1);
  });
});
