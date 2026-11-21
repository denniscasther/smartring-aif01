# SmartRing (app Android)

App propia para el anillo AIF01: se conecta por Bluetooth directo desde el celular, sin la
app SmartHealth, y guarda las mediciones **solo en el teléfono** (SQLite).

## Pantallas

- **Inicio:** batería, últimos valores (pulso, SpO2, presión estimada, temperatura) y "Sincronizar ahora".
- **Medir:** mediciones en vivo de pulso, SpO2, presión y temperatura.
- **Historial:** todas las lecturas guardadas, con filtros.
- **Ajustes:** vincular el anillo y activar o desactivar el monitoreo automático.

## Stack

Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · `react-native-ble-plx` · `expo-sqlite`.

```
src/
├── app/            rutas (pestañas)
├── ble/ycbt.ts     protocolo YCBT puro (CRC, paquetes, decodificadores), con pruebas
├── ble/ringClient.ts  conexión BLE: conecta → tarea → desconecta SIEMPRE
├── db/database.ts  SQLite local
├── state/RingContext.tsx  estado global y acciones
└── ui/             tema y componentes
tests/ycbt.test.ts  pruebas con paquetes reales del anillo
```

## Comandos

```bash
npm test             # pruebas del protocolo
npm run typecheck
npx expo-doctor
npx eas-cli@latest build -p android --profile preview   # APK instalable (nube, gratis)
```

Usa Bluetooth nativo, así que **no funciona en Expo Go**: hay que instalar el APK.

## Pendiente

- Sincronización en segundo plano (Android limita el BLE en background; requiere
  `isBackgroundEnabled` + tarea periódica).
- Validar la descarga de historial con datos reales y el ACK `0x0580`.
- Gráficos por día.
