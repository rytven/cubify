/** Minimal NBT writers: Java big-endian (schematic) and Bedrock little-endian (mcstructure). */

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;

export class NbtWriter {
  private buf: number[] = [];

  get bytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }

  private u8(n: number) {
    this.buf.push(n & 255);
  }

  private i16(n: number) {
    this.buf.push((n >> 8) & 255, n & 255);
  }

  private i32(n: number) {
    this.buf.push((n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  }

  private str(s: string) {
    const enc = new TextEncoder().encode(s);
    this.i16(enc.length);
    for (const b of enc) this.u8(b);
  }

  private name(type: number, n: string) {
    this.u8(type);
    this.str(n);
  }

  compound(name: string, body: () => void) {
    this.name(TAG_COMPOUND, name);
    body();
    this.u8(TAG_END);
  }

  byte(name: string, v: number) {
    this.name(TAG_BYTE, name);
    this.u8(v);
  }

  short(name: string, v: number) {
    this.name(TAG_SHORT, name);
    this.i16(v);
  }

  int(name: string, v: number) {
    this.name(TAG_INT, name);
    this.i32(v);
  }

  string(name: string, v: string) {
    this.name(TAG_STRING, name);
    this.str(v);
  }

  byteArray(name: string, data: Uint8Array) {
    this.name(TAG_BYTE_ARRAY, name);
    this.i32(data.length);
    for (const b of data) this.u8(b);
  }

  intArray(name: string, data: number[]) {
    this.name(TAG_INT_ARRAY, name);
    this.i32(data.length);
    for (const n of data) this.i32(n);
  }

  emptyCompoundList(name: string) {
    this.name(TAG_LIST, name);
    this.u8(TAG_COMPOUND);
    this.i32(0);
  }

  unnamedCompound(body: () => void) {
    body();
    this.u8(TAG_END);
  }
}

export function writeVarInt(n: number, out: number[]) {
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

/** Little-endian uncompressed NBT for Bedrock `.mcstructure` files. */
export class BedrockNbt {
  private buf = new Uint8Array(256 * 1024);
  private o = 0;

  private grow(n: number) {
    if (this.o + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.o + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf);
    this.buf = next;
  }

  private u8(n: number) {
    this.grow(1);
    this.buf[this.o++] = n & 255;
  }

  private i16(n: number) {
    this.grow(2);
    this.buf[this.o++] = n & 255;
    this.buf[this.o++] = (n >> 8) & 255;
  }

  private i32(n: number) {
    n |= 0;
    this.grow(4);
    this.buf[this.o++] = n & 255;
    this.buf[this.o++] = (n >> 8) & 255;
    this.buf[this.o++] = (n >> 16) & 255;
    this.buf[this.o++] = (n >> 24) & 255;
  }

  private str(s: string) {
    const enc = new TextEncoder().encode(s);
    this.i16(enc.length);
    this.grow(enc.length);
    this.buf.set(enc, this.o);
    this.o += enc.length;
  }

  private tag(type: number, name: string) {
    this.u8(type);
    this.str(name);
  }

  root(body: () => void) {
    this.u8(TAG_COMPOUND);
    this.str("");
    body();
    this.u8(TAG_END);
  }

  compound(name: string, body: () => void) {
    this.tag(TAG_COMPOUND, name);
    body();
    this.u8(TAG_END);
  }

  emptyCompound(name: string) {
    this.tag(TAG_COMPOUND, name);
    this.u8(TAG_END);
  }

  int(name: string, v: number) {
    this.tag(TAG_INT, name);
    this.i32(v);
  }

  string(name: string, v: string) {
    this.tag(TAG_STRING, name);
    this.str(v);
  }

  intList(name: string, values: ArrayLike<number>) {
    this.tag(TAG_LIST, name);
    this.u8(TAG_INT);
    this.i32(values.length);
    for (let i = 0; i < values.length; i++) this.i32(values[i]!);
  }

  unnamedIntList(values: ArrayLike<number>) {
    this.u8(TAG_INT);
    this.i32(values.length);
    for (let i = 0; i < values.length; i++) this.i32(values[i]!);
  }

  listOfIntLists(name: string, layers: ArrayLike<number>[]) {
    this.tag(TAG_LIST, name);
    this.u8(TAG_LIST);
    this.i32(layers.length);
    for (const layer of layers) this.unnamedIntList(layer);
  }

  compoundList(name: string, count: number, body: () => void) {
    this.tag(TAG_LIST, name);
    this.u8(TAG_COMPOUND);
    this.i32(count);
    body();
  }

  unnamedCompound(body: () => void) {
    body();
    this.u8(TAG_END);
  }

  emptyCompoundList(name: string) {
    this.tag(TAG_LIST, name);
    this.u8(TAG_COMPOUND);
    this.i32(0);
  }

  get bytes(): Uint8Array {
    return this.buf.subarray(0, this.o);
  }
}
