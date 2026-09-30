// Crea un video .y4m con un código de barras EAN-13 o EAN-8, para usarlo como
// "cámara falsa" de Chromium y probar el escáner de verdad.
//   node video-codigo.mjs 7501055300075 salida.y4m
import { writeFileSync } from 'node:fs';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function modulos(codigo) {
  const d = codigo.split('').map(Number);
  if (codigo.length === 13) {
    const par = PARIDAD[d[0]];
    let m = '101';
    for (let i = 1; i <= 6; i++) m += (par[i - 1] === 'L' ? L : G)[d[i]];
    m += '01010';
    for (let i = 7; i <= 12; i++) m += R[d[i]];
    return m + '101';
  }
  if (codigo.length === 8) {
    let m = '101';
    for (let i = 0; i < 4; i++) m += L[d[i]];
    m += '01010';
    for (let i = 4; i < 8; i++) m += R[d[i]];
    return m + '101';
  }
  throw new Error('Solo EAN-13 o EAN-8');
}

const [codigo, salida] = process.argv.slice(2);
const W = 640;
const H = 480;
const bits = modulos(codigo);
const anchoModulo = 4;
const anchoTotal = bits.length * anchoModulo;
const x0 = Math.floor((W - anchoTotal) / 2);
const y0 = 140;
const alto = 200;

const Y = Buffer.alloc(W * H, 235);
for (let y = y0; y < y0 + alto; y++) {
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    for (let k = 0; k < anchoModulo; k++) Y[y * W + x0 + i * anchoModulo + k] = 16;
  }
}
const UV = Buffer.alloc((W / 2) * (H / 2), 128);
const cabecera = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
const cuadro = Buffer.concat([Buffer.from('FRAME\n'), Y, UV, UV]);
writeFileSync(salida, Buffer.concat([cabecera, cuadro, cuadro, cuadro]));
console.log(`Video con ${codigo} (${bits.length} módulos) -> ${salida}`);
