# CONTEXTO — smartring-aif01

Documento para retomar el proyecto sin perder nada (pensado para leerse por una persona
o por cualquier CLI de IA). Última actualización: **2026-11-21**.

## 1. Objetivo

El dueño compró un smart ring genérico y quiere "reprogramarlo": controlarlo y leer sus
datos desde su propia laptop/código, sin depender de la app china, y publicar los
resultados técnicos en una página (GitHub Pages) como sus otros proyectos.

Decisión tomada: **no** se reemplaza el firmware. Se controla el anillo hablando su
protocolo Bluetooth propietario. Reemplazar firmware (OTA del chip JieLi) se descartó por
riesgo de dejar el anillo inservible sin acceso físico al chip.

## 2. El dispositivo

| Dato | Valor |
|---|---|
| Nombre BLE | `AIF01 xxxx` |
| Nombre interno (cmd 0x0203) | `SANISLINK` |
| App oficial | SmartHealth (Yucheng / "YC"), página de descarga `staticpage.ycaviation.com` |
| Protocolo | **YCBT** (SDK de Yucheng) |
| Chip probable | JieLi (servicio `AE00`, típico de OTA JieLi) |
| Cargador | Magnético de 2 pines por USB → **solo carga, sin datos** (no aparece en Windows) |
| Batería al iniciar | 100 % |
| Dirección BLE | en `private/ring_addr.txt` o variable `RING_ADDR` (no se sube al repo) |

## 3. Cómo se descubrió (resumen)

1. El cable USB solo carga → no hay vía por USB.
2. Escaneo BLE desde la laptop (Python + `bleak`) → aparece `AIF01 xxxx` anunciando
   Heart Rate (0x180D) y FEE7.
3. Lectura de servicios GATT → servicio propietario `BE940000-…`, Nordic UART, AE00
   (JieLi), FEE7 (WeChat), Heart Rate estándar.
4. La app indicada por el fabricante es SmartHealth → Yucheng → protocolo **YCBT**.
   El servicio `be94…` coincide con lo documentado por la comunidad para YCBT.
5. Se implementó el formato de paquete y el CRC16 propio; el anillo los acepta.
6. Se descubrió que **sin activar sensores (0x0104 01) el LED nunca enciende** y las
   mediciones no arrancan.
7. Se probaron los tipos de medición uno por uno (ver `docs/protocolo-ycbt.md`).

## 4. Lo que funciona hoy

- Pulso, SpO2, presión (estimada) y temperatura **en vivo**.
- Batería, nombre, info y **lista de funciones soportadas** (bitmap 0x0201).
- Sincronizar hora y activar monitoreo automático (hecho el 2026-11-21 16:44).
- Pedir historial: el anillo responde, pero devolvió **0 registros** (ver §6).

## 5. Puntos frágiles (LEER antes de tocar)

- **Windows se queda conectado al anillo.** Con `bleak`, al terminar el script Windows a
  veces mantenía la conexión; un anillo conectado **no se anuncia**, por eso "desaparecía".
  Solución: `tools/ring.py` usa WinRT directo, desuscribe y cierra, y verifica
  `Estado final: desconectado`. Si vuelve a pasar: apagar/encender Bluetooth de la laptop.
- **Luz verde fija** = sensor midiendo sin parar. Se apaga con `ring.py apagar`
  (0x032F 00 xx + 0x0104 00).
- **0x0104 es un ajuste persistente.** `01` = monitoreo automático encendido (gasta más
  batería), `00` = apagado. Hoy quedó en `01` a propósito para generar historial.
- Mientras carga, el anillo **no se anuncia** por BLE.
- Si el celular con SmartHealth está conectado, la laptop no lo ve (solo 1 conexión).
- Los CRC "precalculados" por investigación externa estaban mal: **siempre calcularlos**.
- **Nunca enviar 0x0540–0x054E** (borrar historial).

## 6. Pendientes / siguiente paso

1. Usar el anillo varias horas (ideal una noche) con monitoreo automático y volver a
   correr `ring.py hist`. Si sigue vacío: probar el ACK `0x0580` (dos variantes
   documentadas, ver protocolo) o capturar el tráfico de la app (HCI snoop log de Android).
2. Decodificar historial: pulso (6 B), presión (8 B), combinado (20 B, incluye HRV,
   SpO2, temp), pasos (14 B), sueño (20 B + etapas de 8 B).
3. Página pública (`index.html`) con resultados técnicos. **Decisión pendiente del dueño:**
   publicar o no sus valores personales de salud (por defecto no se publican).
4. Posible integración con otros proyectos: `reloj-salud-iot`, asistente de voz / ESP32.

## 7. Datos personales y publicación

- Repo público: https://github.com/denniscasther/smartring-aif01
- Página (GitHub Pages, rama main, raíz): https://denniscasther.github.io/smartring-aif01/
- Decisión del dueño (2026-11-21): la página muestra **solo lo técnico**, sin sus lecturas de salud.

- `private/` está en `.gitignore`: ahí van lecturas crudas e historial.
- La web pública solo muestra hallazgos técnicos (protocolo, qué mide, cómo se hizo),
  sin la dirección BLE completa ni los valores de salud del dueño, salvo que él lo
  autorice explícitamente.
