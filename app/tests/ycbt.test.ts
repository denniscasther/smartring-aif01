// Ejecutar: node --experimental-strip-types tests/ycbt.test.ts
// Paquetes de referencia capturados del anillo real (aceptados por su firmware).
import assert from 'node:assert/strict';
import {
  buildFrame, CMD, decodeBattery, decodeLive, FrameAssembler, fromBase64, toBase64, decodeName,
} from '../src/ble/ycbt.ts';

const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join(' ');

// Frames verificados en el anillo
assert.equal(hex(buildFrame(0x032f, [1, 0])), '03 2f 08 00 01 00 4f 1b');
assert.equal(hex(buildFrame(0x032f, [0, 0])), '03 2f 08 00 00 00 7e 28');
assert.equal(hex(buildFrame(0x032f, [1, 2])), '03 2f 08 00 01 02 0d 3b');
assert.equal(hex(buildFrame(0x0200, [0x47, 0x43])), '02 00 08 00 47 43 6f ec');
assert.equal(hex(buildFrame(0x0104, [1])), '01 04 07 00 01 1d e4');
assert.equal(hex(buildFrame(0x0225)), '02 25 06 00 38 ae');
assert.throws(() => buildFrame(0x0544, [2]), /borrado/);

// Reensamblado en trozos
const asm = new FrameAssembler();
const info = Uint8Array.from([0x02, 0x00, 0x1e, 0x00, 0xa3, 0, 1, 1, 0, 100, 0, 1, 0, 3, ...new Array(14).fill(0), 0xaa, 0xbb]);
assert.equal(asm.push(info.subarray(0, 10)).length, 0);
const frames = asm.push(info.subarray(10));
assert.equal(frames.length, 1);
assert.equal(decodeBattery(frames[0]), 100);

// En vivo
assert.deepEqual(decodeLive({ cmd: CMD.LIVE_HR, payload: Uint8Array.from([0x68]) }), { kind: 'hr', bpm: 104 });
assert.deepEqual(decodeLive({ cmd: CMD.LIVE_SPO2, payload: Uint8Array.from([97]) }), { kind: 'spo2', percent: 97 });
assert.deepEqual(decodeLive({ cmd: CMD.LIVE_BP, payload: Uint8Array.from([117, 76, 92, 0]) }), { kind: 'bp', systolic: 117, diastolic: 76, bpm: 92 });
const t = new Uint8Array(31); t[12] = 36; t[13] = 8;
assert.deepEqual(decodeLive({ cmd: CMD.LIVE_TEMP, payload: t }), { kind: 'temp', celsius: 36.8 });
assert.equal(decodeName({ cmd: CMD.DEVICE_NAME, payload: Uint8Array.from([83, 65, 78, 73, 83, 76, 73, 78, 75, 0]) }), 'SANISLINK');

// base64 ida y vuelta
for (const n of [0, 1, 2, 3, 7, 8, 30]) {
  const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
  assert.deepEqual(fromBase64(toBase64(b)), b);
}
assert.equal(toBase64(Uint8Array.from([0x03, 0x2f, 0x08])), 'Ay8I');

console.log('ycbt: todas las pruebas OK');
