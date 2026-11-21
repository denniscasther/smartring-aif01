import asyncio
from bleak import BleakScanner

async def main():
    found = await BleakScanner.discover(timeout=15.0, return_adv=True)
    rows = sorted(found.values(), key=lambda x: -x[1].rssi)
    for dev, adv in rows:
        name = adv.local_name or dev.name or "(sin nombre)"
        mfr = {hex(k): v.hex() for k, v in adv.manufacturer_data.items()}
        print(f"{dev.address}  RSSI={adv.rssi:4}  {name}")
        if adv.service_uuids:
            print("    servicios:", ", ".join(adv.service_uuids))
        if mfr:
            print("    fabricante:", mfr)

asyncio.run(main())
