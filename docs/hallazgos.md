# Hallazgos

## Hardware y conexión

- Anillo con LED verde (PPG) en la cara interna y cargador magnético de 2 pines.
- El cable USB **no** transmite datos: Windows no ve ningún dispositivo nuevo al conectarlo.
- Toda la comunicación es por **Bluetooth Low Energy**.

## Servicios BLE expuestos

| Servicio | Qué es |
|---|---|
| `1800` / `1801` | Genéricos (nombre, cambios de servicio) |
| `180D` Heart Rate | Pulso estándar BLE; ubicación del sensor = `03` (dedo) |
| `be940000-…` | **Protocolo propietario YCBT** (Yucheng) |
| `6e400001-…` Nordic UART | Canal serie; no fue necesario usarlo |
| `ae00` (`ae01`/`ae02`) | Firma típica del chip **JieLi** (control/OTA) |
| `fee7` | Protocolo WeChat (Tencent) |

## Funciones que el anillo declara (cmd 0x0201)

Bitmap decodificado con el mapa del SDK YCBT descompilado
(`DataUnpack.saveDeviceSupportFunctionData`). Payload real:
`f98b0000000008c0318804f9b600001f0414000000006005` + ceros.

| Medición | Declarada | Verificada en vivo |
|---|---|---|
| Pulso | ✅ | ✅ |
| SpO2 | ✅ | ✅ |
| Presión arterial | ✅ (estimada) | ✅ |
| Temperatura | ✅ | ✅ probable (tipo 4) |
| HRV / estrés | ✅ | ⏳ (no por tipos en vivo; esperar historial) |
| Sueño | ✅ | ⏳ historial |
| Pasos | ✅ | ⏳ historial |
| Info de batería | ✅ | ✅ |
| Actualización de firmware (OTA) | ✅ | no se toca |
| ECG / azúcar / respiración | ❌ | — |

También declara modos deportivos y funciones de reloj (firmware genérico compartido).

## Comportamiento observado

- El LED verde **solo** enciende tras `0x0104 01`. Antes, el servicio estándar 180D
  enviaba paquetes vacíos (`04 00`, 0 lpm, "sin contacto").
- Primera lectura de pulso estable a los ~13 s; SpO2 a los ~38 s.
- Tras detener, 2A37 puede repetir el último valor (caché), no es medición real.
- Mientras carga o mientras otra central está conectada, el anillo no se anuncia.
