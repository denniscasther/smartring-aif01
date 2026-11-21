# smartring-aif01

Ingeniería inversa y control propio de un **smart ring genérico** (nombre BLE `AIF01`,
app oficial **SmartHealth** de Yucheng) desde una laptop Windows, sin usar la app del
fabricante.

> Proyecto aislado y experimental. Solo se envían comandos de lectura, medición y
> configuración básica (los mismos que usa la app oficial). **No** se modifica el
> firmware.

## Estado (2026-11-21)

| Capacidad | Estado |
|---|---|
| Identificar anillo y servicios BLE | ✅ |
| Protocolo propietario YCBT (formato + CRC16) | ✅ verificado contra el anillo |
| Pulso en vivo | ✅ |
| SpO2 en vivo | ✅ |
| Presión arterial (estimada) en vivo | ✅ |
| Temperatura en vivo | ✅ (probable, ver docs) |
| Batería / info / lista de funciones | ✅ |
| Sincronizar hora + monitoreo automático | ✅ configurado |
| Descarga de historial (sueño, pasos, HRV…) | ⏳ comandos listos, historial aún vacío |
| Página pública (técnica + batería) | ✅ https://denniscasther.github.io/smartring-aif01/ |
| App Android propia (`app/`) | 🔧 código listo, falta compilar e instalar el APK |
| Firmware propio | ❌ descartado (riesgo de dejarlo inservible) |

## Estructura

```
smartring-aif01/
├── README.md            ← este archivo
├── CONTEXTO.md          ← contexto completo para retomar (humano o IA)
├── index.html           ← página pública de resultados (GitHub Pages)
├── .nojekyll
├── docs/
│   ├── protocolo-ycbt.md    ← formato de paquetes, CRC, comandos, respuestas
│   ├── hallazgos.md         ← hardware, servicios BLE, funciones del anillo
│   ├── bitacora.md          ← qué se hizo, en orden, con resultados
│   └── problemas-y-soluciones.md
├── tools/
│   ├── ring.py          ← cliente principal (WinRT): info, medir, config, historial, apagar
│   ├── ble_scan.py      ← escaneo BLE
│   └── ble_gatt.py      ← listar servicios/características
└── private/             ← datos crudos y personales (NO se suben, ver .gitignore)
```

## Uso rápido

Requisitos: Windows 10/11 con Bluetooth LE, Python 3.11, `pip install bleak`
(trae los paquetes `winrt-*`).

```powershell
python tools\ble_scan.py                 # ¿se ve el anillo?
python tools\ring.py info                # batería, nombre, funciones
python tools\ring.py medir 0 45          # pulso 45 s
python tools\ring.py medir 2 60          # SpO2 60 s
python tools\ring.py config              # sincroniza hora + monitoreo automático
python tools\ring.py hist                # descarga historial (solo lectura)
python tools\ring.py apagar              # detiene mediciones y apaga sensores
python tools\ring.py estado              # batería -> status.json (lo muestra la página)
powershell -File tools\publicar_estado.ps1  # lee batería y la publica en la página
```

La dirección del anillo va en `private/ring_addr.txt` (no se sube) o en la variable
de entorno `RING_ADDR`. Encuéntrala con `tools/ble_scan.py`.

## Fuentes

- Gadgetbridge PR #6239 (anillos R20/R11M, familia YCBT): https://codeberg.org/Freeyourgadget/Gadgetbridge/pulls/6239
- trasbd/SmartHealthRing (`ring4.py`, CRC YCBT): https://github.com/trasbd/SmartHealthRing
- SDK YCBT descompilado (mapa de funciones, historial): https://github.com/auroraphtgrp01/ble-sleeping

Las mediciones de un anillo de consumo **no son diagnóstico médico**; en particular la
presión arterial es una estimación del sensor óptico.
