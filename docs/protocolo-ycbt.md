# Protocolo YCBT (verificado en el anillo AIF01)

Todo lo marcado ✅ fue probado contra el anillo real el 2026-11-21. Lo marcado 📚 viene de
fuentes externas y aún no se verificó.

## Servicio y características

| UUID | Propiedades | Uso |
|---|---|---|
| `be940000-7333-be46-b7ae-689e71722bd5` | servicio | Protocolo YCBT |
| `be940001-…` | write, write-no-resp, indicate | **Escribir comandos** y recibir respuestas ✅ |
| `be940002-…` | write-no-resp | No usado |
| `be940003-…` | indicate | Datos empujados por el anillo (mediciones en vivo) ✅ |
| `00002a37-…` (servicio 180D) | notify | Pulso estándar BLE (solo trae valores si hay medición activa) ✅ |

Suscribirse con **INDICATE** a `be940001` y `be940003`. Escribir con respuesta.

## Formato de paquete ✅

```
[grupo] [clave] [largo_lo] [largo_hi] [payload ...] [crc_lo] [crc_hi]
```

- Comando = `(grupo << 8) | clave`, ej. `0x032F` → `03 2F`.
- `largo` = tamaño **total** del paquete (cabecera 4 + payload + CRC 2), little-endian.
- CRC16 propio sobre cabecera + payload, guardado low byte primero.

```python
def crc16_ycbt(data):
    s = 0xFFFF
    for x in data:
        a = ((s << 8) & 0xFF00) | ((s >> 8) & 0xFF)
        b = (a ^ x) & 0xFFFF
        c = b ^ ((b & 0xFF) >> 4)
        d = (c ^ (c << 12)) & 0xFFFF
        s = (d ^ ((d & 0xFF) << 5)) & 0xFFFF
    return s
```

Respuesta de error: payload de 1 byte `FB` (comando no soportado), `FC` (clave/magia
faltante), `FD` (largo), `FE` (datos), `FF` (CRC).

## Comandos verificados ✅

| Comando | Payload | Respuesta / efecto |
|---|---|---|
| `0x0200` info | `47 43` ("GC") | 24 B; `p[5]` = batería % (100) |
| `0x0201` funciones | `47 46` ("GF") | 60 B de bitmap (ver hallazgos.md) |
| `0x0203` nombre | `47 50` ("GP") | `SANISLINK` |
| `0x0225` batería detallada | — | 38 B en cero (no usado por este modelo) |
| `0x020D` resumen historial | — | `FC` → no soportado |
| `0x0100` hora | `año_lo año_hi mes día hora min seg díaSemana(lun=0)` | `00` OK |
| `0x0104` sensores salud / monitoreo auto | `01` activar · `00` desactivar | `00` OK — **sin esto el LED no enciende** |
| `0x030C` preparar PPG | `01 01` | `00` OK (antes de cada medición) |
| `0x032F` medición | `[acción, tipo]` acción 01=iniciar 00=detener | `00` aceptado · `01` rechazado |

### Tipos de medición (0x032F)

| Tipo | Resultado | Respuesta en vivo |
|---|---|---|
| 0 | ✅ Pulso | `0x0601` `p[0]` = lpm |
| 1 | ✅ Presión arterial (estimada) | `0x0603` `p[0]` sistólica, `p[1]` diastólica, `p[2]` lpm |
| 2 | ✅ SpO2 | `0x0602` `p[0]` = % (primer valor a los ~38 s) |
| 3 | ❌ rechazado (`01`) | — |
| 4 | ✅ probablemente temperatura | `0x060A` `p[12]` entero, `p[13]` décima (ej. 36 / 8) |
| 5 | ❌ rechazado | — |
| 6 | ❌ rechazado | — |

Otros paquetes vistos:
- `0x060D` cada ~1 s durante una medición: 31 B, `p[0]` = lpm, `p[21]` = contador.
- `0x040E` `[tipo, estado]`: fin de medición (ej. `01 01`, `02 01`, `04 01`).
- `0x040C` aviso de cambio de estado del sensor.

### Secuencia que funciona

```
0x0104 01        activar sensores
0x030C 01 01     preparar PPG
0x032F 01 <tipo> iniciar
... escuchar be940003 ...
0x032F 00 <tipo> detener
0x0104 00        (opcional) apagar monitoreo
```

## Historial 📚 (pedido ✅, contenido pendiente)

Pedido = opcode con payload vacío. El anillo respondió `00 00` (0 registros) a todos.

| Opcode | Tipo | Registro |
|---|---|---|
| `0x0502` | pasos/deporte | 14 B: inicio u32, fin u32, pasos u16, distancia u16, calorías u16 |
| `0x0504` | sueño | cabecera 20 B + etapas de 8 B (241 profundo, 242 ligero, 243 REM, 244 despierto) |
| `0x0506` | pulso | 6 B: tiempo u32, reservado, lpm |
| `0x0508` | presión | 8 B: tiempo u32, válido, sis, dia, lpm |
| `0x0509` | combinado | 20 B: tiempo, pasos, lpm, sis, dia, SpO2, resp, HRV, CVRR, temp ent, temp dec, … |

- Tiempo = segundos desde 2000-01-01 en hora local.
- Datos llegan con opcode +0x0F (ej. pulso `0x0515`) según Gadgetbridge.
- ACK `0x0580`: Gadgetbridge usa `[stream_hi, stream_lo, bloque_lo, bloque_hi]` por bloque;
  `ring4.py` usa `00` al final. **Sin verificar.**
- ⛔ `0x0540`–`0x054E` borran historial. **No enviar.**
