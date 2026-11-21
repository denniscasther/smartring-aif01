# Problemas y soluciones

| Síntoma | Causa | Solución |
|---|---|---|
| El anillo no aparece al conectarlo por USB | Cable de solo carga (2 pines) | Usar Bluetooth LE |
| Pulso estándar siempre 0 / "sin contacto" | Sensor apagado | Enviar `0x0104 01` + `0x030C 01 01` + `0x032F 01 00` |
| Start de medición aceptado pero sin datos | Falta `0x0104 01` | Igual que arriba |
| Luz verde fija que no se apaga | Medición/monitoreo activo | `python tools\ring.py apagar` |
| "Device … was not found" con bleak | **Windows sigue conectado** → el anillo no se anuncia | Usar `tools/ring.py` (WinRT). Si persiste: apagar/encender Bluetooth de la laptop |
| No aparece mientras carga | Comportamiento del anillo | Sacarlo del cargador |
| No aparece con el celular cerca | SmartHealth conectada | Apagar Bluetooth del celular |
| Respuesta `FC` | Falta prefijo mágico ("GC", "GF", "GP") o comando no soportado | Revisar payload |
| CRC rechazado (`FF`) | CRC mal calculado | Usar `crc16_ycbt` del protocolo |
| Historial con 0 registros | Hora sin sincronizar / monitoreo apagado | `ring.py config` y usar el anillo unas horas |
