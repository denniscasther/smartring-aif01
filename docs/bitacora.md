# Bitácora

## 2026-11-21

1. **USB:** el anillo en su cargador no aparece en Windows (sin VID/PID nuevo, sin COM).
   Conclusión: cable solo de carga.
2. **Escaneo BLE:** aparece `AIF01 xxxx` (RSSI −52) con servicios 180D y FEE7.
3. **GATT:** se listan servicios; se identifica `be94…`, Nordic UART, AE00 (JieLi).
4. **App:** el folleto lleva a SmartHealth (Yucheng). Se advierte que las apps
   "Heart Rate Monitor"/"HeartIn" de la misma página son anuncios, no del anillo.
5. **Pulso estándar (180D):** 0 lpm "sin contacto" aun con el anillo puesto; LED apagado.
6. **Investigación:** protocolo YCBT (Gadgetbridge PR #6239, trasbd/SmartHealthRing).
7. **Primer cliente YCBT:** batería 100 %, info OK, start de pulso aceptado pero sin datos.
8. **Clave:** `0x0104 01` (activar sensores) → LED enciende → **pulso en vivo**
   por tres vías (0x0601, 0x060D, 2A37).
9. **Problema:** LED quedó encendido y el anillo dejó de anunciarse. Varios intentos,
   carga, etc.
10. Anillo reaparece; se envía apagado (aceptado).
11. **Funciones (0x0201) y nombre (`SANISLINK`).**
12. **SpO2 en vivo:** OK (valor normal).
13. Anillo vuelve a "desaparecer" con LED fijo. **Causa real:** Windows seguía
    conectado (`BluetoothLEDevice.connection_status = 1`). Se envía apagado por WinRT
    sobre esa conexión → LED se apaga.
14. **Nuevo cliente WinRT** (`tools/ring.py`) que libera la conexión al terminar.
15. **Prueba de tipos 1,3,4,5,6:** 1 = presión, 4 = temperatura (probable); 3/5/6 rechazados.
16. **Historial:** todos los tipos responden 0 registros; `0x020D` no soportado.
17. **Configuración:** hora sincronizada (16:44) y monitoreo automático activado para
    generar historial.
18. Proyecto creado en `C:\Plataformas\Proyectos\denniscasther\smartring-aif01`.
