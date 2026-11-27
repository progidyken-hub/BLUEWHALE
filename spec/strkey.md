# Strkey checksum

Every strkey (G, M and C address) ends with a 2-byte checksum.

## Layout

```
base32( version byte || payload || checksum )
```

| Address | Version byte | Payload |
|---|---|---|
| `G` account | `0x30` | 32-byte public key |
| `M` muxed account | `0x60` | 32-byte public key, then the 8-byte ID (big-endian) |
| `C` contract | `0x10` | 32-byte contract ID |

The checksum covers the version byte and the payload. It is stored low byte first.

## CRC-16 parameters

The checksum is CRC-16/XMODEM, also called CRC-16/CCITT with a zero seed.

| Parameter | Value |
|---|---|
| Width | 16 bits |
| Polynomial | `0x1021` |
| Initial value (seed) | `0x0000` |
| Input and output reflection | none |
| Final XOR | `0x0000` |
| Check value for ASCII `123456789` | `0x31C3` |

An implementation that starts from `0xFFFF` is CRC-16/CCITT-FALSE and produces different checksums. It is not valid here.

## Endianness

The CRC is a 16-bit value. Strkeys write the low byte first. For a CRC of `0x31C3`, the bytes appended to the payload are `C3 31`.

## Vectors

`spec/vectors/crc16-vectors.json` lists 15 inputs with the CRC and its little-endian bytes. It includes the empty input, single-byte inputs with the high bit set and clear, all-zero and all-`0xFF` inputs, and the `123456789` check value.

The vector file is data only. No package test suite reads it yet.
